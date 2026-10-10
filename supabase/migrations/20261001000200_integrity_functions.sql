begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

-- Centralize SQL timezone semantics; keep aligned with src/lib/config.ts.
create function public.business_date(p_timestamp timestamptz default statement_timestamp())
returns date
language sql stable security invoker
set search_path = ''
as $$ select (p_timestamp at time zone 'Asia/Jerusalem')::date $$;

create function public.get_step_target(p_trainee_id uuid, p_date date)
returns integer
language sql stable security invoker
set search_path = ''
as $$
  select target.target_steps
  from public.step_targets as target
  where target.trainee_id = p_trainee_id and target.effective_from <= p_date
  order by target.effective_from desc
  limit 1
$$;
comment on function public.get_step_target(uuid, date) is
  'Effective target for a calendar date; NULL before the first target. SECURITY INVOKER: caller permissions and RLS apply.';
revoke all on function public.business_date(timestamptz), public.get_step_target(uuid, date)
  from public, anon, authenticated, service_role;
grant execute on function public.business_date(timestamptz), public.get_step_target(uuid, date)
  to authenticated, service_role;

create function private.normalize_email()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

create function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create function private.protect_profile_identity()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.role is distinct from old.role then
    raise exception 'Profile identity and role are immutable in V1' using errcode = '23514';
  end if;
  return new;
end;
$$;
comment on function private.protect_profile_identity() is
  'Immutable roles prevent existing role-dependent references becoming invalid, including under concurrent writes. Role migration requires a reviewed database migration.';

create function private.validate_coach_trainee()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.coach_id and role = 'coach') then
    raise exception 'coach_id must reference a coach' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = new.trainee_id and role = 'trainee') then
    raise exception 'trainee_id must reference a trainee' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.validate_daily_steps()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = new.trainee_id and role = 'trainee') then
    raise exception 'daily_steps.trainee_id must reference a trainee' using errcode = '23514';
  end if;
  if new.date > public.business_date() then
    raise exception 'Step reports cannot be dated after today in the business timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.validate_step_target()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Target changes are append-only; insert a new transition' using errcode = '23514';
  end if;
  if new.effective_from < public.business_date() then
    raise exception 'Target transitions cannot be backdated' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = new.trainee_id and role = 'trainee') then
    raise exception 'step_targets.trainee_id must reference a trainee' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id = new.created_by and role in ('coach', 'admin')) then
    raise exception 'Target creator must be a coach or admin' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.validate_invitation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.role = 'coach' and not exists (
    select 1 from public.profiles where id = new.invited_by and role = 'admin'
  ) then
    raise exception 'Only an admin can invite a coach' using errcode = '23514';
  end if;
  if new.role = 'trainee' and not exists (
    select 1 from public.profiles where id = new.coach_id and role = 'coach' and id = new.invited_by
  ) then
    raise exception 'A trainee invitation must reference its inviting coach' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.email is distinct from old.email
      or new.role is distinct from old.role or new.token_hash is distinct from old.token_hash
      or new.coach_id is distinct from old.coach_id or new.invited_by is distinct from old.invited_by
      or new.expires_at is distinct from old.expires_at or new.created_at is distinct from old.created_at then
      raise exception 'Invitation identity and terms are immutable; issue a new invitation' using errcode = '23514';
    end if;
    if old.accepted_at is not null and new.accepted_at is distinct from old.accepted_at then
      raise exception 'An accepted invitation cannot be reopened or accepted again' using errcode = '23514';
    end if;
    if new.accepted_at is not null and new.accepted_at is distinct from old.accepted_at then
      if old.expires_at <= statement_timestamp() then
        raise exception 'An expired invitation cannot be accepted' using errcode = '23514';
      end if;
      new.accepted_at := statement_timestamp();
    end if;
  elsif new.accepted_at is not null then
    raise exception 'New invitations must be unaccepted' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- The deferred constraint allows profile + assignment + first target in one transaction.
-- DELETE checks also prevent removing a live trainee's only coach.
create function private.require_trainee_setup()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  v_trainee_id uuid;
begin
  if tg_table_name = 'profiles' then
    v_trainee_id := new.id;
  else
    v_trainee_id := old.trainee_id;
  end if;
  if exists (select 1 from public.profiles where id = v_trainee_id and role = 'trainee') then
    if not exists (select 1 from public.coach_trainees where trainee_id = v_trainee_id) then
      raise exception 'Every trainee must have exactly one coach at commit' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.step_targets
      where trainee_id = v_trainee_id and effective_from <= public.business_date()
    ) then
      raise exception 'Every trainee must have an active target at commit' using errcode = '23514';
    end if;
  end if;
  return null;
end;
$$;
comment on function private.require_trainee_setup() is
  'Provision trainee profile, coach link, and initial current-day target in a single transaction. Deleting a trainee permits dependent cascades.';

create trigger profiles_normalize_email before insert or update on public.profiles
  for each row execute function private.normalize_email();
create trigger profiles_protect_identity before update on public.profiles
  for each row execute function private.protect_profile_identity();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create constraint trigger profiles_require_trainee_setup after insert on public.profiles
  deferrable initially deferred for each row execute function private.require_trainee_setup();

create trigger coach_trainees_validate before insert or update on public.coach_trainees
  for each row execute function private.validate_coach_trainee();
create constraint trigger coach_trainees_require_setup after delete or update on public.coach_trainees
  deferrable initially deferred for each row execute function private.require_trainee_setup();

create trigger daily_steps_validate before insert or update on public.daily_steps
  for each row execute function private.validate_daily_steps();
create trigger daily_steps_updated_at before update on public.daily_steps
  for each row execute function private.set_updated_at();

create trigger step_targets_validate before insert or update on public.step_targets
  for each row execute function private.validate_step_target();
create constraint trigger step_targets_require_setup after delete on public.step_targets
  deferrable initially deferred for each row execute function private.require_trainee_setup();

create trigger invitations_normalize_email before insert or update on public.invitations
  for each row execute function private.normalize_email();
create trigger invitations_validate before insert or update on public.invitations
  for each row execute function private.validate_invitation();

revoke all on function private.normalize_email(), private.set_updated_at(),
  private.protect_profile_identity(), private.validate_coach_trainee(),
  private.validate_daily_steps(), private.validate_step_target(),
  private.validate_invitation(), private.require_trainee_setup()
  from public, anon, authenticated, service_role;

commit;
