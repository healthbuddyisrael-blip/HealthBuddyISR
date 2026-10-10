-- Disposable LOCAL database only. Fixtures and temporary triggers roll back.
begin;
create function pg_temp.assert_true(p_value boolean, p_label text)
returns void language plpgsql security invoker set search_path = '' as $$
begin if p_value is distinct from true then raise exception 'FAILED: %', p_label; end if; end;
$$;
create function pg_temp.expect_error(p_sql text, p_state text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlstate = p_state then return; end if;
    raise exception 'Expected %, got %: %', p_state, sqlstate, sqlerrm;
  end;
  raise exception 'Expected failure, got success: %', p_state;
end;
$$;

insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-0000-0000-000000000001','admin@example.test',now()),
 ('10000000-0000-0000-0000-000000000002','coach1@example.test',now()),
 ('10000000-0000-0000-0000-000000000003','coach2@example.test',now()),
 ('10000000-0000-0000-0000-000000000004','trainee1@example.test',now()),
 ('10000000-0000-0000-0000-000000000005','trainee2@example.test',now()),
 ('10000000-0000-0000-0000-000000000006','newcoach@example.test',now()),
 ('10000000-0000-0000-0000-000000000007','unverified@example.test',null),
 ('10000000-0000-0000-0000-000000000008','orphan@example.test',now()),
 ('10000000-0000-0000-0000-000000000009','failure@example.test',now());
insert into public.profiles(id,email,full_name,role) values
 ('10000000-0000-0000-0000-000000000001','admin@example.test','Admin','admin'),
 ('10000000-0000-0000-0000-000000000002','coach1@example.test','Coach 1','coach'),
 ('10000000-0000-0000-0000-000000000003','coach2@example.test','Coach 2','coach');
insert into public.invitations(email,role,token_hash,coach_id,invited_by,initial_target_steps,expires_at) values
 ('trainee1@example.test','trainee',repeat('a',64),'10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',8000,now()+interval '1 day'),
 ('trainee2@example.test','trainee',repeat('b',64),'10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003',9000,now()+interval '1 day'),
 ('newcoach@example.test','coach',repeat('c',64),null,'10000000-0000-0000-0000-000000000001',null,now()+interval '1 day'),
 ('failure@example.test','trainee',repeat('d',64),'10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',7000,now()+interval '1 day'),
 ('unverified@example.test','coach',repeat('e',64),null,'10000000-0000-0000-0000-000000000001',null,now()+interval '1 day');
insert into public.invitations(email,role,token_hash,invited_by,created_at,expires_at) values
 ('expired@example.test','coach',repeat('f',64),'10000000-0000-0000-0000-000000000001',now()-interval '2 days',now()-interval '1 day');

select pg_temp.expect_error($$insert into public.invitations(email,role,token_hash,coach_id,invited_by,expires_at) values ('bad@example.test','trainee',repeat('1',64),'10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',now()+interval '1 day')$$,'23514');
select pg_temp.expect_error($$insert into public.invitations(email,role,token_hash,invited_by,initial_target_steps,expires_at) values ('bad@example.test','coach',repeat('1',64),'10000000-0000-0000-0000-000000000001',8000,now()+interval '1 day')$$,'23514');
select pg_temp.expect_error($$update public.invitations set initial_target_steps=1 where token_hash=repeat('a',64)$$,'23514');

set local role supabase_auth_admin;
select pg_temp.assert_true(private.before_user_created('{"user":{"email":" TRAINEE1@EXAMPLE.TEST "}}')='{}'::jsonb,'hook allows normalized active invitation');
select pg_temp.assert_true(private.before_user_created('{"user":{"email":"stranger@example.test"}}') ? 'error','hook rejects uninvited');
select pg_temp.assert_true(private.before_user_created('{"user":{"email":"expired@example.test"}}') ? 'error','hook rejects expired');
select pg_temp.expect_error($$select token_hash from public.invitations$$,'42501');
reset role;

set local role service_role;
select pg_temp.expect_error($$select public.accept_invitation(repeat('a',64),'10000000-0000-0000-0000-000000000005','Mismatch')$$,'P0001');
select pg_temp.expect_error($$select public.accept_invitation(repeat('e',64),'10000000-0000-0000-0000-000000000007','Unverified')$$,'P0001');
select pg_temp.assert_true(public.accept_invitation(repeat('a',64),'10000000-0000-0000-0000-000000000004','Trainee 1')='trainee','trainee activation');
select pg_temp.assert_true(public.accept_invitation(repeat('b',64),'10000000-0000-0000-0000-000000000005','Trainee 2')='trainee','second trainee activation');
select pg_temp.assert_true(public.accept_invitation(repeat('c',64),'10000000-0000-0000-0000-000000000006','New Coach')='coach','coach activation');
select pg_temp.expect_error($$select public.accept_invitation(repeat('a',64),'10000000-0000-0000-0000-000000000004','Again')$$,'P0001');
reset role;
set constraints all immediate;
select pg_temp.assert_true((select count(*)=2 from public.coach_trainees),'exactly two assignments');
select pg_temp.assert_true((select count(*)=2 from public.step_targets),'exactly two targets, no coach target');
select pg_temp.assert_true((select target_steps=8000 and effective_from=public.business_date() and created_by='10000000-0000-0000-0000-000000000002' from public.step_targets where trainee_id='10000000-0000-0000-0000-000000000004'),'initial target taken only from invitation');
select pg_temp.assert_true((select accepted_at is not null from public.invitations where token_hash=repeat('a',64)),'accepted atomically');
set local role supabase_auth_admin;
select pg_temp.assert_true(private.before_user_created('{"user":{"email":"trainee1@example.test"}}') ? 'error','hook rejects accepted invitation');
reset role;

-- Inject a real database failure after profile/link insertion to verify rollback.
create function pg_temp.fail_target() returns trigger language plpgsql security invoker set search_path='' as $$
begin if new.trainee_id='10000000-0000-0000-0000-000000000009' then raise exception 'Test target failure'; end if; return new; end;
$$;
create trigger test_target_failure before insert on public.step_targets for each row execute function pg_temp.fail_target();
select pg_temp.expect_error($$select public.accept_invitation(repeat('d',64),'10000000-0000-0000-0000-000000000009','Failure')$$,'P0001');
select pg_temp.assert_true(not exists(select 1 from public.profiles where id='10000000-0000-0000-0000-000000000009'),'failed activation leaves no profile');
select pg_temp.assert_true(not exists(select 1 from public.coach_trainees where trainee_id='10000000-0000-0000-0000-000000000009'),'failed activation leaves no assignment');
select pg_temp.assert_true((select accepted_at is null from public.invitations where token_hash=repeat('d',64)),'failed activation does not consume invitation');
drop trigger test_target_failure on public.step_targets;

insert into public.daily_steps(trainee_id,date,steps) values
 ('10000000-0000-0000-0000-000000000004',public.business_date(),100),
 ('10000000-0000-0000-0000-000000000005',public.business_date(),200);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_true((select count(*)=1 and max(steps)=100 from public.daily_steps),'trainee sees only own reports');
select pg_temp.expect_error($$insert into public.daily_steps(trainee_id,date,steps) values ('10000000-0000-0000-0000-000000000005',public.business_date()-1,1)$$,'23514');
update public.daily_steps set steps=321 where trainee_id='10000000-0000-0000-0000-000000000004';
select pg_temp.assert_true((select max(steps)=321 from public.daily_steps),'trainee updates own report');
with updated as (update public.daily_steps set steps=999 where trainee_id='10000000-0000-0000-0000-000000000005' returning steps)
select pg_temp.assert_true((select count(*)=0 from updated),'trainee cannot update another report');
select pg_temp.expect_error($$update public.step_targets set target_steps=1$$,'42501');
select pg_temp.assert_true((select count(*)=0 from public.invitations),'trainee sees no invitation records');
select pg_temp.expect_error($$select token_hash from public.invitations$$,'42501');
select pg_temp.expect_error($$select public.accept_invitation(repeat('d',64),'10000000-0000-0000-0000-000000000009','Escalation')$$,'42501');
select pg_temp.expect_error($$select private.before_user_created('{}')$$,'42501');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true((select count(*)=1 and max(steps)=321 from public.daily_steps),'coach sees only assigned reports');
select pg_temp.assert_true((select count(*)=1 from public.profiles where id='10000000-0000-0000-0000-000000000004'),'coach sees assigned trainee profile');
select pg_temp.assert_true((select count(*)=0 from public.profiles where id='10000000-0000-0000-0000-000000000005'),'coach cannot see unrelated profile');
with updated as (update public.daily_steps set steps=999 returning steps)
select pg_temp.assert_true((select count(*)=0 from updated),'coach cannot modify reports');
-- V1 coach writes now use the today-only RPC; direct scheduling is closed.
select public.set_today_step_target('10000000-0000-0000-0000-000000000004',10000);
select pg_temp.expect_error($$select public.set_today_step_target('10000000-0000-0000-0000-000000000005',1)$$,'42501');
select pg_temp.expect_error($$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values ('10000000-0000-0000-0000-000000000004',1,public.business_date()+2,'10000000-0000-0000-0000-000000000003')$$,'42501');
select public.create_trainee_invitation('next@example.test',6000,repeat('2',64));
select pg_temp.expect_error($$update public.invitations set accepted_at=now()$$,'42501');
select pg_temp.expect_error($$select public.create_coach_invitation('bad@example.test',repeat('3',64))$$,'42501');

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select pg_temp.assert_true((select count(*)=6 from public.profiles),'admin reads all profiles');
select pg_temp.assert_true((select count(*)=2 from public.daily_steps),'admin reads all reports');
select pg_temp.assert_true((select count(*)=2 from public.coach_trainees),'admin reads all assignments');
select pg_temp.assert_true((select count(*)=7 from public.invitations),'admin reads administrative invitation data without hashes');
select pg_temp.expect_error($$select token_hash from public.invitations$$,'42501');
select pg_temp.expect_error($$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values ('10000000-0000-0000-0000-000000000004',1,public.business_date()+2,'10000000-0000-0000-0000-000000000001')$$,'42501');
reset role;

update auth.users set raw_app_meta_data='{"activation_attempt_id":"20000000-0000-0000-0000-000000000001"}' where id in ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000008');
set local role service_role;
select pg_temp.assert_true(not public.cleanup_unactivated_auth_user('10000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001'),'compensation refuses activated account');
select pg_temp.assert_true(not public.cleanup_unactivated_auth_user('10000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000002'),'compensation refuses a different creation attempt');
select pg_temp.assert_true(public.cleanup_unactivated_auth_user('10000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000001'),'compensation removes only its unactivated account');
reset role;
rollback;
\echo 'Auth Hook, atomic activation, compensation, and RLS assertions passed.'
