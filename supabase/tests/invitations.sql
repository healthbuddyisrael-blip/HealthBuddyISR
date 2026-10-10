-- Disposable migrated database only; all synthetic fixtures roll back.
begin;
create function pg_temp.assert_true(p_value boolean,p_label text) returns void language plpgsql as $$
begin if p_value is distinct from true then raise exception 'FAILED: %',p_label; end if; end $$;
create function pg_temp.expect_error(p_sql text,p_state text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlstate=p_state then return; end if;
    raise exception 'Expected %, got %: %',p_state,sqlstate,sqlerrm;
  end;
  raise exception 'Expected failure: %',p_sql;
end $$;
insert into auth.users(id,email,email_confirmed_at) values
 ('40000000-0000-4000-8000-000000000001','manage-admin@example.test',now()),
 ('40000000-0000-4000-8000-000000000002','manage-coach@example.test',now()),
 ('40000000-0000-4000-8000-000000000003','other-coach@example.test',now()),
 ('40000000-0000-4000-8000-000000000004','member-trainee@example.test',now()),
 ('40000000-0000-4000-8000-000000000005','invite-coach@example.test',now()),
 ('40000000-0000-4000-8000-000000000006','unprofiled@example.test',now());
insert into public.profiles(id,email,full_name,role) values
 ('40000000-0000-4000-8000-000000000001','manage-admin@example.test','Admin','admin'),
 ('40000000-0000-4000-8000-000000000002','manage-coach@example.test','Coach','coach'),
 ('40000000-0000-4000-8000-000000000003','other-coach@example.test','Other Coach','coach'),
 ('40000000-0000-4000-8000-000000000004','member-trainee@example.test','Trainee','trainee');
insert into public.coach_trainees(coach_id,trainee_id) values('40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000004');
insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values('40000000-0000-4000-8000-000000000004',8000,public.business_date(),'40000000-0000-4000-8000-000000000002');
set constraints all immediate;

set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(public.create_coach_invitation(' INVITE-COACH@EXAMPLE.TEST ',repeat('a',64))->>'role'='coach','admin issues normalized coach invite');
select pg_temp.expect_error($$select public.create_trainee_invitation('bad@example.test',8000,repeat('b',64))$$,'42501');
select pg_temp.expect_error($$select public.create_coach_invitation('invite-coach@example.test',repeat('b',64))$$,'HB002');
select pg_temp.expect_error($$select public.create_coach_invitation('manage-coach@example.test',repeat('b',64))$$,'HB001');
select pg_temp.expect_error($$select public.create_coach_invitation('bad@example.test',8000,repeat('b',64))$$,'42883');
select pg_temp.expect_error($$select private.issue_invitation('bad@example.test',repeat('b',64),'coach',null)$$,'42501');
select pg_temp.expect_error($$select token_hash from public.invitations$$,'42501');
select pg_temp.expect_error($$update public.invitations set revoked_at=now()$$,'42501');

select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error($$select public.create_coach_invitation('bad@example.test',repeat('b',64))$$,'42501');
select pg_temp.expect_error($$select public.create_trainee_invitation('bad@example.test',0,repeat('b',64))$$,'42501');
select pg_temp.expect_error($$select public.create_trainee_invitation('bad@example.test',null,repeat('b',64))$$,'42501');
select pg_temp.assert_true(public.create_trainee_invitation('new-trainee@example.test',10000,repeat('b',64))->>'initial_target_steps'='10000','coach chooses target');
select pg_temp.expect_error($$select public.create_trainee_invitation('member-trainee@example.test',8000,repeat('c',64))$$,'HB001');
select pg_temp.assert_true((select count(*)=1 from public.invitations),'coach reads only own invites');
reset role;
select pg_temp.assert_true((select coach_id=invited_by and coach_id='40000000-0000-4000-8000-000000000002' from public.invitations where email='new-trainee@example.test'),'DB derives coach identity');
select pg_temp.assert_true((select expires_at-created_at=interval '7 days' from public.invitations where email='new-trainee@example.test'),'central TTL');
select pg_temp.expect_error($$insert into public.invitations(email,role,token_hash,invited_by,initial_target_steps,expires_at) values('bad@example.test','coach',repeat('c',64),'40000000-0000-4000-8000-000000000001',10000,now()+interval '7 days')$$,'23514');
create temporary table other_coach_invite as select id from public.invitations where email='new-trainee@example.test';
grant select on other_coach_invite to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000003',true);
select pg_temp.expect_error($$select public.create_trainee_invitation('new-trainee@example.test',10000,repeat('c',64))$$,'HB003');
select pg_temp.assert_true((select count(*)=0 from public.invitations),'other coach sees no invites');
select pg_temp.expect_error($$select public.rotate_invitation((select id from other_coach_invite),repeat('8',64))$$,'HB004');
select pg_temp.expect_error($$select public.revoke_invitation((select id from other_coach_invite))$$,'HB004');
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000004',true);
select pg_temp.expect_error($$select public.create_trainee_invitation('bad@example.test',8000,repeat('c',64))$$,'42501');
select pg_temp.expect_error($$select public.create_coach_invitation('bad@example.test',repeat('c',64))$$,'42501');
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000006',true);
select pg_temp.expect_error($$select public.create_coach_invitation('bad@example.test',repeat('c',64))$$,'42501');
reset role;

-- Rotation keeps history and invalidates the old hash for both signup and acceptance.
create temporary table old_invite as select id from public.invitations where email='invite-coach@example.test';
grant select on old_invite to authenticated;
-- Pre-management versions allowed duplicates; rotation must retire all matching active rows.
insert into public.invitations(email,role,token_hash,invited_by,expires_at)
  values('invite-coach@example.test','coach',repeat('9',64),'40000000-0000-4000-8000-000000000001',now()+interval '7 days');
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error($$select public.rotate_invitation((select id from old_invite),repeat('c',64))$$,'HB004');
select pg_temp.expect_error($$select public.revoke_invitation((select id from old_invite))$$,'HB004');
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(not (public.rotate_invitation((select id from old_invite),repeat('c',64)) ? 'token_hash'),'rotation returns no secret');
select pg_temp.expect_error($$select public.rotate_invitation((select id from old_invite),repeat('d',64))$$,'HB004');
reset role;
select pg_temp.assert_true((select revoked_at is not null from public.invitations where token_hash=repeat('a',64)),'old revoked');
select pg_temp.assert_true((select revoked_at is not null from public.invitations where token_hash=repeat('9',64)),'legacy duplicate revoked');
select pg_temp.assert_true((select count(*)=1 from public.invitations where email='invite-coach@example.test' and revoked_at is null and accepted_at is null and expires_at>now()),'one new active invitation');
set local role service_role;
select pg_temp.expect_error($$select public.accept_invitation(repeat('a',64),'40000000-0000-4000-8000-000000000005','New Coach')$$,'P0001');
reset role;
set local role supabase_auth_admin;
select pg_temp.assert_true(private.before_user_created('{"user":{"email":"invite-coach@example.test"}}')='{}'::jsonb,'newest allows signup');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select public.revoke_invitation((select id from public.invitations where email='invite-coach@example.test' and revoked_at is null));
reset role;
set local role supabase_auth_admin;
select pg_temp.assert_true(private.before_user_created('{"user":{"email":"invite-coach@example.test"}}') ? 'error','revoked blocks signup');
reset role;
set local role service_role;
select pg_temp.expect_error($$select public.accept_invitation(repeat('c',64),'40000000-0000-4000-8000-000000000005','New Coach')$$,'P0001');
select pg_temp.expect_error($$update public.invitations set revoked_at=null$$,'42501');
reset role;
select pg_temp.expect_error($$update public.invitations set revoked_at=null where token_hash=repeat('c',64)$$,'23514');
select pg_temp.expect_error($$update public.invitations set accepted_at=now() where token_hash=repeat('c',64)$$,'23514');

-- A fresh replacement's token still completes the existing trusted activation flow.
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select public.create_coach_invitation('invite-coach@example.test',repeat('1',64));
select public.rotate_invitation((select id from public.invitations where email='invite-coach@example.test' and revoked_at is null),repeat('2',64));
reset role;
set local role service_role;
select pg_temp.assert_true(public.accept_invitation(repeat('2',64),'40000000-0000-4000-8000-000000000005','Activated Coach')='coach','replacement token activates membership');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select pg_temp.expect_error($$select public.revoke_invitation((select id from public.invitations where email='invite-coach@example.test' and accepted_at is not null))$$,'HB004');
reset role;

insert into public.invitations(email,role,token_hash,invited_by,created_at,expires_at) values('old-expired@example.test','coach',repeat('e',64),'40000000-0000-4000-8000-000000000001',now()-interval '8 days',now()-interval '1 day');
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select pg_temp.expect_error($$select public.rotate_invitation((select id from public.invitations where email='old-expired@example.test'),repeat('f',64))$$,'HB004');
select pg_temp.assert_true(public.create_coach_invitation('old-expired@example.test',repeat('f',64))->>'role'='coach','expired email can get new issuance');

-- Resends count too; a denied rotation must leave the current invitation valid.
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000003',true);
do $$ declare v_current jsonb; i integer;
begin
  v_current:=public.create_trainee_invitation('quota@example.test',9000,repeat(md5('quota0'),2));
  for i in 1..19 loop v_current:=public.rotate_invitation((v_current->>'id')::uuid,repeat(md5('quota'||i),2)); end loop;
  perform pg_temp.expect_error(format('select public.rotate_invitation(%L::uuid,%L)',v_current->>'id',repeat(md5('quota20'),2)),'HB005');
  perform pg_temp.assert_true((select count(*)=1 from public.invitations where revoked_at is null),'rate rejected rotation preserves active invite');
  perform pg_temp.expect_error($q$select public.create_trainee_invitation('quota-other@example.test',8000,repeat('0',64))$q$,'HB005');
end $$;
reset role;
select pg_temp.assert_true((select count(*)=20 from public.invitations where email='quota@example.test'),'resends counted as fresh records');
select pg_temp.assert_true((select bool_and(length(token_hash)=64 and token_hash~'^[0-9a-f]+$') from public.invitations),'only hashes stored');
rollback;
\echo 'Invitation issuance, authorization, rotation, revocation, quotas and hook regression assertions passed.'
