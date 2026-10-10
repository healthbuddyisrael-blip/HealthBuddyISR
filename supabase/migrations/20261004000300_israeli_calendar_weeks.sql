begin;

create or replace function public.coaching_week_start(p_date date)
returns date language sql immutable security invoker set search_path='' as $$
  select p_date - extract(dow from p_date)::integer
$$;

create or replace view public.weekly_activity with (security_invoker=true) as
select trainee_id,public.coaching_week_start(date) as week_start,
  avg(steps) as average_daily_steps,count(*) as step_days,
  count(strength_workout_completed) as strength_days,count(cardio_workout_completed) as cardio_days,
  case when count(strength_workout_completed)>0 then count(*) filter(where strength_workout_completed) end as strength_sessions,
  case when count(cardio_workout_completed)>0 then count(*) filter(where cardio_workout_completed) end as cardio_sessions
from public.daily_steps group by trainee_id,public.coaching_week_start(date);

-- Preserve any pre-migration Monday records verbatim. New records use Sunday;
-- legacy calls count in the Israeli week of the actual call, without deleting
-- or merging historical summaries when two legacy reports share a new week.
alter table public.weekly_coaching_checkins drop constraint weekly_coaching_checkins_week_start_check;
alter table public.weekly_coaching_checkins add constraint weekly_coaching_checkins_week_start_check
  check(isfinite(week_start) and extract(dow from week_start) in (0,1));
alter table public.weekly_coaching_checkins add column legacy_monday_week boolean
  generated always as (extract(dow from week_start)=1) stored;

create or replace function private.validate_weekly_checkin() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' and extract(dow from new.week_start)<>0 then
    raise exception 'New weeks must start on Sunday' using errcode='23514';
  end if;
  if tg_op='UPDATE' and (new.id is distinct from old.id or new.trainee_id is distinct from old.trainee_id
    or new.coach_id is distinct from old.coach_id or new.week_start is distinct from old.week_start
    or new.created_at is distinct from old.created_at) then
    raise exception 'Check-in identity is immutable' using errcode='23514';
  end if;
  if not exists(select 1 from public.coach_trainees ct join public.profiles p on p.id=ct.trainee_id
    join public.profiles c on c.id=ct.coach_id
    where ct.trainee_id=new.trainee_id and ct.coach_id=new.coach_id and p.role='trainee' and c.role='coach') then
    raise exception 'Assigned coach required' using errcode='42501';
  end if;
  if public.coaching_week_start(new.week_start)>public.coaching_week_start(public.business_date()) or new.call_date>public.business_date() then
    raise exception 'Future calls cannot be documented' using errcode='23514';
  end if;
  new.general_status:=btrim(new.general_status);
  new.difficulties:=btrim(new.difficulties);
  new.agreements:=btrim(new.agreements);
  new.next_week_goal:=btrim(new.next_week_goal);
  new.admin_attention_reason:=btrim(new.admin_attention_reason);
  return new;
end $$;

create or replace function public.save_weekly_checkin(p_trainee_id uuid,p_week_start date,p_call_completed boolean,p_call_date date,
  p_general_status text,p_difficulties text,p_agreements text,p_next_week_goal text,
  p_admin_attention_required boolean,p_admin_attention_reason text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if (select private.current_role()) is distinct from 'coach'::public.user_role or not private.is_assigned_trainee(p_trainee_id) then
    raise exception 'Assigned coach required' using errcode='42501';
  end if;
  if extract(dow from p_week_start)=1 then
    update public.weekly_coaching_checkins set call_completed=p_call_completed,call_date=p_call_date,
      general_status=p_general_status,difficulties=p_difficulties,agreements=p_agreements,next_week_goal=p_next_week_goal,
      admin_attention_required=p_admin_attention_required,admin_attention_reason=p_admin_attention_reason
      where trainee_id=p_trainee_id and week_start=p_week_start;
    if not found then raise exception 'New weeks must start on Sunday' using errcode='23514'; end if;
    return;
  end if;
  insert into public.weekly_coaching_checkins(trainee_id,coach_id,week_start,call_completed,call_date,
    general_status,difficulties,agreements,next_week_goal,admin_attention_required,admin_attention_reason)
  values(p_trainee_id,(select auth.uid()),p_week_start,p_call_completed,p_call_date,
    p_general_status,p_difficulties,p_agreements,p_next_week_goal,p_admin_attention_required,p_admin_attention_reason)
  on conflict(trainee_id,week_start) do update set call_completed=excluded.call_completed,call_date=excluded.call_date,
    general_status=excluded.general_status,difficulties=excluded.difficulties,agreements=excluded.agreements,
    next_week_goal=excluded.next_week_goal,admin_attention_required=excluded.admin_attention_required,
    admin_attention_reason=excluded.admin_attention_reason;
end $$;

create or replace view public.weekly_coaching_compliance with (security_invoker=true) as
select p.id as trainee_id,p.full_name as trainee_name,ct.coach_id,c.full_name as coach_name,
  w.week_start,w.week_start+6 as week_end,coalesce(h.call_completed,false) as call_completed,
  h.call_date,h.next_week_goal,h.admin_attention_required,h.admin_attention_reason,h.id as checkin_id
from public.profiles p
left join public.coach_trainees ct on ct.trainee_id=p.id
left join public.profiles c on c.id=ct.coach_id
left join public.activity_baselines b on b.trainee_id=p.id
cross join lateral (
  select d::date as week_start from generate_series(
    public.coaching_week_start(coalesce(b.program_start,public.business_date(p.created_at)))::timestamp,
    public.coaching_week_start(least(coalesce(b.program_end,public.business_date()),public.business_date()))::timestamp,
    interval '7 days') d
) w
left join lateral (
  select r.* from public.weekly_coaching_checkins r where r.trainee_id=p.id
    and public.coaching_week_start(coalesce(r.call_date,r.week_start))=w.week_start
  order by r.call_completed desc,r.call_date desc nulls last,r.week_start desc limit 1
) h on true
where p.role='trainee' and coalesce(b.program_start,public.business_date(p.created_at))<=public.business_date()
  and ((select private.current_role())='admin' or
    ((select private.current_role())='coach' and private.is_assigned_trainee(p.id)));

-- Keep the existing authorization, pagination and summary queries; change only
-- their week validation and the placement/order of grandfathered call reports.
do $$
declare v_sql text;
begin
  v_sql:=pg_get_functiondef('public.get_weekly_coaching_overview(date,text,integer)'::regprocedure);
  v_sql:=replace(v_sql,'extract(isodow from p_week_start)<>1','extract(dow from p_week_start)<>0');
  v_sql:=replace(v_sql,'h.week_start<=p_week_start','public.coaching_week_start(coalesce(h.call_date,h.week_start))<=p_week_start');
  v_sql:=replace(v_sql,'order by h.week_start desc limit 1','order by public.coaching_week_start(coalesce(h.call_date,h.week_start)) desc,h.call_date desc nulls last,h.week_start desc limit 1');
  execute v_sql;
  v_sql:=pg_get_functiondef('public.get_weekly_call_history(uuid,integer)'::regprocedure);
  v_sql:=replace(v_sql,'where week_start=public.coaching_week_start(public.business_date())',
    'where public.coaching_week_start(coalesce(call_date,week_start))=public.coaching_week_start(public.business_date()) order by call_completed desc,call_date desc nulls last,week_start desc limit 1');
  v_sql:=replace(v_sql,'order by week_start desc limit 1','order by public.coaching_week_start(coalesce(call_date,week_start)) desc,call_date desc nulls last,week_start desc limit 1');
  execute v_sql;
end $$;
comment on table public.weekly_coaching_checkins is
  'One documented personal call per Israeli Sunday-Saturday week. Pre-migration Monday records retain their original identity and dates; their actual call dates determine compliance.';
commit;
