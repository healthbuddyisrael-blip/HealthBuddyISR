-- Local disposable database; all fixtures roll back.
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
select ('90000000-0000-4000-8000-00000000000'||n)::uuid,'activity-'||n||'@example.test',now() from generate_series(1,5) n;
insert into public.profiles(id,email,full_name,role)
select id,email,email,case right(id::text,1) when '1' then 'admin' when '2' then 'coach' when '3' then 'coach' else 'trainee' end::public.user_role
from auth.users where id::text like '90000000%';
insert into public.coach_trainees(coach_id,trainee_id) values
('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000004'),
('90000000-0000-4000-8000-000000000003','90000000-0000-4000-8000-000000000005');
insert into public.step_targets(trainee_id,created_by,effective_from,target_steps)
select trainee_id,coach_id,public.business_date(),8000 from public.coach_trainees where trainee_id::text like '90000000%';
set constraints all immediate;
insert into public.daily_steps(trainee_id,date,steps)
select '90000000-0000-4000-8000-000000000004',public.business_date()-n,3000 from generate_series(14,20) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
select public.create_activity_baseline('90000000-0000-4000-8000-000000000004',public.business_date()-13,public.business_date(),9999,1,0.5);
select pg_temp.assert_true((select baseline_average_daily_steps=3000 and steps_source='historical' and baseline_strength_sessions_per_week=1 and baseline_cardio_sessions_per_week=0.5 from public.activity_baselines),'historical preferred; nonzero interview values');
select pg_temp.expect_error($q$select public.create_activity_baseline('90000000-0000-4000-8000-000000000004',public.business_date()-13,public.business_date(),3000,0,0)$q$,'23505');
select pg_temp.expect_error($q$select public.create_activity_baseline('90000000-0000-4000-8000-000000000005',public.business_date()-13,public.business_date(),3000,0,0)$q$,'42501');
select pg_temp.expect_error('select public.save_daily_activity(public.business_date(),1,true,true)','42501');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
select public.save_daily_activity(public.business_date()-n,7000,n in (0,7),n in (0,4,9)) from generate_series(0,13) n;
select pg_temp.assert_true((select strength_workout_completed and cardio_workout_completed from public.daily_steps where date=public.business_date()),'both independent booleans same day');
select public.save_daily_steps(public.business_date(),7000);
select pg_temp.assert_true((select strength_workout_completed and cardio_workout_completed from public.daily_steps where date=public.business_date()),'steps-only regression preserves flags');
select pg_temp.assert_true((select average_daily_steps=7000 and step_days=14 and strength_sessions=2 and cardio_sessions=3 and strength_sessions_per_week=1 and cardio_sessions_per_week=1.5 from public.activity_window('90000000-0000-4000-8000-000000000004',public.business_date()-13,public.business_date())),'final 14 days exclude baseline and count both workouts');
select pg_temp.assert_true((select step_change=4000 and strength_change=0 and cardio_change=1 and step_percentage_change between 133 and 134 from public.activity_outcomes),'baseline versus final');
select pg_temp.assert_true((select sum(step_days)=21 and sum(strength_sessions)=2 and sum(cardio_sessions)=3 from public.weekly_activity),'weekly aggregation counts only true flags and valid reports');
select pg_temp.assert_true((select sum(strength_days)=14 and sum(cardio_days)=14 from public.weekly_activity),'historical fields remain unknown');
select pg_temp.assert_true((select bool_and(extract(dow from week_start)=0) from public.weekly_activity),'weekly buckets start on Sunday');
select pg_temp.assert_true((public.get_activity_progress('90000000-0000-4000-8000-000000000004')->>'completed')::boolean,'completed progress');
select pg_temp.assert_true(public.get_activity_progress('90000000-0000-4000-8000-000000000005') is null,'other trainee progress hidden');
select pg_temp.expect_error($q$select public.create_activity_baseline('90000000-0000-4000-8000-000000000004',public.business_date()-13,public.business_date(),1,0,0)$q$,'42501');
select pg_temp.expect_error('update public.activity_baselines set baseline_average_daily_steps=10','42501');
select pg_temp.expect_error('select public.get_pilot_activity_summary()','42501');
select pg_temp.expect_error($q$update public.daily_steps set trainee_id='90000000-0000-4000-8000-000000000005'$q$,'42501');
with changed as (update public.daily_steps set strength_workout_completed=true where trainee_id='90000000-0000-4000-8000-000000000005' returning *)
select pg_temp.assert_true((select count(*)=0 from changed),'workout update cannot cross identity');
select pg_temp.expect_error('select public.save_daily_activity(public.business_date()+1,1,true,false)','23514');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.activity_baselines),'unassigned coach cannot read baseline');
select pg_temp.assert_true((select count(*)=0 from public.activity_outcomes),'unassigned coach cannot read outcomes');
select pg_temp.assert_true((select count(*)=0 from public.weekly_activity),'unassigned coach cannot read weekly reports');
select pg_temp.expect_error($q$select public.create_activity_baseline('90000000-0000-4000-8000-000000000005',public.business_date()-13,public.business_date(),null,0,0)$q$,'23514');
select pg_temp.expect_error($q$select public.create_activity_baseline('90000000-0000-4000-8000-000000000005',public.business_date()-13,public.business_date(),0,-1,0)$q$,'23514');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select public.create_activity_baseline('90000000-0000-4000-8000-000000000005',public.business_date()-14,public.business_date()-1,0,2,3);
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
select pg_temp.assert_true((select baseline_average_daily_steps=0 and steps_source='manual' and baseline_strength_sessions_per_week=2 from public.activity_baselines),'manual baseline supports zero steps and nonzero workouts');
select pg_temp.assert_true((select final_average_daily_steps is null and final_strength_sessions_per_week is null and step_percentage_change is null from public.activity_outcomes),'empty period and zero baseline stay null');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*)=2 from public.activity_baselines),'admin reads all baselines');
select pg_temp.assert_true((public.get_pilot_activity_summary()->>'step_eligible')::integer=1,'pilot excludes missing outcomes');
select pg_temp.assert_true((public.get_pilot_activity_summary()->>'two_dimensions_improved_percentage')::numeric=100,'pilot two of three improvement');
reset role;
select pg_temp.expect_error('update public.activity_baselines set baseline_average_daily_steps=1','23514');
delete from public.daily_steps where trainee_id='90000000-0000-4000-8000-000000000004' and date=public.business_date()-1;
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
select pg_temp.assert_true((select average_daily_steps=7000 and step_days=13 and strength_sessions_per_week is null and cardio_sessions_per_week is null from public.activity_window('90000000-0000-4000-8000-000000000004',public.business_date()-13,public.business_date())),'missing row never counted as zero or false');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((public.get_pilot_activity_summary()->>'step_eligible')::integer=0 and public.get_pilot_activity_summary()->>'steps_improved_percentage' is null,'empty eligible cohort is unknown, not zero percent');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000004',true);
select public.save_daily_steps(public.business_date()-1,7000);
select pg_temp.assert_true((select strength_workout_completed is null and cardio_workout_completed is null from public.daily_steps where date=public.business_date()-1),'legacy caller preserves unknowns');
select pg_temp.assert_true((select strength_sessions_per_week is null and cardio_sessions_per_week is null from public.activity_window('90000000-0000-4000-8000-000000000004',public.business_date()-13,public.business_date())),'legacy unknown prevents misleading frequency');
select pg_temp.assert_true((select baseline_average_daily_steps=3000 from public.activity_baselines),'baseline frozen after new reports');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000005',true);
select public.save_daily_activity(public.business_date()-n,case when n=0 then 100000 else 1000 end,n=0,n=0) from generate_series(0,14) n;
select pg_temp.assert_true((select final_average_daily_steps=1000 and step_change=1000 and step_percentage_change is null and final_strength_sessions_per_week=0 and strength_change=-2 and cardio_change=-3 from public.activity_outcomes),'zero baseline has absolute change without percentage; post-program outlier excluded');
select pg_temp.assert_true((public.get_activity_progress('90000000-0000-4000-8000-000000000005')->'current'->>'average_daily_steps')::numeric=1000,'completed progress uses fixed ending window, not latest day');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((public.get_pilot_activity_summary()->>'step_eligible')::integer=2 and (public.get_pilot_activity_summary()->>'strength_eligible')::integer=1,'cohort denominators reflect metric coverage independently');
select pg_temp.assert_true((public.get_pilot_activity_summary()->>'baseline_steps_median')::numeric=1500 and (public.get_pilot_activity_summary()->>'step_change_average')::numeric=2500,'paired cohort median and mean');
reset role;
set local role anon;
select pg_temp.expect_error('select public.get_pilot_activity_summary()','42501');
select pg_temp.expect_error('select public.save_daily_activity(current_date,1,true,true)','42501');
select pg_temp.expect_error('select * from public.activity_baselines','42501');
reset role;
rollback;
\echo 'Activity baseline, reporting, windows, weekly, cohort and RLS assertions passed.'
