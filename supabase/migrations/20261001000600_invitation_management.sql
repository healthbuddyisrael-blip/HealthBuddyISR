begin;

alter table public.invitations add column revoked_at timestamptz;
alter table public.invitations add constraint invitations_single_terminal_state
  check (accepted_at is null or revoked_at is null);
create index invitations_inviter_created_idx on public.invitations(invited_by,created_at desc);

-- These are the authoritative V1 limits; expiry and throttling are never browser inputs.
create function private.invitation_limits()
returns table(ttl_hours integer,max_per_hour integer)
language sql immutable security invoker set search_path='' as $$ select 168,20 $$;
revoke all on function private.invitation_limits() from public,anon,authenticated,service_role;

create function private.protect_invitation_revocation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.revoked_at is not null then raise exception 'New invitation must be unrevoked' using errcode='23514'; end if;
  else
    if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
      raise exception 'Revocation is irreversible' using errcode='23514';
    end if;
    if new.accepted_at is not null and old.revoked_at is not null then
      raise exception 'Revoked invitation cannot be accepted' using errcode='23514';
    end if;
    if new.revoked_at is not null and new.accepted_at is not null then
      raise exception 'Accepted invitation cannot be revoked' using errcode='23514';
    end if;
    if new.revoked_at is not null and old.revoked_at is null then new.revoked_at:=clock_timestamp(); end if;
  end if;
  return new;
end $$;
create trigger invitations_protect_revocation before insert or update on public.invitations
  for each row execute function private.protect_invitation_revocation();
revoke all on function private.protect_invitation_revocation() from public,anon,authenticated,service_role;

-- Close direct creation/mutation so all issuance passes the concurrency and rate gates.
revoke insert,update,delete on public.invitations from authenticated,service_role;
revoke insert(email,role,token_hash,coach_id,invited_by,expires_at,initial_target_steps)
  on public.invitations from authenticated;
drop policy invitations_insert on public.invitations;
grant select(revoked_at) on public.invitations to authenticated,supabase_auth_admin;
alter policy invitations_auth_allowlist on public.invitations
  using (accepted_at is null and revoked_at is null and expires_at>statement_timestamp() and role in ('coach','trainee'));

create or replace function private.before_user_created(event jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.invitations
    where email=lower(btrim(event->'user'->>'email')) and accepted_at is null
      and revoked_at is null and expires_at>clock_timestamp() and role in ('coach','trainee')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Account creation requires an active invitation.'));
end $$;

create or replace function public.accept_invitation(p_token_hash text,p_auth_user_id uuid,p_full_name text)
returns public.user_role language plpgsql security definer set search_path='' as $$
declare v_invitation public.invitations%rowtype; v_email text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_full_name is null
    or length(btrim(p_full_name)) not between 1 and 100 then
    raise exception 'Invalid activation input' using errcode='22023';
  end if;
  select * into v_invitation from public.invitations where token_hash=p_token_hash for update;
  if not found or v_invitation.accepted_at is not null or v_invitation.revoked_at is not null
    or v_invitation.expires_at<=clock_timestamp() or v_invitation.role not in ('coach','trainee') then
    raise exception 'Invitation unavailable' using errcode='P0001';
  end if;
  select lower(btrim(email)) into v_email from auth.users
    where id=p_auth_user_id and email_confirmed_at is not null for share;
  if not found or v_email is distinct from v_invitation.email then
    raise exception 'Verified identity does not match invitation' using errcode='P0001';
  end if;
  if exists(select 1 from public.profiles where id=p_auth_user_id) then
    raise exception 'Application membership already exists' using errcode='P0001';
  end if;
  set constraints public.profiles_require_trainee_setup,public.coach_trainees_require_setup,public.step_targets_require_setup deferred;
  insert into public.profiles(id,email,full_name,role) values(p_auth_user_id,v_email,btrim(p_full_name),v_invitation.role);
  if v_invitation.role='trainee' then
    insert into public.coach_trainees(coach_id,trainee_id) values(v_invitation.coach_id,p_auth_user_id);
    insert into public.step_targets(trainee_id,target_steps,effective_from,created_by)
      values(p_auth_user_id,v_invitation.initial_target_steps,public.business_date(),v_invitation.coach_id);
  end if;
  update public.invitations set accepted_at=clock_timestamp() where id=v_invitation.id;
  set constraints public.profiles_require_trainee_setup,public.coach_trainees_require_setup,public.step_targets_require_setup immediate;
  set constraints public.profiles_require_trainee_setup,public.coach_trainees_require_setup,public.step_targets_require_setup deferred;
  return v_invitation.role;
end $$;

-- Explicit safe projection: hashes never leave management RPCs.
create function private.invitation_summary(p_invitation public.invitations)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('id',p_invitation.id,'email',p_invitation.email,'role',p_invitation.role,
    'initial_target_steps',p_invitation.initial_target_steps,'created_at',p_invitation.created_at,
    'expires_at',p_invitation.expires_at,'accepted_at',p_invitation.accepted_at,'revoked_at',p_invitation.revoked_at)
$$;
revoke all on function private.invitation_summary(public.invitations) from public,anon,authenticated,service_role;

-- Called only by narrow DEFINER wrappers. Locks are transaction-scoped, never table-wide.
-- Inviter lock serializes quota accounting; email lock serializes cross-inviter conflicts.
create function private.issue_invitation(p_email text,p_hash text,p_role public.user_role,p_target integer,p_previous uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_role public.user_role; v_email text:=lower(btrim(p_email));
  v_previous public.invitations%rowtype; v_new public.invitations%rowtype; v_limits record; v_now timestamptz;
begin
  select role into v_role from public.profiles where id=v_actor;
  if v_actor is null or not coalesce((v_role='admin' and p_role='coach' and p_target is null)
    or (v_role='coach' and p_role='trainee' and p_target>0),false) then
    raise exception 'Invitation permission denied' using errcode='42501';
  end if;
  if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid invitation input' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inviter:'||v_actor::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('invite-email:'||v_email,0));
  v_now:=clock_timestamp();
  if exists(select 1 from public.profiles where email=v_email) then
    raise exception 'Existing member' using errcode='HB001';
  end if;
  if p_previous is not null then
    select * into v_previous from public.invitations where id=p_previous for update;
    if not found or v_previous.email is distinct from v_email
      or not (v_previous.invited_by=v_actor or (v_role='admin' and v_previous.role='coach'))
      or v_previous.role is distinct from p_role or v_previous.initial_target_steps is distinct from p_target
      or v_previous.accepted_at is not null or v_previous.revoked_at is not null or v_previous.expires_at<=clock_timestamp() then
      raise exception 'Invitation unavailable' using errcode='HB004';
    end if;
  end if;
  if p_previous is null and exists(select 1 from public.invitations where email=v_email and accepted_at is null
    and revoked_at is null and expires_at>v_now and id is distinct from p_previous) then
    if exists(select 1 from public.invitations where email=v_email and accepted_at is null
      and revoked_at is null and expires_at>v_now and invited_by=v_actor and role=p_role) then
      raise exception 'Duplicate invitation' using errcode='HB002';
    end if;
    raise exception 'Invitation conflict' using errcode='HB003';
  end if;
  if p_previous is not null and exists(select 1 from public.invitations where email=v_email
    and accepted_at is null and revoked_at is null and expires_at>v_now
    and (role is distinct from p_role or not (invited_by=v_actor or (v_role='admin' and role='coach')))) then
    raise exception 'Invitation conflict' using errcode='HB003';
  end if;
  select * into v_limits from private.invitation_limits();
  if (select count(*) from public.invitations where invited_by=v_actor and created_at>v_now-interval '1 hour')>=v_limits.max_per_hour then
    raise exception 'Invitation rate limit' using errcode='HB005';
  end if;
  if p_previous is not null then
    -- Also retire legacy duplicate active rows for the same authorized purpose.
    update public.invitations set revoked_at=v_now where email=v_email
      and accepted_at is null and revoked_at is null and expires_at>v_now;
  end if;
  insert into public.invitations(email,role,token_hash,coach_id,invited_by,initial_target_steps,created_at,expires_at)
    values(v_email,p_role,p_hash,case when p_role='trainee' then v_actor else null end,v_actor,p_target,
      v_now,v_now+pg_catalog.make_interval(hours=>v_limits.ttl_hours)) returning * into v_new;
  return private.invitation_summary(v_new);
end $$;
revoke all on function private.issue_invitation(text,text,public.user_role,integer,uuid) from public,anon,authenticated,service_role;

create function public.create_coach_invitation(p_email text,p_token_hash text)
returns jsonb language sql security definer set search_path='' as $$
  select private.issue_invitation(p_email,p_token_hash,'coach',null)
$$;
create function public.create_trainee_invitation(p_email text,p_initial_target_steps integer,p_token_hash text)
returns jsonb language sql security definer set search_path='' as $$
  select private.issue_invitation(p_email,p_token_hash,'trainee',p_initial_target_steps)
$$;
create function public.rotate_invitation(p_invitation_id uuid,p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_previous public.invitations%rowtype;
begin
  select * into v_previous from public.invitations where id=p_invitation_id
    and (invited_by=auth.uid() or (role='coach' and private.current_role()='admin'));
  if not found then raise exception 'Invitation unavailable' using errcode='HB004'; end if;
  return private.issue_invitation(v_previous.email,p_token_hash,v_previous.role,v_previous.initial_target_steps,v_previous.id);
end $$;
create function public.revoke_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_previous public.invitations%rowtype; v_actor uuid:=auth.uid(); v_role public.user_role;
begin
  select role into v_role from public.profiles where id=v_actor;
  select * into v_previous from public.invitations where id=p_invitation_id
    and (invited_by=v_actor or (v_role='admin' and role='coach'));
  if not found or not ((v_role='admin' and v_previous.role='coach') or (v_role='coach' and v_previous.role='trainee')) then
    raise exception 'Invitation unavailable' using errcode='HB004';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inviter:'||v_actor::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('invite-email:'||v_previous.email,0));
  select * into v_previous from public.invitations where id=p_invitation_id for update;
  if v_previous.accepted_at is not null or v_previous.revoked_at is not null then
    raise exception 'Invitation unavailable' using errcode='HB004';
  end if;
  update public.invitations set revoked_at=clock_timestamp() where id=p_invitation_id;
end $$;
revoke all on function public.create_coach_invitation(text,text),public.create_trainee_invitation(text,integer,text),
  public.rotate_invitation(uuid,text),public.revoke_invitation(uuid) from public,anon,service_role,supabase_auth_admin;
grant execute on function public.create_coach_invitation(text,text),public.create_trainee_invitation(text,integer,text),
  public.rotate_invitation(uuid,text),public.revoke_invitation(uuid) to authenticated;
comment on function public.rotate_invitation(uuid,text) is 'Caller-owned pending invitation only. Atomic revocation + fresh issuance, using stored terms and database TTL/quota. Never returns hashes.';
comment on function private.issue_invitation(text,text,public.user_role,integer,uuid) is 'Private shared gate: role from auth.uid(), normalized-email advisory lock, inviter rolling-hour quota. Called only by fixed-purpose privileged wrappers.';

commit;
