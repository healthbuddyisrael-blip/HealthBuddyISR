begin;
set local role service_role;
select public.accept_invitation(repeat('9',64),'30000000-0000-4000-8000-000000000002','Concurrent Coach');
commit;
