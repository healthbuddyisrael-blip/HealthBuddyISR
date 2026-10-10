begin;

-- NULL means never observed; the old steps-only RPC remains unchanged.
alter table public.daily_steps
  add column strength_workout_completed boolean,
  add column cardio_workout_completed boolean;
grant insert(strength_workout_completed,cardio_workout_completed),
  update(strength_workout_completed,cardio_workout_completed) on public.daily_steps to authenticated;

create table public.activity_baselines (
  trainee_id uuid primary key references public.profiles(id) on delete cascade,
  baseline_average_daily_steps numeric not null check (baseline_average_daily_steps between 0 and 2147483647),
  baseline_strength_sessions_per_week numeric not null check (baseline_strength_sessions_per_week between 0 and 7),
  baseline_cardio_sessions_per_week numeric not null check (baseline_cardio_sessions_per_week between 0 and 7),
  baseline_period_start date not null check (isfinite(baseline_period_start)),
  baseline_period_end date not null check (isfinite(baseline_period_end)),
  program_start date not null check (isfinite(program_start)),
  program_end date not null check (isfinite(program_end)),
  steps_source text not null check (steps_source in ('historical','manual')),
  created_at timestamptz not null default now(),
  check (baseline_period_start = program_start - 7 and baseline_period_end = program_start - 1),
  check (program_end >= program_start + 13)
);
comment on table public.activity_baselines is
  'Frozen entry interview and seven-day steps reference. Unknown baselines remain absent; never backfill fabricated values. One coaching period per trainee in this pilot.';
alter table public.activity_baselines enable row level security;
revoke all on public.activity_baselines from public, anon, authenticated, service_role;
grant select on public.activity_baselines to authenticated;
grant insert(trainee_id,baseline_average_daily_steps,baseline_strength_sessions_per_week,
  baseline_cardio_sessions_per_week,baseline_period_start,baseline_period_end,program_start,program_end,steps_source)
  on public.activity_baselines to authenticated;
create policy baseline_read on public.activity_baselines for select to authenticated using (
  (trainee_id = (select auth.uid()) and (select private.current_role()) = 'trainee')
  or ((select private.current_role()) = 'coach' and private.is_assigned_trainee(trainee_id))
  or (select private.current_role()) = 'admin'
);
create policy baseline_create on public.activity_baselines for insert to authenticated with check (
  ((select private.current_role()) = 'coach' and private.is_assigned_trainee(trainee_id))
  or (select private.current_role()) = 'admin'
);

-- Enforce historical provenance even for direct API inserts, and freeze the row.
create function private.validate_activity_baseline() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_days integer; v_average numeric;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Activity baseline is frozen' using errcode = '23514';
  end if;
  if not exists (select 1 from public.profiles where id=new.trainee_id and role='trainee') then
    raise exception 'Baseline must belong to a trainee' using errcode = '23514';
  end if;
  if new.baseline_period_end > public.business_date() then
    raise exception 'Baseline period must have ended' using errcode = '23514';
  end if;
  if new.steps_source = 'historical' then
    select count(*),avg(steps) into v_days,v_average from public.daily_steps
      where trainee_id=new.trainee_id and date between new.baseline_period_start and new.baseline_period_end;
    if v_days <> 7 then
      raise exception 'Seven recorded baseline days required; use manual entry' using errcode = '23514';
    end if;
    new.baseline_average_daily_steps := v_average;
  end if;
  return new;
end $$;
create trigger activity_baseline_validate before insert or update on public.activity_baselines
  for each row execute function private.validate_activity_baseline();
revoke all on function private.validate_activity_baseline() from public, anon, authenticated, service_role;

create function public.create_activity_baseline(p_trainee_id uuid,p_program_start date,p_program_end date,
  p_manual_steps numeric,p_strength numeric,p_cardio numeric)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_days integer; v_steps numeric;
begin
  if not coalesce(((select private.current_role()) = 'admin' or
    ((select private.current_role()) = 'coach' and private.is_assigned_trainee(p_trainee_id))),false) then
    raise exception 'Authorized coach or admin required' using errcode = '42501';
  end if;
  select count(*),avg(steps) into v_days,v_steps from public.daily_steps
    where trainee_id=p_trainee_id and date between p_program_start-7 and p_program_start-1;
  if v_days <> 7 and p_manual_steps is null then
    raise exception 'Manual steps required without seven historical days' using errcode = '23514';
  end if;
  insert into public.activity_baselines(trainee_id,baseline_average_daily_steps,
    baseline_strength_sessions_per_week,baseline_cardio_sessions_per_week,
    baseline_period_start,baseline_period_end,program_start,program_end,steps_source)
  values(p_trainee_id,case when v_days=7 then v_steps else p_manual_steps end,p_strength,p_cardio,
    p_program_start-7,p_program_start-1,p_program_start,p_program_end,
    case when v_days=7 then 'historical' else 'manual' end);
end $$;

create function public.save_daily_activity(p_date date,p_steps integer,p_strength boolean,p_cardio boolean)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select private.current_role()) is distinct from 'trainee'::public.user_role then
    raise exception 'Trainee membership required' using errcode = '42501';
  end if;
  insert into public.daily_steps(trainee_id,date,steps,strength_workout_completed,cardio_workout_completed)
  values((select auth.uid()),p_date,p_steps,p_strength,p_cardio)
  on conflict(trainee_id,date) do update set steps=excluded.steps,
    strength_workout_completed=excluded.strength_workout_completed,
    cardio_workout_completed=excluded.cardio_workout_completed;
end $$;

-- A window always has coverage. Frequencies require complete observations;
-- missing rows and legacy NULL flags never silently become false.
create function public.activity_window(p_trainee_id uuid,p_start date,p_end date)
returns table(average_daily_steps numeric,step_days bigint,strength_days bigint,cardio_days bigint,
  strength_sessions bigint,cardio_sessions bigint,strength_sessions_per_week numeric,cardio_sessions_per_week numeric)
language sql stable security invoker set search_path = '' as $$
  select avg(steps),count(*),count(strength_workout_completed),count(cardio_workout_completed),
    count(*) filter(where strength_workout_completed),count(*) filter(where cardio_workout_completed),
    case when p_end>=p_start and count(strength_workout_completed)=p_end-p_start+1
      then (count(*) filter(where strength_workout_completed))*7.0/(p_end-p_start+1) end,
    case when p_end>=p_start and count(cardio_workout_completed)=p_end-p_start+1
      then (count(*) filter(where cardio_workout_completed))*7.0/(p_end-p_start+1) end
  from public.daily_steps where trainee_id=p_trainee_id and date between p_start and p_end
$$;

create view public.weekly_activity with (security_invoker=true) as
select trainee_id,date_trunc('week',date)::date as week_start,
  avg(steps) as average_daily_steps,count(*) as step_days,
  count(strength_workout_completed) as strength_days,count(cardio_workout_completed) as cardio_days,
  case when count(strength_workout_completed)>0 then count(*) filter(where strength_workout_completed) end as strength_sessions,
  case when count(cardio_workout_completed)>0 then count(*) filter(where cardio_workout_completed) end as cardio_sessions
from public.daily_steps group by trainee_id,date_trunc('week',date)::date;

create view public.activity_outcomes with (security_invoker=true) as
select b.*,w.average_daily_steps as final_average_daily_steps,w.step_days,w.strength_days,w.cardio_days,
  w.strength_sessions_per_week as final_strength_sessions_per_week,
  w.cardio_sessions_per_week as final_cardio_sessions_per_week,
  w.average_daily_steps-b.baseline_average_daily_steps as step_change,
  w.strength_sessions_per_week-b.baseline_strength_sessions_per_week as strength_change,
  w.cardio_sessions_per_week-b.baseline_cardio_sessions_per_week as cardio_change,
  (w.average_daily_steps-b.baseline_average_daily_steps)*100/nullif(b.baseline_average_daily_steps,0) as step_percentage_change
from public.activity_baselines b
cross join lateral public.activity_window(b.trainee_id,b.program_end-13,b.program_end) w
where b.program_end<=public.business_date();

create function public.get_activity_progress(p_trainee_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('baseline',to_jsonb(b),'window_start',greatest(b.program_start,least(public.business_date(),b.program_end)-13),
    'window_end',least(public.business_date(),b.program_end),'completed',b.program_end<=public.business_date(),
    'current',to_jsonb(w))
  from public.activity_baselines b cross join lateral public.activity_window(b.trainee_id,
    greatest(b.program_start,least(public.business_date(),b.program_end)-13),least(public.business_date(),b.program_end)) w
  where b.trainee_id=p_trainee_id
$$;

create function public.get_pilot_activity_summary()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if (select private.current_role()) is distinct from 'admin'::public.user_role then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'participants',(select count(*) from public.profiles where role='trainee'),
    'baselines',(select count(*) from public.activity_baselines),
    'completed',count(*),
    'step_eligible',count(*) filter(where step_days=14),
    'strength_eligible',count(*) filter(where strength_days=14),
    'cardio_eligible',count(*) filter(where cardio_days=14),
    'all_eligible',count(*) filter(where step_days=14 and strength_days=14 and cardio_days=14),
    'baseline_steps_average',avg(baseline_average_daily_steps) filter(where step_days=14),
    'baseline_steps_median',percentile_cont(0.5) within group(order by baseline_average_daily_steps) filter(where step_days=14),
    'final_steps_average',avg(final_average_daily_steps) filter(where step_days=14),
    'final_steps_median',percentile_cont(0.5) within group(order by final_average_daily_steps) filter(where step_days=14),
    'step_change_average',avg(step_change) filter(where step_days=14),
    'step_change_median',percentile_cont(0.5) within group(order by step_change) filter(where step_days=14),
    'steps_improved_percentage',100.0*(count(*) filter(where step_days=14 and step_change>0))/nullif(count(*) filter(where step_days=14),0),
    'strength_improved_percentage',100.0*(count(*) filter(where strength_days=14 and strength_change>0))/nullif(count(*) filter(where strength_days=14),0),
    'cardio_improved_percentage',100.0*(count(*) filter(where cardio_days=14 and cardio_change>0))/nullif(count(*) filter(where cardio_days=14),0),
    'two_dimensions_improved_percentage',100.0*(count(*) filter(where step_days=14 and strength_days=14 and cardio_days=14 and
      ((step_change>0)::integer+(strength_change>0)::integer+(cardio_change>0)::integer)>=2))/nullif(count(*) filter(where step_days=14 and strength_days=14 and cardio_days=14),0)
  ) into v_result from public.activity_outcomes;
  return v_result;
end $$;

revoke all on public.weekly_activity,public.activity_outcomes from public,anon,authenticated,service_role;
grant select on public.weekly_activity,public.activity_outcomes to authenticated;
revoke all on function public.create_activity_baseline(uuid,date,date,numeric,numeric,numeric),
  public.save_daily_activity(date,integer,boolean,boolean),public.activity_window(uuid,date,date),
  public.get_activity_progress(uuid) from public,anon,authenticated,service_role;
grant execute on function public.create_activity_baseline(uuid,date,date,numeric,numeric,numeric),
  public.save_daily_activity(date,integer,boolean,boolean),public.activity_window(uuid,date,date),
  public.get_activity_progress(uuid) to authenticated;
revoke all on function public.get_pilot_activity_summary() from public,anon,authenticated,service_role;
grant execute on function public.get_pilot_activity_summary() to authenticated;
commit;
