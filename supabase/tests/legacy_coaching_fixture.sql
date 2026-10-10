-- Applied only to a fresh local DB between the old and Israeli-week migrations.
begin;
insert into auth.users(id,email,email_confirmed_at) values
('b0000000-0000-4000-8000-000000000001','legacy-coach@example.test',now()),
('b0000000-0000-4000-8000-000000000002','legacy-trainee@example.test',now());
insert into public.profiles(id,email,full_name,role) values
('b0000000-0000-4000-8000-000000000001','legacy-coach@example.test','Legacy coach','coach'),
('b0000000-0000-4000-8000-000000000002','legacy-trainee@example.test','Legacy trainee','trainee');
insert into public.coach_trainees(coach_id,trainee_id) values
('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000002');
insert into public.step_targets(trainee_id,created_by,target_steps,effective_from) values
('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001',6000,public.business_date());
insert into public.activity_baselines(trainee_id,baseline_average_daily_steps,baseline_strength_sessions_per_week,
baseline_cardio_sessions_per_week,baseline_period_start,baseline_period_end,program_start,program_end,steps_source)
values('b0000000-0000-4000-8000-000000000002',3000,0,0,
public.coaching_week_start(public.business_date())-28,public.coaching_week_start(public.business_date())-22,
public.coaching_week_start(public.business_date())-21,public.coaching_week_start(public.business_date())+6,'manual');
insert into public.weekly_coaching_checkins(id,trainee_id,coach_id,week_start,call_completed,call_date,general_status,difficulties,agreements,next_week_goal)
values
('b0000000-0000-4000-8000-000000000010','b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001',public.coaching_week_start(public.business_date())-14,true,public.coaching_week_start(public.business_date())-8,'Old Sunday call','None','Walk','Earlier goal'),
('b0000000-0000-4000-8000-000000000011','b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001',public.coaching_week_start(public.business_date())-7,true,public.coaching_week_start(public.business_date())-5,'Old Tuesday call','None','Walk','Later goal');
commit;
