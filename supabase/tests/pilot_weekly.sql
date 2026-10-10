-- Disposable local database only; all fixtures and clock changes roll back.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create function pg_temp.expect_error(query text,expected text) returns void language plpgsql as $$
begin begin execute query; exception when others then if sqlstate=expected then return; end if;
 raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm; end; raise exception 'Expected rejection: %',query; end $$;
-- Pin Sunday after the example reporting week. Real timezone conversion is
-- independently asserted before replacing the local clock for deadline tests.
select pg_temp.assert_true(public.business_date('2026-10-10 21:30:00+00')=date '2026-10-11','Jerusalem Sunday begins at UTC+3');
create or replace function public.business_date(p_timestamp timestamptz default statement_timestamp()) returns date
language sql stable security invoker set search_path='' as $$ select date '2026-10-11' $$;
insert into auth.users(id,email,email_confirmed_at)
select ('c0000000-0000-4000-8000-00000000000'||n)::uuid,'pilot-'||n||'@example.test',now() from generate_series(1,6) n;
insert into public.profiles(id,email,full_name,role)
select id,email,email,case right(id::text,1) when '1' then 'admin' when '2' then 'coach' when '3' then 'coach' else 'trainee' end::public.user_role
from auth.users where id::text like 'c0000000%';
insert into public.coach_trainees(coach_id,trainee_id) values
('c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000004'),
('c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000005'),
('c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000006');
insert into public.step_targets(trainee_id,created_by,effective_from,target_steps)
select trainee_id,coach_id,public.business_date(),8000 from public.coach_trainees where trainee_id::text like 'c0000000%';
set constraints all immediate;
insert into public.daily_steps(trainee_id,date,steps,strength_workout_completed,cardio_workout_completed)
select 'c0000000-0000-4000-8000-000000000004',date '2026-10-04'+n,5000,n=0,n in (1,2) from generate_series(0,6) n;
create function pg_temp.input(status text default 'draft',path text default null) returns jsonb language sql as $$
select jsonb_build_object('trainee_id','c0000000-0000-4000-8000-000000000004','week_start','2026-10-04',
  'status',status,'average_daily_steps',6450.25,'strength_workouts',1,'aerobic_workouts',2,'screenshot_path',path,
  'call_completed',true,'call_date','2026-10-11','general_feeling','Good','difficulties','None','progress','More walking',
  'agreements','Continue','next_week_goal','Walk after lunch','attention_required',false)
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error($q$select public.set_pilot_enrollment('c0000000-0000-4000-8000-000000000004','2026-10-04')$q$,'42501');
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
select public.set_pilot_enrollment('c0000000-0000-4000-8000-000000000004','2026-10-04');
select public.set_pilot_enrollment('c0000000-0000-4000-8000-000000000005','2026-10-04');
select pg_temp.assert_true((public.get_pilot_week_overview('2026-10-04')->'summary'->>'participants')::int=2,'admin sees both pilot participants');
select pg_temp.assert_true((public.get_pilot_week_overview('2026-10-04')->'summary'->>'overdue')::int=0,'Sunday deadline has not elapsed');
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000002',true);
select public.save_pilot_weekly_report(pg_temp.input());
select pg_temp.assert_true((select status='draft' and call_completed and revision=1 from public.pilot_weekly_reports),'completed conversation can stay draft');
select pg_temp.assert_true((select average_daily_steps=5000 and strength_workouts=1 and aerobic_workouts=2 and source='historical_daily' from public.pilot_weekly_figures),'draft never replaces daily history');
select pg_temp.expect_error('select public.save_pilot_weekly_report(pg_temp.input())','40001');
select pg_temp.expect_error($q$select public.save_pilot_weekly_report(pg_temp.input('submitted'),1)$q$,'23514');
select pg_temp.expect_error($q$select public.save_pilot_weekly_report(pg_temp.input()||' {"week_start":"2026-10-11"}'::jsonb)$q$,'23514');
select pg_temp.expect_error($q$select public.save_pilot_weekly_report(pg_temp.input()||' {"strength_workouts":-1}'::jsonb,1)$q$,'23514');
insert into storage.objects(bucket_id,name) values('pilot-step-evidence','c0000000-0000-4000-8000-000000000004/2026-10-04/d0000000-0000-4000-8000-000000000001.png');
select public.save_pilot_weekly_report(pg_temp.input('submitted','c0000000-0000-4000-8000-000000000004/2026-10-04/d0000000-0000-4000-8000-000000000001.png'),1);
select pg_temp.assert_true((select count(*)=1 and min(revision)=2 from public.pilot_weekly_reports),'submit edits the draft, no duplicate');
select pg_temp.assert_true((select average_daily_steps=6450.25 and strength_workouts=1 and aerobic_workouts=2 and source='manual_coach' from public.pilot_weekly_figures),'submitted authoritative average and independent counts, no sum with daily');
with removed as (delete from storage.objects returning *) select pg_temp.assert_true((select count(*)=0 from removed),'referenced evidence cannot be deleted');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values('pilot-step-evidence','c0000000-0000-4000-8000-000000000005/2026-10-04/d0000000-0000-4000-8000-000000000001.png')$q$,'42501');
select pg_temp.expect_error($q$insert into public.pilot_weekly_reports(trainee_id,coach_id,week_start) values('c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000002','2026-10-04')$q$,'42501');
select pg_temp.expect_error($q$select public.save_pilot_weekly_report(pg_temp.input()||'{"screenshot_path":"c0000000-0000-4000-8000-000000000004/2026-09-27/d0000000-0000-4000-8000-000000000001.png"}'::jsonb,2)$q$,'23514');
insert into storage.objects(bucket_id,name) values('pilot-step-evidence','c0000000-0000-4000-8000-000000000004/2026-10-04/d0000000-0000-4000-8000-000000000002.webp');
select public.save_pilot_weekly_report(pg_temp.input('submitted','c0000000-0000-4000-8000-000000000004/2026-10-04/d0000000-0000-4000-8000-000000000002.webp')||'{"strength_workouts":3,"aerobic_workouts":0}'::jsonb,2);
delete from storage.objects where name like '%000000000001.png';
select pg_temp.assert_true((select count(*)=1 from storage.objects),'replacement releases old evidence for deletion');
select pg_temp.assert_true((select strength_workouts=3 and aerobic_workouts=0 from public.pilot_weekly_figures),'correction counts three and zero');
select pg_temp.assert_true((select count(*)=7 and sum(steps)=35000 from public.daily_steps),'seven historical daily rows untouched');
select pg_temp.assert_true((select strength_sessions=1 and cardio_sessions=2 from public.weekly_activity),'old weekly view remains unchanged');
select pg_temp.assert_true((select strength_sessions=1 and strength_sessions_per_week is null from public.activity_window('c0000000-0000-4000-8000-000000000004','2026-10-04','2026-10-04')),'deployed short-window fix retained');
select pg_temp.assert_true((public.get_pilot_week_overview('2026-10-04')->'summary'->>'participants')::int=1,'coach sees assigned participant only');
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.pilot_weekly_reports),'unassigned coach cannot read report');
select pg_temp.assert_true((select count(*)=0 from storage.objects),'unassigned coach cannot read screenshot');
select pg_temp.expect_error('select public.save_pilot_weekly_report(pg_temp.input(),3)','42501');
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((select count(*)=1 from public.pilot_weekly_reports),'participant sees own submitted report');
select pg_temp.assert_true((select count(*)=0 from storage.objects),'participant cannot access private evidence');
select pg_temp.expect_error('select public.save_pilot_weekly_report(pg_temp.input(),3)','42501');
select pg_temp.expect_error('select public.save_daily_activity(public.business_date(),1000,true,false)','42501');
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000006',true);
select public.save_daily_activity(public.business_date(),1000,true,false);
select pg_temp.assert_true((select steps=1000 from public.daily_steps),'non-pilot daily reporting unchanged');
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*)=1 from storage.objects),'admin can inspect evidence');
select pg_temp.assert_true((public.get_pilot_week_overview('2026-10-04')->'summary'->>'submitted')::int=1 and
  (public.get_pilot_week_overview('2026-10-04')->'summary'->>'conversations')::int=1,'selected-week admin summary');
select pg_temp.expect_error($q$select public.set_pilot_enrollment('c0000000-0000-4000-8000-000000000004','2026-10-11')$q$,'23514');
reset role;
create or replace function public.business_date(p_timestamp timestamptz default statement_timestamp()) returns date
language sql stable security invoker set search_path='' as $$ select date '2026-10-12' $$;
set local role authenticated;
select pg_temp.assert_true((public.get_pilot_week_overview('2026-10-04')->'summary'->>'overdue')::int=1,'missing report overdue starting Monday');
reset role;
set local role anon;
select pg_temp.expect_error('select * from public.pilot_weekly_reports','42501');
select pg_temp.expect_error($q$select public.get_pilot_week_overview('2026-10-04')$q$,'42501');
reset role;
rollback;
\echo 'Pilot drafts, submit/edit, averages/counts, source precedence, evidence RLS, roles and deadlines passed.'
