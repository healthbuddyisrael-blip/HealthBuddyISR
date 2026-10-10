begin;

alter table public.invitations add column initial_target_steps integer;
-- No initial target can safely be invented for a pre-existing trainee invitation.
-- Such records require an explicit reviewed data migration before this migration.
alter table public.invitations add constraint invitations_initial_target check (
  (role = 'coach' and initial_target_steps is null)
  or (role = 'trainee' and initial_target_steps is not null and initial_target_steps > 0)
);

create function private.protect_invitation_target()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.initial_target_steps is distinct from old.initial_target_steps then
    raise exception 'Initial invitation target is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger invitations_protect_target before update on public.invitations
  for each row execute function private.protect_invitation_target();
revoke all on function private.protect_invitation_target() from public, anon, authenticated, service_role;

-- INVOKER plus a column grant and a narrowly filtered Auth-only RLS policy.
-- The Auth service gets neither token hashes nor table write privileges.
grant usage on schema private to supabase_auth_admin;
grant select(email, role, accepted_at, expires_at) on public.invitations to supabase_auth_admin;
create policy invitations_auth_allowlist on public.invitations for select to supabase_auth_admin
  using (accepted_at is null and expires_at > statement_timestamp() and role in ('coach', 'trainee'));

create function private.before_user_created(event jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
begin
  if exists (
    select 1 from public.invitations
    where email = lower(btrim(event -> 'user' ->> 'email'))
      and accepted_at is null and expires_at > clock_timestamp()
      and role in ('coach', 'trainee')
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'Account creation requires an active invitation.'
  ));
end;
$$;
revoke all on function private.before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
comment on function private.before_user_created(jsonb) is
  'Auth-only signup allowlist. Does not consume invitations or assign roles. Configure the Auth Hook separately after admin bootstrap.';

-- PostgREST entry point callable only by the trusted application service client.
-- DEFINER is required to read verified Auth identity and provision all tables atomically.
create function public.accept_invitation(p_token_hash text, p_auth_user_id uuid, p_full_name text)
returns public.user_role language plpgsql security definer set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
  v_email text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_full_name is null or length(btrim(p_full_name)) not between 1 and 100 then
    raise exception 'Invalid activation input' using errcode = '22023';
  end if;
  select * into v_invitation from public.invitations where token_hash = p_token_hash for update;
  -- clock_timestamp checks expiry AFTER waiting on the invitation lock.
  if not found or v_invitation.accepted_at is not null or v_invitation.expires_at <= clock_timestamp()
    or v_invitation.role not in ('coach', 'trainee') then
    raise exception 'Invitation unavailable' using errcode = 'P0001';
  end if;
  select lower(btrim(email)) into v_email from auth.users
    where id = p_auth_user_id and email_confirmed_at is not null for share;
  if not found or v_email is distinct from v_invitation.email then
    raise exception 'Verified identity does not match invitation' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where id = p_auth_user_id) then
    raise exception 'Application membership already exists' using errcode = 'P0001';
  end if;

  set constraints public.profiles_require_trainee_setup,
    public.coach_trainees_require_setup, public.step_targets_require_setup deferred;

  insert into public.profiles(id,email,full_name,role)
    values (p_auth_user_id,v_email,btrim(p_full_name),v_invitation.role);
  if v_invitation.role = 'trainee' then
    insert into public.coach_trainees(coach_id,trainee_id) values (v_invitation.coach_id,p_auth_user_id);
    insert into public.step_targets(trainee_id,target_steps,effective_from,created_by)
      values (p_auth_user_id,v_invitation.initial_target_steps,public.business_date(),v_invitation.coach_id);
  end if;
  update public.invitations set accepted_at = clock_timestamp() where id = v_invitation.id;
  set constraints public.profiles_require_trainee_setup,
    public.coach_trainees_require_setup, public.step_targets_require_setup immediate;
  set constraints public.profiles_require_trainee_setup,
    public.coach_trainees_require_setup, public.step_targets_require_setup deferred;
  return v_invitation.role;
end;
$$;
revoke all on function public.accept_invitation(text,uuid,text) from public, anon, authenticated, supabase_auth_admin;
grant execute on function public.accept_invitation(text,uuid,text) to service_role;
comment on function public.accept_invitation(text,uuid,text) is
  'Service-only atomic activation from an Auth-verified UUID. Invitation row lock serializes double submissions. No browser email/role/coach input.';

-- Guarded compensation avoids a check-then-Admin-delete race with activation.
-- app_metadata is written only by trusted Auth Admin createUser, never user_metadata.
create function public.cleanup_unactivated_auth_user(p_auth_user_id uuid, p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_attempt text;
begin
  select raw_app_meta_data ->> 'activation_attempt_id' into v_attempt
    from auth.users where id = p_auth_user_id for update;
  if not found or v_attempt is distinct from p_attempt_id::text then return false; end if;
  if exists (select 1 from public.profiles where id = p_auth_user_id) then return false; end if;
  delete from auth.users where id = p_auth_user_id;
  return true;
end;
$$;
revoke all on function public.cleanup_unactivated_auth_user(uuid,uuid) from public, anon, authenticated, supabase_auth_admin;
grant execute on function public.cleanup_unactivated_auth_user(uuid,uuid) to service_role;
comment on function public.cleanup_unactivated_auth_user(uuid,uuid) is
  'Service-only compensation for this server creation attempt. Auth row lock + profile check prevent deleting an activated or pre-existing account.';

commit;
