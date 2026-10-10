-- Local disposable fixtures only; never run against production.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
insert into auth.users(id,email,email_confirmed_at)
select ('b0000000-0000-4000-8000-00000000000'||n)::uuid,'workout-'||n||'@example.test',now() from generate_series(1,3) n;
insert into public.profiles(id,email,full_name,role)
select id,email,email,case right(id::text,1) when '1' then 'admin' when '2' then 'coach' else 'trainee' end::public.user_role
from auth.users where id::text like 'b0000000%';
insert into public.coach_trainees(coach_id,trainee_id) values
('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000003');
insert into public.step_targets(trainee_id,created_by,effective_from,target_steps)
values ('b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002',public.business_date(),8000);
set constraints all immediate;
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
select public.create_activity_baseline('b0000000-0000-4000-8000-000000000003',public.business_date(),public.business_date()+13,3000,1,2);
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000003',true);
select public.save_daily_activity(public.business_date(),6000,true,true);
-- Retrying or editing the same report never creates another workout.
select public.save_daily_activity(public.business_date(),7000,true,true);
select pg_temp.assert_true((select count(*)=1 from public.daily_steps),'retry preserves one row');
select pg_temp.assert_true((select strength_sessions=1 and cardio_sessions=1
  and strength_sessions_per_week is null and cardio_sessions_per_week is null
  from public.activity_window('b0000000-0000-4000-8000-000000000003',public.business_date(),public.business_date())),
  'one-day count is one; no seven-workout projection');
select pg_temp.assert_true((public.get_activity_progress('b0000000-0000-4000-8000-000000000003')->'current'->>'strength_sessions')::integer=1,
  'participant progress uses recorded count');

-- Three complete historical Sunday/Saturday weeks: zero, one, three strength.
select public.save_daily_activity(public.coaching_week_start(public.business_date())-28+7*w+d,6000,
  case w when 0 then false when 1 then d=0 else d in (0,2,4) end,
  w=1 and d in (1,2)) from generate_series(0,2) w cross join generate_series(0,6) d;
select pg_temp.assert_true((select count(*)=3 and bool_and(step_days=7 and strength_sessions=
  case week_start when public.coaching_week_start(public.business_date())-28 then 0
    when public.coaching_week_start(public.business_date())-21 then 1 else 3 end)
  from public.weekly_activity where week_start<public.coaching_week_start(public.business_date())),
  'historical weekly strength counts zero, one, three');
select pg_temp.assert_true((select strength_sessions=1 and cardio_sessions=2 and strength_sessions_per_week=1 and cardio_sessions_per_week=2
  from public.activity_window('b0000000-0000-4000-8000-000000000003',public.coaching_week_start(public.business_date())-21,public.coaching_week_start(public.business_date())-15)),
  'strength and aerobic independent in full week');
select pg_temp.assert_true((select strength_sessions=4 and strength_sessions_per_week=2 and cardio_sessions=2 and cardio_sessions_per_week=1
  from public.activity_window('b0000000-0000-4000-8000-000000000003',public.coaching_week_start(public.business_date())-21,public.coaching_week_start(public.business_date())-8)),
  'historical 14-day counts and average unchanged');
select pg_temp.assert_true((select strength_sessions=0 and cardio_sessions=0 from public.activity_window(
  'b0000000-0000-4000-8000-000000000003',public.business_date()-100,public.business_date()-90)), 'empty window records zero workouts');
-- Join the real weekly view with seven real daily rows. Preserve its grain;
-- never sum repeated weekly totals. The app retrieves the view directly.
select pg_temp.assert_true((select count(*)=7 and min(w.strength_sessions)=1 and max(w.strength_sessions)=1 and max(w.cardio_sessions)=2
  from public.weekly_activity w join public.daily_steps d on d.trainee_id=w.trainee_id and public.coaching_week_start(d.date)=w.week_start
  where w.week_start=public.coaching_week_start(public.business_date())-21),'daily join does not alter weekly totals');
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((public.get_activity_progress('b0000000-0000-4000-8000-000000000003')->'current'->>'strength_sessions')::integer=1,
  'coach progress agrees with participant');
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((public.get_activity_progress('b0000000-0000-4000-8000-000000000003')->'current'->>'strength_sessions')::integer=1,
  'admin progress agrees with participant');
reset role;
rollback;
\echo 'Workout count, short window, history, join and role consistency assertions passed.'
