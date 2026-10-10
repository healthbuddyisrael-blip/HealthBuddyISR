-- Run ONLY against a disposable local database, as postgres, with ON_ERROR_STOP.
-- All synthetic Auth/profile fixtures are rolled back; they are not production users.
begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if p_condition is distinct from true then
    raise exception 'FAILED: %', p_message;
  end if;
end;
$$;

-- Dynamic SQL is confined to the local test assertion harness, never production functions.
create function pg_temp.expect_error(p_sql text, p_sqlstate text, p_message text)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_sqlstate then return; end if;
    raise exception 'FAILED: %; expected %, got % (%)', p_message, p_sqlstate, sqlstate, sqlerrm;
  end;
  raise exception 'FAILED: %; statement unexpectedly succeeded', p_message;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000001', 'healthbuddyisrael@gmail.com', now()),
  ('00000000-0000-0000-0000-000000000002', 'coach1@example.test', now()),
  ('00000000-0000-0000-0000-000000000003', 'coach2@example.test', now()),
  ('00000000-0000-0000-0000-000000000004', 'trainee@example.test', now()),
  ('00000000-0000-0000-0000-000000000005', 'unconfirmed@example.test', null),
  ('00000000-0000-0000-0000-000000000006', 'unassigned@example.test', now()),
  ('00000000-0000-0000-0000-000000000007', 'deletion@example.test', now());

select pg_temp.expect_error(
  $$select private.bootstrap_initial_admin('00000000-0000-0000-0000-000000000005', 'Unverified')$$,
  '23514', 'bootstrap rejects unverified/wrong identity');
select pg_temp.expect_error(
  $$select private.bootstrap_initial_admin('00000000-0000-0000-0000-000000000002', 'Wrong identity')$$,
  '23514', 'bootstrap rejects another verified account');
select private.bootstrap_initial_admin('00000000-0000-0000-0000-000000000001', 'Admin');
select pg_temp.expect_error(
  $$select private.bootstrap_initial_admin('00000000-0000-0000-0000-000000000001', 'Admin')$$,
  '23514', 'bootstrap closes after first admin');

insert into public.profiles(id, email, full_name, role) values
  ('00000000-0000-0000-0000-000000000002', '  COACH1@EXAMPLE.TEST  ', 'Coach 1', 'coach'),
  ('00000000-0000-0000-0000-000000000003', 'coach2@example.test', 'Coach 2', 'coach'),
  ('00000000-0000-0000-0000-000000000004', 'trainee@example.test', 'Trainee', 'trainee');
insert into public.coach_trainees(coach_id, trainee_id) values
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004');
insert into public.step_targets(trainee_id, target_steps, effective_from, created_by) values
  ('00000000-0000-0000-0000-000000000004', 8000, public.business_date(), '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000004', 10000, public.business_date() + 10, '00000000-0000-0000-0000-000000000002');
set constraints all immediate;

select pg_temp.assert_true((select email = 'coach1@example.test' from public.profiles where id = '00000000-0000-0000-0000-000000000002'), 'email normalized');
select pg_temp.expect_error(
  $$insert into public.profiles(id,email,full_name,role) values ('00000000-0000-0000-0000-000000000006','unassigned@example.test','Unassigned','trainee')$$,
  '23514', 'trainee cannot commit without a coach and target');
select pg_temp.expect_error(
  $$set constraints all deferred;
    insert into public.profiles(id,email,full_name,role) values ('00000000-0000-0000-0000-000000000006','unassigned@example.test','Missing target','trainee');
    insert into public.coach_trainees(coach_id,trainee_id) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000006');
    set constraints all immediate;$$,
  '23514', 'trainee cannot commit with a coach but without an active target');
select pg_temp.expect_error(
  $$insert into public.coach_trainees(coach_id,trainee_id) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004')$$,
  '23505', 'trainee cannot belong to two coaches');
select pg_temp.expect_error(
  $$insert into public.coach_trainees(coach_id,trainee_id) values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003')$$,
  '23514', 'coach/trainee role mismatch rejected');
select pg_temp.expect_error(
  $$insert into public.coach_trainees(coach_id,trainee_id) values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002')$$,
  '23514', 'self-assignment rejected');
select pg_temp.expect_error(
  $$update public.profiles set role='coach' where id='00000000-0000-0000-0000-000000000004'$$,
  '23514', 'role changes cannot invalidate relationships');
select pg_temp.expect_error(
  $$delete from public.coach_trainees where trainee_id='00000000-0000-0000-0000-000000000004'$$,
  '23514', 'live trainee cannot lose its coach');

insert into public.daily_steps(trainee_id, date, steps, updated_at) values
  ('00000000-0000-0000-0000-000000000004', public.business_date(), 0, '2000-01-01Z'),
  ('00000000-0000-0000-0000-000000000004', public.business_date() - 30, 123, '2000-01-01Z');
update public.daily_steps set steps=456 where date = public.business_date() - 30;
select pg_temp.assert_true((select steps = 456 and updated_at > '2000-01-01Z' from public.daily_steps where date = public.business_date()-30), 'past reports editable and updated_at refreshed');
select pg_temp.assert_true((select count(*)=2 from public.daily_steps), 'missing dates do not become zero reports');
select pg_temp.expect_error(
  $$insert into public.daily_steps(trainee_id,date,steps) values ('00000000-0000-0000-0000-000000000004',public.business_date()-1,-1)$$,
  '23514', 'negative steps rejected');
select pg_temp.expect_error(
  $$insert into public.daily_steps(trainee_id,date,steps) values ('00000000-0000-0000-0000-000000000004',public.business_date(),1)$$,
  '23505', 'duplicate report date rejected');
select pg_temp.expect_error(
  $$insert into public.daily_steps(trainee_id,date,steps) values ('00000000-0000-0000-0000-000000000004',public.business_date()+1,1)$$,
  '23514', 'future steps rejected');
select pg_temp.expect_error(
  $$update public.daily_steps set date=public.business_date()+1 where date=public.business_date()$$,
  '23514', 'future steps rejected on update');
select pg_temp.expect_error(
  $$insert into public.daily_steps(trainee_id,date,steps) values ('00000000-0000-0000-0000-000000000002',public.business_date(),1)$$,
  '23514', 'step owner must be trainee');
set local timezone = 'UTC';
select pg_temp.assert_true(public.business_date('2026-10-01 22:30:00+00')='2026-10-02'::date, 'Jerusalem date differs from UTC near midnight');
select pg_temp.assert_true(public.business_date('2026-01-01 22:30:00+00')='2026-01-02'::date, 'winter timezone offset');
select pg_temp.assert_true(public.business_date()=(statement_timestamp() at time zone 'Asia/Jerusalem')::date, 'session timezone does not control today');

select pg_temp.expect_error(
  $$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values ('00000000-0000-0000-0000-000000000004',0,public.business_date()+1,'00000000-0000-0000-0000-000000000002')$$,
  '23514', 'zero target rejected');
select pg_temp.expect_error(
  $$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values ('00000000-0000-0000-0000-000000000004',-1,public.business_date()+1,'00000000-0000-0000-0000-000000000002')$$,
  '23514', 'negative target rejected');
select pg_temp.expect_error(
  $$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values ('00000000-0000-0000-0000-000000000004',9000,public.business_date(),'00000000-0000-0000-0000-000000000002')$$,
  '23505', 'duplicate target date rejected');
select pg_temp.expect_error(
  $$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values ('00000000-0000-0000-0000-000000000004',9000,public.business_date()-1,'00000000-0000-0000-0000-000000000002')$$,
  '23514', 'target cannot be backdated');
select pg_temp.expect_error(
  $$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values ('00000000-0000-0000-0000-000000000004',9000,public.business_date()+1,'00000000-0000-0000-0000-000000000004')$$,
  '23514', 'trainee cannot create target');
select pg_temp.expect_error(
  $$update public.step_targets set target_steps=9999 where effective_from=public.business_date()$$,
  '23514', 'target rows are immutable');
select pg_temp.assert_true(public.get_step_target('00000000-0000-0000-0000-000000000004',public.business_date()-1) is null, 'target absent before first transition');
select pg_temp.assert_true(public.get_step_target('00000000-0000-0000-0000-000000000004',public.business_date()+9)=8000, 'earlier historical target');
select pg_temp.assert_true(public.get_step_target('00000000-0000-0000-0000-000000000004',public.business_date()+10)=10000, 'new target on transition date');
select pg_temp.assert_true(public.get_step_target('00000000-0000-0000-0000-000000000004',public.business_date()+20)=10000, 'latest target remains active');

insert into public.invitations(email,role,token_hash,invited_by,expires_at) values
  (' COACH@EXAMPLE.TEST ','coach',repeat('a',64),'00000000-0000-0000-0000-000000000001',now()+interval '1 day');
insert into public.invitations(email,role,token_hash,coach_id,invited_by,initial_target_steps,expires_at) values
  ('new@example.test','trainee',repeat('b',64),'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',8000,now()+interval '1 day');
select pg_temp.expect_error(
  $$insert into public.invitations(email,role,token_hash,invited_by,expires_at) values ('x@example.test','admin',repeat('c',64),'00000000-0000-0000-0000-000000000001',now()+interval '1 day')$$,
  '23514', 'admin invitations forbidden');
select pg_temp.expect_error(
  $$insert into public.invitations(email,role,token_hash,invited_by,expires_at) values ('x@example.test','trainee',repeat('c',64),'00000000-0000-0000-0000-000000000002',now()+interval '1 day')$$,
  '23514', 'trainee invitation requires coach');
select pg_temp.expect_error(
  $$insert into public.invitations(email,role,token_hash,coach_id,invited_by,expires_at) values ('x@example.test','coach',repeat('c',64),'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',now()+interval '1 day')$$,
  '23514', 'coach invitation must not have coach_id');
select pg_temp.expect_error(
  $$insert into public.invitations(email,role,token_hash,coach_id,invited_by,expires_at) values ('x@example.test','trainee',repeat('c',64),'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',now()+interval '1 day')$$,
  '23514', 'trainee coach must equal inviter');
select pg_temp.expect_error(
  $$insert into public.invitations(email,role,token_hash,invited_by,expires_at) values ('x@example.test','coach',repeat('c',64),'00000000-0000-0000-0000-000000000002',now()+interval '1 day')$$,
  '23514', 'only admin invites coaches');
select pg_temp.expect_error(
  $$insert into public.invitations(email,role,token_hash,invited_by,expires_at) values ('x@example.test','coach',repeat('a',64),'00000000-0000-0000-0000-000000000001',now()+interval '1 day')$$,
  '23505', 'token hash unique');
select pg_temp.expect_error(
  $$insert into public.invitations(email,role,token_hash,invited_by,expires_at) values ('x@example.test','coach','plaintext-token','00000000-0000-0000-0000-000000000001',now()+interval '1 day')$$,
  '23514', 'plaintext-shaped token rejected');
update public.invitations set accepted_at=statement_timestamp() where token_hash=repeat('a',64);
select pg_temp.expect_error(
  $$update public.invitations set accepted_at=null where token_hash=repeat('a',64)$$,
  '23514', 'accepted invitation cannot reopen');
insert into public.invitations(email,role,token_hash,invited_by,created_at,expires_at) values
  ('coach@example.test','coach',repeat('d',64),'00000000-0000-0000-0000-000000000001',now()-interval '2 days',now()-interval '1 day'),
  ('coach@example.test','coach',repeat('e',64),'00000000-0000-0000-0000-000000000001',now(),now()+interval '2 days');
select pg_temp.expect_error(
  $$update public.invitations set accepted_at=now()-interval '36 hours' where token_hash=repeat('d',64)$$,
  '23514', 'expired invitation cannot accept with fabricated past timestamp');
select pg_temp.assert_true((select count(*)=3 from public.invitations where email='coach@example.test'), 'expired and accepted invitation history retained');

select pg_temp.assert_true((select count(*)=5 and bool_and(relrowsecurity) from pg_catalog.pg_class where relnamespace='public'::regnamespace and relname in ('profiles','coach_trainees','daily_steps','step_targets','invitations')), 'RLS enabled on all five tables');
select pg_temp.assert_true(not exists(select 1 from pg_catalog.pg_policies where schemaname='public' and (qual='true' or with_check='true')), 'no broad policies');
select pg_temp.assert_true(not has_function_privilege('authenticated','private.bootstrap_initial_admin(uuid,text)','EXECUTE'), 'bootstrap inaccessible to authenticated');
select pg_temp.assert_true(not has_function_privilege('service_role','private.bootstrap_initial_admin(uuid,text)','EXECUTE'), 'bootstrap inaccessible to service role');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.profiles','INSERT,UPDATE,DELETE'), 'profile writes closed');
select pg_temp.assert_true(not has_table_privilege('service_role','public.step_targets','UPDATE,DELETE'), 'normal trusted operations cannot overwrite/delete target history');

set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.daily_steps), 'authenticated identity without membership sees no reports');
select pg_temp.expect_error($$select private.bootstrap_initial_admin('00000000-0000-0000-0000-000000000001','Escalation')$$, '42501', 'authenticated cannot invoke bootstrap');
reset role;

set local role service_role;
update public.daily_steps set steps=789 where date=public.business_date()-30;
select pg_temp.expect_error(
  $$insert into public.daily_steps(trainee_id,date,steps) values ('00000000-0000-0000-0000-000000000004',public.business_date()+1,1)$$,
  '23514', 'service operations still run private integrity triggers');
select pg_temp.expect_error($$update public.step_targets set target_steps=42$$, '42501', 'service cannot overwrite target history');
select pg_temp.expect_error($$delete from public.step_targets$$, '42501', 'service cannot delete target history');
reset role;

-- Synthetic profile deletion must cascade steps/targets; coach deletion is restricted.
select pg_temp.expect_error(
  $$delete from public.profiles where id='00000000-0000-0000-0000-000000000002'$$,
  '23503', 'coach deletion cannot orphan trainees or target authorship');
delete from auth.users where id='00000000-0000-0000-0000-000000000004';
select pg_temp.assert_true((select count(*)=0 from public.daily_steps) and (select count(*)=0 from public.step_targets) and (select count(*)=0 from public.coach_trainees), 'Auth deletion cascades trainee records');

rollback;
\echo 'Database integrity assertions passed; all fixtures rolled back.'
