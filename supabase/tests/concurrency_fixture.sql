-- ONLY the disposable PostgreSQL harness. This is not a migration or a seed.
do $$ begin
  if current_database() not like 'healthbuddy_auth_%' then
    raise exception 'Concurrency fixture requires a disposable healthbuddy_auth_* database';
  end if;
end $$;
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('30000000-0000-4000-8000-000000000001','concurrency-admin@example.test',now()),
 ('30000000-0000-4000-8000-000000000002','concurrency-coach@example.test',now());
insert into public.profiles(id,email,full_name,role) values
 ('30000000-0000-4000-8000-000000000001','concurrency-admin@example.test','Test Admin','admin');
insert into public.invitations(email,role,token_hash,invited_by,expires_at) values
 ('concurrency-coach@example.test','coach',repeat('9',64),'30000000-0000-4000-8000-000000000001',now()+interval '1 day');
commit;
