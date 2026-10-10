-- Disposable PostgreSQL harness ONLY. All clock/fixture changes roll back.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create function pg_temp.expect_error(query text,expected text) returns void language plpgsql as $$ begin
 begin execute query; exception when others then if sqlstate=expected then return; end if; raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm; end;
 raise exception 'Expected rejection: %',query;
end $$;
-- A deterministic clock tests real RLS/target matching across business days.
create or replace function public.business_date(p_timestamp timestamptz default statement_timestamp()) returns date
language sql stable security invoker set search_path='' as $$
 select (coalesce(case when p_timestamp=statement_timestamp() then nullif(current_setting('test.business_timestamp',true),'')::timestamptz end,p_timestamp) at time zone 'Asia/Jerusalem')::date
$$;
select set_config('test.business_timestamp','2026-10-01T12:00:00Z',true);
insert into auth.users(id,email,email_confirmed_at) values ('80000000-0000-4000-8000-000000000001','analytics-admin@example.test',now());
insert into public.profiles(id,email,full_name,role) values ('80000000-0000-4000-8000-000000000001','analytics-admin@example.test','Admin','admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(public.get_admin_coach_analytics()->'summary'->>'coach_count'='0','empty system coach count');
select pg_temp.assert_true(public.get_admin_coach_analytics()->'summary'->'reporting_rate'='null'::jsonb and public.get_admin_coach_analytics()->'summary'->'target_attainment_rate'='null'::jsonb,'empty denominators are null');
reset role;
insert into auth.users(id,email,email_confirmed_at) values
('80000000-0000-4000-8000-000000000002','analytics-coach-a@example.test',now()),
('80000000-0000-4000-8000-000000000003','analytics-coach-b@example.test',now()),
('80000000-0000-4000-8000-000000000004','analytics-empty@example.test',now()),
('80000000-0000-4000-8000-000000000005','analytics-x@example.test',now()),
('80000000-0000-4000-8000-000000000006','analytics-y@example.test',now()),
('80000000-0000-4000-8000-000000000007','analytics-inactive@example.test',now()),
('80000000-0000-4000-8000-000000000008','analytics-new@example.test',now()),
('80000000-0000-4000-8000-000000000009','auth-only@example.test',now());
insert into public.profiles(id,email,full_name,role,created_at) values
('80000000-0000-4000-8000-000000000002','analytics-coach-a@example.test','Coach A','coach','2026-10-01T12:00:00Z'),
('80000000-0000-4000-8000-000000000003','analytics-coach-b@example.test','Coach B','coach','2026-10-01T12:00:00Z'),
('80000000-0000-4000-8000-000000000004','analytics-empty@example.test','Coach Empty','coach','2026-10-01T12:00:00Z'),
('80000000-0000-4000-8000-000000000005','analytics-x@example.test','Trainee X','trainee','2026-10-01T12:00:00Z'),
('80000000-0000-4000-8000-000000000006','analytics-y@example.test','Trainee Y','trainee','2026-10-01T12:00:00Z'),
('80000000-0000-4000-8000-000000000007','analytics-inactive@example.test','Inactive','trainee','2026-10-01T12:00:00Z');
insert into public.coach_trainees(coach_id,trainee_id,created_at) values
('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000005','2026-10-01T12:00:00Z'),
('80000000-0000-4000-8000-000000000003','80000000-0000-4000-8000-000000000006','2026-10-01T12:00:00Z'),
('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000007','2026-10-01T12:00:00Z');
insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values
('80000000-0000-4000-8000-000000000005',8000,public.business_date(),'80000000-0000-4000-8000-000000000002'),
('80000000-0000-4000-8000-000000000006',10000,public.business_date(),'80000000-0000-4000-8000-000000000003'),
('80000000-0000-4000-8000-000000000007',8000,public.business_date(),'80000000-0000-4000-8000-000000000002');
select set_config('test.business_timestamp','2026-10-08T12:00:00Z',true);
insert into public.profiles(id,email,full_name,role,created_at) values ('80000000-0000-4000-8000-000000000008','analytics-new@example.test','New trainee','trainee','2026-10-07T21:30:00Z');
insert into public.coach_trainees(coach_id,trainee_id,created_at) values ('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000008','2026-10-07T21:30:00Z');
insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values ('80000000-0000-4000-8000-000000000008',10000,public.business_date(),'80000000-0000-4000-8000-000000000002');
set constraints all immediate;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
select public.set_today_step_target('80000000-0000-4000-8000-000000000005',10000);
reset role;
select set_config('test.business_timestamp','2026-10-10T12:00:00Z',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select public.create_coach_invitation('pending-analytics@example.test',repeat('8',64));
select pg_temp.assert_true(public.get_admin_coach_analytics()->'summary'->>'coach_count'='3' and public.get_admin_coach_analytics()->'summary'->>'trainee_count'='4','profiles only, pending invitation and Auth-only user excluded');
select pg_temp.assert_true(public.get_admin_coach_analytics()->'summary'->>'active_trainee_count'='0' and public.get_admin_coach_analytics()->'summary'->'target_attainment_rate'='null'::jsonb and public.get_admin_coach_analytics()->'summary'->'average_completion'='null'::jsonb,'system without reports has no attainment/average');
reset role;
insert into public.daily_steps(trainee_id,date,steps) values
('80000000-0000-4000-8000-000000000005','2026-10-04',9600),
('80000000-0000-4000-8000-000000000005','2026-10-05',6400),
('80000000-0000-4000-8000-000000000005','2026-10-07',8000),
('80000000-0000-4000-8000-000000000005','2026-10-09',0),
('80000000-0000-4000-8000-000000000005','2026-10-10',8000),
('80000000-0000-4000-8000-000000000005','2026-10-03',8000),
('80000000-0000-4000-8000-000000000006','2026-10-04',12000),
('80000000-0000-4000-8000-000000000006','2026-10-06',8000),
('80000000-0000-4000-8000-000000000008','2026-10-08',0),
('80000000-0000-4000-8000-000000000008','2026-10-07',10000),
('80000000-0000-4000-8000-000000000007','2026-09-11',0),
('80000000-0000-4000-8000-000000000007','2026-09-10',10000);
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(public.get_admin_coach_analytics()->'summary'->>'active_trainee_count'='3','one report activates, zero counts, missing stays inactive');
select pg_temp.assert_true(public.get_admin_coach_analytics()->'summary'->>'reported_days'='8' and public.get_admin_coach_analytics()->'summary'->>'expected_days'='24','reporting counts lifecycle eligible days');
select pg_temp.assert_true(public.get_admin_coach_analytics()->'summary'->>'eligible_reported_days'='8' and public.get_admin_coach_analytics()->'summary'->>'target_reached_days'='3','attainment excludes missing and pre-target reports');
select pg_temp.assert_true((public.get_admin_coach_analytics()->'summary'->>'target_attainment_rate')::numeric=37.5 and (public.get_admin_coach_analytics()->'summary'->>'average_completion')::numeric=72.5,'weighted system ratios use raw historical completion');
select pg_temp.assert_true(public.get_admin_coach_detail('80000000-0000-4000-8000-000000000002')->'coach'->>'trainee_count'='3' and public.get_admin_coach_detail('80000000-0000-4000-8000-000000000002')->'coach'->>'active_trainee_count'='2','coach counts grouped correctly');
select pg_temp.assert_true(public.get_admin_coach_detail('80000000-0000-4000-8000-000000000003')->'coach'->>'trainee_count'='1' and (public.get_admin_coach_detail('80000000-0000-4000-8000-000000000003')->'coach'->>'average_completion')::numeric=100,'second coach metrics isolated and uncapped 120+80 average');
select pg_temp.assert_true(public.get_admin_coach_detail('80000000-0000-4000-8000-000000000004')->'coach'->'reporting_rate'='null'::jsonb and public.get_admin_coach_detail('80000000-0000-4000-8000-000000000004')->'trainees'='[]'::jsonb,'coach without trainees has null rates');
select pg_temp.assert_true(public.get_admin_trainee_analytics('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000008')->>'expected_days'='3' and public.get_admin_trainee_analytics('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000008')->>'reported_days'='1','activation starts Oct 8 in Jerusalem and excludes earlier reports');
select pg_temp.assert_true(public.get_admin_trainee_analytics('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000005')->>'eligible_reported_days'='5' and public.get_admin_trainee_analytics('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000005')->>'target_reached_days'='2','historical transition changes attainment on correct day');
select pg_temp.assert_true(public.get_admin_coach_analytics(30)->'summary'->>'expected_days'='33' and public.get_admin_coach_analytics(30)->'summary'->>'eligible_reported_days'='9' and public.get_admin_coach_analytics(30)->'summary'->>'active_trainee_count'='4','30-day range includes Sept 11 and excludes Sept 10');
select pg_temp.assert_true(public.get_admin_trainee_analytics('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000007',30)->'average_completion'='null'::jsonb,'reports before first target have no completion');
select pg_temp.assert_true(public.get_admin_coach_detail('80000000-0000-4000-8000-000000000099') is null,'unknown coach exposes no data');
select pg_temp.assert_true(public.get_admin_coach_detail('80000000-0000-4000-8000-000000000005') is null,'trainee ID cannot masquerade as coach');
select pg_temp.assert_true(public.get_admin_trainee_analytics('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000006') is null,'mismatched coach/trainee pair exposes no data');
select pg_temp.assert_true(public.get_admin_coach_analytics(7,'analytics-coach-b')->>'total'='1' and public.get_admin_coach_analytics(7,'Coach A')->'summary'->>'trainee_count'='4','name/email search does not change system totals');
select pg_temp.assert_true(public.get_admin_coach_analytics(7,'%',1)->>'total'='0','search metacharacters are literal');
select pg_temp.assert_true(public.business_date('2026-10-09T21:30:00Z')='2026-10-10' and public.business_date('2026-01-01T22:30:00Z')='2026-01-02','Jerusalem summer/winter boundaries');
set local timezone='Pacific/Honolulu';
select set_config('test.business_timestamp','2026-10-09T21:30:00Z',true);
select pg_temp.assert_true(public.get_admin_coach_analytics()->>'today'='2026-10-10' and public.get_admin_coach_analytics()->'summary'->>'eligible_reported_days'='8','windows ignore database session timezone and UTC day');
select set_config('test.business_timestamp','2026-10-10T12:00:00Z',true);
select pg_temp.expect_error('select public.get_admin_coach_analytics(8)','22023');
select pg_temp.expect_error('select public.get_admin_coach_analytics(7,'''',0)','22023');
select pg_temp.expect_error($q$select public.get_admin_coach_analytics(7,'',1,'80000000-0000-4000-8000-000000000001'::uuid)$q$,'42883');
with changed as(update public.daily_steps set steps=1 returning *) select pg_temp.assert_true((select count(*)=0 from changed),'admin cannot update steps');
select pg_temp.expect_error($q$select public.save_daily_steps(public.business_date(),1)$q$,'42501');
select pg_temp.expect_error($q$select public.set_today_step_target('80000000-0000-4000-8000-000000000005',1)$q$,'42501');
select pg_temp.expect_error('update public.step_targets set target_steps=1','42501');
select pg_temp.expect_error('update public.coach_trainees set coach_id=trainee_id','42501');
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error('select public.get_admin_coach_analytics()','42501');
select pg_temp.expect_error($q$select public.get_admin_coach_detail('80000000-0000-4000-8000-000000000003')$q$,'42501');
select pg_temp.expect_error('select * from private.admin_trainee_metrics(30)','42501');
select pg_temp.expect_error('select public.get_admin_coach_analytics(30,''Coach B'',2)','42501');
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000005',true);
select pg_temp.expect_error('select public.get_admin_coach_analytics()','42501');
select pg_temp.expect_error($q$select public.get_admin_trainee_analytics('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000005')$q$,'42501');
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000009',true);
select pg_temp.expect_error('select public.get_admin_coach_analytics()','42501');
reset role;
-- Isolate the assignment business-date contribution to the max(start) formula.
set constraints all deferred;
select set_config('test.business_timestamp','2026-10-01T12:00:00Z',true);
insert into auth.users(id,email,email_confirmed_at) values('80000000-0000-4000-8000-000000000010','late-assignment@example.test',now());
insert into public.profiles(id,email,full_name,role) values('80000000-0000-4000-8000-000000000010','late-assignment@example.test','Late assignment','trainee');
insert into public.coach_trainees(coach_id,trainee_id,created_at) values('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000010','2026-10-07T21:30:00Z');
insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values('80000000-0000-4000-8000-000000000010',10000,public.business_date(),'80000000-0000-4000-8000-000000000002');
set constraints all immediate;
select set_config('test.business_timestamp','2026-10-10T12:00:00Z',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(public.get_admin_trainee_analytics('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000010')->>'expected_days'='3','assignment timestamp converts to Oct 8 and dominates older target/window start');
reset role;
set local role anon;
select pg_temp.expect_error('select public.get_admin_coach_analytics()','42501');
reset role;
-- Genuine multi-page membership list, no invitation counts or raw step transfer.
create temporary table coach_pages as select gen_random_uuid() as id,'Page coach '||lpad(value::text,3,'0') as name from generate_series(1,26) value;
insert into auth.users(id,email,email_confirmed_at) select id,id::text||'@example.test',now() from coach_pages;
insert into public.profiles(id,email,full_name,role) select id,id::text||'@example.test',name,'coach' from coach_pages;
set local role authenticated;
select set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(public.get_admin_coach_analytics()->>'total'='29' and jsonb_array_length(public.get_admin_coach_analytics()->'coaches')=25,'overview capped at 25 coaches');
select pg_temp.assert_true(jsonb_array_length(public.get_admin_coach_analytics(7,'',2)->'coaches')=4,'second page returns remainder');
select pg_temp.assert_true(public.get_admin_coach_analytics(30,'Page coach',2)->>'total'='26' and jsonb_array_length(public.get_admin_coach_analytics(30,'Page coach',2)->'coaches')=1,'search pagination bounded');
rollback;
\echo 'Admin analytics, historical targets, lifecycle denominators, and authorization assertions passed.'
