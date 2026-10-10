begin;
select id from public.invitations where token_hash=repeat('9',64) for update;
select pg_sleep(2);
set local role service_role;
select public.accept_invitation(repeat('9',64),'30000000-0000-4000-8000-000000000002','Concurrent Coach');
commit;
