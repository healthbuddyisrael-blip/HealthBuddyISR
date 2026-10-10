begin;

-- Explicit operator action, not an auth.users trigger and not a browser RPC.
-- SECURITY INVOKER requires the database administrator's own auth/schema privileges.
create function private.bootstrap_initial_admin(p_auth_user_id uuid, p_full_name text)
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare
  v_email text;
begin
  -- Serialize bootstrap attempts. The stable key is not a credential.
  perform pg_catalog.pg_advisory_xact_lock(726401001);
  select lower(btrim(u.email)) into v_email
  from auth.users as u
  where u.id = p_auth_user_id and u.email_confirmed_at is not null
  for share;

  if v_email is distinct from 'healthbuddyisrael@gmail.com' then
    raise exception 'Bootstrap requires the verified primary admin Auth account' using errcode = '23514';
  end if;
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'An admin already exists; initial bootstrap is closed' using errcode = '23514';
  end if;
  if exists (select 1 from public.profiles where id = p_auth_user_id) then
    raise exception 'Auth account already has an application profile; review manually' using errcode = '23514';
  end if;

  insert into public.profiles(id, email, full_name, role)
  values (p_auth_user_id, v_email, p_full_name, 'admin');
  return p_auth_user_id;
end;
$$;
comment on function private.bootstrap_initial_admin(uuid, text) is
  'One-time operator-only creation of the first admin from a verified real Auth account. Email selects the bootstrap account; persisted role governs later authorization.';
revoke all on function private.bootstrap_initial_admin(uuid, text)
  from public, anon, authenticated, service_role;
grant usage on schema private to postgres;
grant execute on function private.bootstrap_initial_admin(uuid, text) to postgres;

commit;
