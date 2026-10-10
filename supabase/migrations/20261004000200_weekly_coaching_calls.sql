begin;

create function public.coaching_week_start(p_date date)
returns date language sql immutable security invoker set search_path='' as $$
  select date_trunc('week',p_date)::date
$$;

create table public.weekly_coaching_checkins (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete restrict,
  week_start date not null check (isfinite(week_start) and extract(isodow from week_start)=1),
  week_end date generated always as (week_start+6) stored,
  call_completed boolean not null default false,
  call_date date check (isfinite(call_date)),
  general_status text not null default '' check (length(general_status)<=500),
  difficulties text not null default '' check (length(difficulties)<=500),
  agreements text not null default '' check (length(agreements)<=500),
  next_week_goal text not null default '' check (length(next_week_goal)<=500),
  admin_attention_required boolean not null default false,
  admin_attention_reason text not null default '' check (length(admin_attention_reason)<=300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trainee_id,week_start),
  check ((call_completed and call_date is not null and call_date between week_start and week_start+6
    and length(btrim(general_status))>0 and length(btrim(difficulties))>0
    and length(btrim(agreements))>0 and length(btrim(next_week_goal))>0)
    or (not call_completed and call_date is null)),
  check (admin_attention_required or admin_attention_reason='')
);
create index weekly_checkins_coach_week_idx on public.weekly_coaching_checkins(coach_id,week_start);
create index weekly_checkins_week_idx on public.weekly_coaching_checkins(week_start);
create index weekly_checkins_attention_idx on public.weekly_coaching_checkins(trainee_id,week_start desc)
  where admin_attention_required;
comment on table public.weekly_coaching_checkins is
  'One personal phone call with four short notes per trainee/Monday-Sunday week. False rows are drafts, never compliant. No messaging KPI.';

alter table public.weekly_coaching_checkins enable row level security;
revoke all on public.weekly_coaching_checkins from public,anon,authenticated,service_role;
grant select on public.weekly_coaching_checkins to authenticated;
grant insert(trainee_id,coach_id,week_start,call_completed,call_date,general_status,difficulties,agreements,
  next_week_goal,admin_attention_required,admin_attention_reason),
  update(call_completed,call_date,general_status,difficulties,agreements,next_week_goal,admin_attention_required,admin_attention_reason)
  on public.weekly_coaching_checkins to authenticated;
create policy weekly_checkins_read on public.weekly_coaching_checkins for select to authenticated using (
  (select private.current_role())='admin' or
  ((select private.current_role())='coach' and private.is_assigned_trainee(trainee_id))
);
create policy weekly_checkins_insert on public.weekly_coaching_checkins for insert to authenticated with check (
  (select private.current_role())='coach' and coach_id=(select auth.uid()) and private.is_assigned_trainee(trainee_id)
);
create policy weekly_checkins_update on public.weekly_coaching_checkins for update to authenticated
  using ((select private.current_role())='coach' and coach_id=(select auth.uid()) and private.is_assigned_trainee(trainee_id))
  with check ((select private.current_role())='coach' and coach_id=(select auth.uid()) and private.is_assigned_trainee(trainee_id));

create function private.validate_weekly_checkin() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
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
  if new.week_start>public.coaching_week_start(public.business_date()) or new.call_date>public.business_date() then
    raise exception 'Future calls cannot be documented' using errcode='23514';
  end if;
  new.general_status:=btrim(new.general_status);
  new.difficulties:=btrim(new.difficulties);
  new.agreements:=btrim(new.agreements);
  new.next_week_goal:=btrim(new.next_week_goal);
  new.admin_attention_reason:=btrim(new.admin_attention_reason);
  return new;
end $$;
create trigger weekly_checkins_validate before insert or update on public.weekly_coaching_checkins
  for each row execute function private.validate_weekly_checkin();
create trigger weekly_checkins_updated_at before update on public.weekly_coaching_checkins
  for each row execute function private.set_updated_at();
revoke all on function private.validate_weekly_checkin() from public,anon,authenticated,service_role;

create function public.save_weekly_checkin(p_trainee_id uuid,p_week_start date,p_call_completed boolean,p_call_date date,
  p_general_status text,p_difficulties text,p_agreements text,p_next_week_goal text,
  p_admin_attention_required boolean,p_admin_attention_reason text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if (select private.current_role()) is distinct from 'coach'::public.user_role or not private.is_assigned_trainee(p_trainee_id) then
    raise exception 'Assigned coach required' using errcode='42501';
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

create function public.get_weekly_call_history(p_trainee_id uuid,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if not coalesce((select private.current_role())='admin' or
    ((select private.current_role())='coach' and private.is_assigned_trainee(p_trainee_id)),false) then
    raise exception 'Authorized coach or admin required' using errcode='42501';
  end if;
  if p_page is null or p_page<1 then raise exception 'Invalid page' using errcode='22023'; end if;
  with history as (select * from public.weekly_coaching_checkins where trainee_id=p_trainee_id),
  page as (select * from history order by week_start desc limit 25 offset (p_page::bigint-1)*25)
  select jsonb_build_object('total',(select count(*) from history),
    'current',(select to_jsonb(h) from history h where week_start=public.coaching_week_start(public.business_date())),
    'reports',coalesce((select jsonb_agg(to_jsonb(h) order by week_start desc) from page h),'[]'::jsonb),
    'current_goal',(select next_week_goal from history where call_completed order by week_start desc limit 1),
    'current_expected',exists(select 1 from public.profiles p left join public.activity_baselines b on b.trainee_id=p.id
      where p.id=p_trainee_id and p.role='trainee'
        and coalesce(b.program_start,public.business_date(p.created_at))<=public.business_date()
        and coalesce(b.program_end,public.business_date())>=public.coaching_week_start(public.business_date())),
    'recent_activity',(select to_jsonb(w) from public.activity_window(p_trainee_id,public.business_date()-6,public.business_date()) w),
    'step_target',public.get_step_target(p_trainee_id,public.business_date())) into v_result;
  return v_result;
end $$;

-- Explicit expected-week facts, independent of whether a trainee reported any
-- activity. Invoker view also supports historical cohort analytics without API caps.
create view public.weekly_coaching_compliance with (security_invoker=true) as
select p.id as trainee_id,p.full_name as trainee_name,ct.coach_id,c.full_name as coach_name,
  w.week_start, w.week_start+6 as week_end,coalesce(h.call_completed,false) as call_completed,
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
left join public.weekly_coaching_checkins h on h.trainee_id=p.id and h.week_start=w.week_start
where p.role='trainee' and coalesce(b.program_start,public.business_date(p.created_at))<=public.business_date()
  and ((select private.current_role())='admin' or
    ((select private.current_role())='coach' and private.is_assigned_trainee(p.id)));

create function public.get_weekly_coaching_overview(p_week_start date default public.coaching_week_start(public.business_date()),
  p_filter text default 'all',p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if (select private.current_role()) is distinct from 'admin'::public.user_role then
    raise exception 'Admin required' using errcode='42501';
  end if;
  if p_week_start is null or not isfinite(p_week_start) or extract(isodow from p_week_start)<>1
    or p_week_start>public.coaching_week_start(public.business_date()) or p_filter is null
    or p_filter not in ('all','missing','attention','completed') or p_page is null or p_page<1 then
    raise exception 'Invalid weekly query' using errcode='22023';
  end if;
  with facts as materialized (
    select f.*,last_call.call_date as last_call_date,goal.next_week_goal as current_goal,
      attention.week_start as attention_week,attention.admin_attention_reason as attention_reason,
      attention.id as attention_checkin_id,public.get_step_target(f.trainee_id,least(p_week_start+6,public.business_date())) as step_target,
      exists(select 1 from public.weekly_coaching_compliance previous where previous.trainee_id=f.trainee_id
        and previous.week_start<p_week_start and not previous.call_completed) as prior_call_overdue,
      greatest(0,least(p_week_start+6,public.business_date())-greatest(coalesce(b.program_start,public.business_date(p.created_at)),least(p_week_start+6,public.business_date())-6)+1)
        -(select count(*) from public.daily_steps s where s.trainee_id=f.trainee_id and s.date between
          greatest(coalesce(b.program_start,public.business_date(p.created_at)),least(p_week_start+6,public.business_date())-6)
          and least(p_week_start+6,public.business_date())) as missing_report_days
    from public.weekly_coaching_compliance f
    join public.profiles p on p.id=f.trainee_id
    left join public.activity_baselines b on b.trainee_id=f.trainee_id
    left join lateral (select h.call_date from public.weekly_coaching_checkins h where h.trainee_id=f.trainee_id
      and h.call_completed and h.week_start<=p_week_start order by h.call_date desc limit 1) last_call on true
    left join lateral (select h.next_week_goal from public.weekly_coaching_checkins h where h.trainee_id=f.trainee_id
      and h.call_completed and h.week_start<=p_week_start order by h.week_start desc limit 1) goal on true
    left join lateral (select h.id,h.week_start,h.admin_attention_reason from public.weekly_coaching_checkins h
      where h.trainee_id=f.trainee_id and h.admin_attention_required and h.week_start<=p_week_start order by h.week_start desc limit 1) attention on true
    where f.week_start=p_week_start
  ), marked as materialized (
    select f.*,not call_completed as call_missing,
      (not call_completed and week_end<public.business_date()) as call_overdue,
      not call_completed or prior_call_overdue or coach_id is null or attention_week is not null or missing_report_days>=3 as needs_attention
    from facts f
  ), matched as (
    select * from marked where p_filter='all' or (p_filter='missing' and call_missing)
      or (p_filter='completed' and call_completed) or (p_filter='attention' and needs_attention)
  ), page as (
    select * from matched order by needs_attention desc,call_missing desc,trainee_name,trainee_id
    limit 25 offset (p_page::bigint-1)*25
  )
  select jsonb_build_object('week_start',p_week_start,'week_end',p_week_start+6,
    'summary',jsonb_build_object('active_trainees',(select count(*) from marked),
      'calls_completed',(select count(*) from marked where call_completed),
      'calls_missing',(select count(*) from marked where call_missing),
      'attention_cases',(select count(*) from marked where needs_attention),
      'compliance_percentage',(select 100.0*(count(*) filter(where call_completed))/nullif(count(*),0) from marked)),
    'total',(select count(*) from matched),
    'trainees',coalesce((select jsonb_agg(to_jsonb(f) order by needs_attention desc,call_missing desc,trainee_name,trainee_id) from page f),'[]'::jsonb))
  into v_result;
  return v_result;
end $$;

revoke all on public.weekly_coaching_compliance from public,anon,authenticated,service_role;
grant select on public.weekly_coaching_compliance to authenticated;
revoke all on function public.coaching_week_start(date),
  public.save_weekly_checkin(uuid,date,boolean,date,text,text,text,text,boolean,text),
  public.get_weekly_call_history(uuid,integer),public.get_weekly_coaching_overview(date,text,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.coaching_week_start(date),
  public.save_weekly_checkin(uuid,date,boolean,date,text,text,text,text,boolean,text),
  public.get_weekly_call_history(uuid,integer),public.get_weekly_coaching_overview(date,text,integer) to authenticated;
commit;
