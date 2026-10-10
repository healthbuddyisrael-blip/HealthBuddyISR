-- Disposable local database only; all fixtures roll back.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create function pg_temp.expect_error(query text,expected text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
  end;
  raise exception 'Expected rejection: %',query;
end $$;
insert into auth.users(id,email,email_confirmed_at)
select ('a0000000-0000-4000-8000-00000000000'||n)::uuid,'calls-'||n||'@example.test',now() from generate_series(1,7) n;
insert into public.profiles(id,email,full_name,role,created_at)
select id,email,email,case right(id::text,1) when '1' then 'admin' when '2' then 'coach' when '3' then 'coach' else 'trainee' end::public.user_role,
  (public.coaching_week_start(public.business_date())-14)::timestamp at time zone 'Asia/Jerusalem'
from auth.users where id::text like 'a0000000%';
insert into public.coach_trainees(coach_id,trainee_id)
select case right(id::text,1) when '5' then 'a0000000-0000-4000-8000-000000000003' else 'a0000000-0000-4000-8000-000000000002' end::uuid,id
from public.profiles where id::text like 'a0000000%' and role='trainee';
insert into public.step_targets(trainee_id,created_by,effective_from,target_steps)
select trainee_id,coach_id,public.business_date(),6000 from public.coach_trainees where trainee_id::text like 'a0000000%';
set constraints all immediate;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select public.create_activity_baseline('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date())-14,public.coaching_week_start(public.business_date())+27,3000,0,0);
select public.create_activity_baseline('a0000000-0000-4000-8000-000000000006',public.coaching_week_start(public.business_date())-28,public.coaching_week_start(public.business_date())-1,3000,0,0);
select public.create_activity_baseline('a0000000-0000-4000-8000-000000000007',public.business_date()+1,public.business_date()+28,3000,0,0);
select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),false,null,'','','','',false,'');
select pg_temp.assert_true((select count(*)=1 and bool_and(not call_completed) from public.weekly_coaching_checkins),'create draft, not compliant');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((public.get_weekly_coaching_overview()->'summary'->>'active_trainees')::integer=2,'enrollment fallback includes no-report trainee; excludes completed/future programs');
select pg_temp.assert_true((public.get_weekly_coaching_overview()->'summary'->>'calls_missing')::integer=2,'missing row and draft both missing');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.get_weekly_coaching_overview()->'trainees') t
  where (t->>'call_overdue')::boolean),'current-week calls pending until Saturday ends even if older calls overdue');
select pg_temp.assert_true(not (public.get_weekly_call_history('a0000000-0000-4000-8000-000000000006')->>'current_expected')::boolean,'coach status does not expect calls after program');
select pg_temp.expect_error($q$select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),true,public.business_date(),'Good','None','Walk','6000',false,'')$q$,'42501');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select pg_temp.expect_error($q$select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),true,public.business_date(),' ','None','Walk','6000',false,'')$q$,'23514');
select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),true,public.business_date(),'Good week','Work hours','Morning walks','6000 + strength',true,'Review schedule');
select set_config('test.checkin_id',(select id::text from public.weekly_coaching_checkins),true);
select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),true,public.business_date(),' Better week ','Work hours','Morning walks','6500 + strength',false,'');
select pg_temp.assert_true((select count(*)=1 and bool_and(id::text=current_setting('test.checkin_id') and general_status='Better week' and updated_at>=created_at and call_completed) from public.weekly_coaching_checkins),'upsert keeps one record and identity, updates notes');
select pg_temp.expect_error($q$insert into public.weekly_coaching_checkins(trainee_id,coach_id,week_start) values('a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000002',public.coaching_week_start(public.business_date()))$q$,'23505');
select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date())-7,true,public.coaching_week_start(public.business_date())-1,'Earlier week','Motivation','Short walks','5500',true,'Earlier unresolved concern');
select pg_temp.assert_true((public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')->>'total')::integer=2,'historical records preserved');
select pg_temp.assert_true(public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')->>'current_goal'='6500 + strength','latest goal by week, not update time');
select pg_temp.expect_error($q$select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date())+7,false,null,'','','','',false,'')$q$,'23514');
select pg_temp.expect_error($q$select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date())+1,false,null,'','','','',false,'')$q$,'23514');
select pg_temp.expect_error($q$select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),true,public.business_date()+1,'Good','None','Walk','6000',false,'')$q$,'23514');
select pg_temp.expect_error($q$select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),true,public.coaching_week_start(public.business_date())-1,'Good','None','Walk','6000',false,'')$q$,'23514');
select pg_temp.expect_error($q$update public.weekly_coaching_checkins set coach_id='a0000000-0000-4000-8000-000000000003'$q$,'42501');
select pg_temp.expect_error('delete from public.weekly_coaching_checkins','42501');
select pg_temp.expect_error('select public.get_weekly_coaching_overview()','42501');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
select public.save_daily_activity(public.business_date()-n,7000,n in (0,3),n=0) from generate_series(0,6) n;
select pg_temp.assert_true((select count(*)=0 from public.weekly_coaching_checkins),'trainee cannot read private coach notes');
select pg_temp.assert_true((select count(*)=0 from public.weekly_coaching_compliance),'trainee cannot read compliance view');
select pg_temp.expect_error($q$select public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')$q$,'42501');
select pg_temp.expect_error($q$select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),false,null,'','','','',false,'')$q$,'42501');
with changed as (update public.weekly_coaching_checkins set next_week_goal='tampered' returning *) select pg_temp.assert_true((select count(*)=0 from changed),'trainee cannot update notes directly');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.weekly_coaching_checkins),'unassigned coach cannot read other reports');
select pg_temp.expect_error($q$select public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')$q$,'42501');
select pg_temp.expect_error($q$select public.save_weekly_checkin('a0000000-0000-4000-8000-000000000004',public.coaching_week_start(public.business_date()),false,null,'','','','',false,'')$q$,'42501');
with changed as (update public.weekly_coaching_checkins set next_week_goal='tampered' returning *) select pg_temp.assert_true((select count(*)=0 from changed),'unassigned direct update denied');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')->'recent_activity'->>'average_daily_steps')::numeric=7000
  and (public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')->'recent_activity'->>'strength_sessions')::integer=2
  and (public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')->'recent_activity'->>'cardio_sessions')::integer=1
  and (public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')->>'step_target')::integer=6000,'activity integration uses existing reports and structured target');
select pg_temp.assert_true((select count(*)=7 from public.daily_steps),'no duplicate activity written by calls');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((public.get_weekly_coaching_overview()->'summary'->>'calls_completed')::integer=1
  and (public.get_weekly_coaching_overview()->'summary'->>'calls_missing')::integer=1
  and (public.get_weekly_coaching_overview()->'summary'->>'compliance_percentage')::numeric=50,'weekly compliance denominator');
select pg_temp.assert_true((public.get_weekly_coaching_overview(public.coaching_week_start(public.business_date()),'missing')->>'total')::integer=1,'missing filter');
select pg_temp.assert_true((public.get_weekly_coaching_overview(public.coaching_week_start(public.business_date()),'completed')->>'total')::integer=1,'completed filter');
select pg_temp.assert_true((public.get_weekly_coaching_overview(public.coaching_week_start(public.business_date()),'attention')->>'total')::integer=2,'attention filter includes operational and explicit concerns');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(public.get_weekly_coaching_overview()->'trainees') t
  where t->>'trainee_id'='a0000000-0000-4000-8000-000000000004' and t->>'current_goal'='6500 + strength' and t->>'attention_reason'='Earlier unresolved concern' and (t->>'prior_call_overdue')::boolean),'current goal and older unresolved escalation visible');
select pg_temp.assert_true((public.get_weekly_coaching_overview(public.coaching_week_start(public.business_date())-7)->'summary'->>'calls_completed')::integer=1,'historical week compliance');
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(public.get_weekly_coaching_overview(public.coaching_week_start(public.business_date())-7)->'trainees') t
  where not (t->>'call_completed')::boolean and (t->>'call_overdue')::boolean),'ended-week missing call is overdue');
select pg_temp.assert_true((public.get_weekly_coaching_overview(public.coaching_week_start(public.business_date())-14)->'summary'->>'calls_completed')::integer=0,'completed calls do not leak into other weeks');
select pg_temp.assert_true((public.get_weekly_coaching_overview(public.coaching_week_start(public.business_date())-1001)->'summary'->>'compliance_percentage') is null,'no expected trainees gives unknown percentage');
select pg_temp.assert_true((public.get_weekly_call_history('a0000000-0000-4000-8000-000000000004')->>'total')::integer=2,'admin reads history');
select pg_temp.expect_error($q$select public.get_weekly_coaching_overview(public.coaching_week_start(public.business_date()),'invalid')$q$,'22023');
reset role;
-- Simulate a missing relationship inside this rolled-back, deferred transaction.
set constraints all deferred;
delete from public.coach_trainees where trainee_id='a0000000-0000-4000-8000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(exists(select 1 from jsonb_array_elements(public.get_weekly_coaching_overview()->'trainees') t
  where t->>'trainee_id'='a0000000-0000-4000-8000-000000000005' and t->>'coach_id' is null and (t->>'needs_attention')::boolean),'unassigned trainee remains visible and flagged');
reset role;
set local role anon;
select pg_temp.expect_error('select public.get_weekly_coaching_overview()','42501');
select pg_temp.expect_error('select * from public.weekly_coaching_checkins','42501');
reset role;
rollback;
\echo 'Weekly coaching calls, history, compliance, activity integration and RLS passed.'
