do $$ begin
  if (select count(*) from public.profiles where id='30000000-0000-4000-8000-000000000002' and role='coach') <> 1 then
    raise exception 'Expected exactly one concurrent membership';
  end if;
  if not exists(select 1 from public.invitations where token_hash=repeat('9',64) and accepted_at is not null) then
    raise exception 'Expected invitation accepted once';
  end if;
end $$;
-- Remove only this test's committed fixtures; never reset another database.
delete from auth.users where id in ('30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
\echo 'Concurrent acceptance verified; fixtures removed.'
