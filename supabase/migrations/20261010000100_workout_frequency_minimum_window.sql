begin;

-- Counts always represent recorded true flags. A partial first week must not
-- project a single workout into seven. Keep complete 7/14-day rates for baseline
-- comparisons and historical outcomes, separately from recorded totals.
create or replace function public.activity_window(p_trainee_id uuid,p_start date,p_end date)
returns table(average_daily_steps numeric,step_days bigint,strength_days bigint,cardio_days bigint,
  strength_sessions bigint,cardio_sessions bigint,strength_sessions_per_week numeric,cardio_sessions_per_week numeric)
language sql stable security invoker set search_path = '' as $$
  select avg(steps),count(*),count(strength_workout_completed),count(cardio_workout_completed),
    count(*) filter(where strength_workout_completed),count(*) filter(where cardio_workout_completed),
    case when p_end-p_start+1>=7 and count(strength_workout_completed)=p_end-p_start+1
      then (count(*) filter(where strength_workout_completed))*7.0/(p_end-p_start+1) end,
    case when p_end-p_start+1>=7 and count(cardio_workout_completed)=p_end-p_start+1
      then (count(*) filter(where cardio_workout_completed))*7.0/(p_end-p_start+1) end
  from public.daily_steps where trainee_id=p_trainee_id and date between p_start and p_end
$$;

commit;
