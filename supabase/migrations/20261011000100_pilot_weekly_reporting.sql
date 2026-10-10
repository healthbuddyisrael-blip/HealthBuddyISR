begin;

-- Explicit enrollment: no existing participant is silently moved to the pilot.
create table public.pilot_participants (
  trainee_id uuid primary key references public.profiles(id) on delete restrict,
  starts_on date not null check(isfinite(starts_on) and extract(dow from starts_on)=0),
  ends_on date check(isfinite(ends_on)),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check(ends_on is null or ends_on>=starts_on)
);
alter table public.pilot_participants enable row level security;
revoke all on public.pilot_participants from public,anon,authenticated,service_role;
grant select on public.pilot_participants to authenticated;
create policy pilot_members_read on public.pilot_participants for select to authenticated using (
  trainee_id=(select auth.uid()) or private.is_assigned_trainee(trainee_id) or (select private.current_role())='admin'
);

create table public.pilot_weekly_reports (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.pilot_participants(trainee_id) on delete restrict,
  coach_id uuid not null references public.profiles(id) on delete restrict,
  week_start date not null check(isfinite(week_start) and extract(dow from week_start)=0),
  week_end date generated always as (week_start+6) stored,
  source text not null default 'manual_coach' check(source='manual_coach'),
  status text not null default 'draft' check(status in ('draft','submitted')),
  average_daily_steps numeric(12,2) check(average_daily_steps between 0 and 2147483647),
  strength_workouts integer check(strength_workouts>=0),
  aerobic_workouts integer check(aerobic_workouts>=0),
  screenshot_path text unique,
  call_completed boolean not null default false,
  call_date date check(isfinite(call_date)),
  general_feeling text not null default '' check(length(general_feeling)<=500),
  difficulties text not null default '' check(length(difficulties)<=500),
  progress text not null default '' check(length(progress)<=500),
  agreements text not null default '' check(length(agreements)<=500),
  next_week_goal text not null default '' check(length(next_week_goal)<=500),
  attention_required boolean not null default false,
  previous_goal_met boolean,
  revision integer not null default 1 check(revision>0),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(trainee_id,week_start),
  check((call_completed and call_date is not null and call_date>=week_start+7) or (not call_completed and call_date is null)),
  check(status='draft' or (call_completed and average_daily_steps is not null and strength_workouts is not null
    and aerobic_workouts is not null and screenshot_path is not null and submitted_at is not null
    and length(btrim(general_feeling))>0 and length(btrim(difficulties))>0 and length(btrim(progress))>0
    and length(btrim(agreements))>0 and length(btrim(next_week_goal))>0))
);
create index pilot_reports_coach_week on public.pilot_weekly_reports(coach_id,week_start);
alter table public.pilot_weekly_reports enable row level security;
revoke all on public.pilot_weekly_reports from public,anon,authenticated,service_role;
grant select on public.pilot_weekly_reports to authenticated;
create policy pilot_reports_read on public.pilot_weekly_reports for select to authenticated using (
  (select private.current_role())='admin' or private.is_assigned_trainee(trainee_id)
  or (trainee_id=(select auth.uid()) and status='submitted')
);

create function public.set_pilot_enrollment(p_trainee_id uuid,p_starts_on date,p_ends_on date default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (select private.current_role()) is distinct from 'admin'::public.user_role then
    raise exception 'Admin required' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=p_trainee_id and role='trainee') then
    raise exception 'Participant required' using errcode='23514';
  end if;
  perform 1 from public.pilot_participants where trainee_id=p_trainee_id for update;
  if exists(select 1 from public.pilot_weekly_reports where trainee_id=p_trainee_id and
    (week_start<p_starts_on or (p_ends_on is not null and week_start>p_ends_on))) then
    raise exception 'Enrollment must retain historical reports' using errcode='23514';
  end if;
  insert into public.pilot_participants(trainee_id,starts_on,ends_on,created_by)
  values(p_trainee_id,p_starts_on,p_ends_on,(select auth.uid()))
  on conflict(trainee_id) do update set starts_on=excluded.starts_on,ends_on=excluded.ends_on;
end $$;

-- Caller-bound Storage check. Never accept arbitrary user identity parameters.
create function private.pilot_screenshot_access(p_name text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_id uuid; v_week date;
begin
  if p_name is null or p_name !~ '^[0-9a-f-]{36}/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]{36}\.(png|jpg|webp)$' then return false; end if;
  begin
    v_id:=split_part(p_name,'/',1)::uuid;
    v_week:=split_part(p_name,'/',2)::date;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then return false;
  end;
  return exists(select 1 from public.pilot_participants where trainee_id=v_id and starts_on<=v_week
    and (ends_on is null or ends_on>=v_week)) and extract(dow from v_week)=0
    and v_week+6<public.business_date()
    and ((select private.current_role())='admin' or ((select private.current_role())='coach' and private.is_assigned_trainee(v_id)));
end $$;
revoke all on function private.pilot_screenshot_access(text) from public,anon,service_role;
grant execute on function private.pilot_screenshot_access(text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pilot-step-evidence','pilot-step-evidence',false,3145728,array['image/png','image/jpeg','image/webp']);
create policy pilot_evidence_read on storage.objects for select to authenticated using (
  bucket_id='pilot-step-evidence' and private.pilot_screenshot_access(name)
);
create policy pilot_evidence_insert on storage.objects for insert to authenticated with check (
  bucket_id='pilot-step-evidence' and (select private.current_role())='coach' and private.pilot_screenshot_access(name)
);
-- No overwrite policy: replacements get unique paths. Referenced files cannot be removed.
create policy pilot_evidence_delete on storage.objects for delete to authenticated using (
  bucket_id='pilot-step-evidence' and private.pilot_screenshot_access(name)
  and not exists(select 1 from public.pilot_weekly_reports where screenshot_path=name)
);

create function public.save_pilot_weekly_report(p_report jsonb,p_expected_revision integer default null)
returns public.pilot_weekly_reports language plpgsql security definer set search_path='' as $$
declare v public.pilot_weekly_reports; old_row public.pilot_weekly_reports; v_path text;
begin
  v.trainee_id:=(p_report->>'trainee_id')::uuid;
  v.week_start:=(p_report->>'week_start')::date;
  if (select private.current_role()) is distinct from 'coach'::public.user_role then
    raise exception 'Coach required' using errcode='42501';
  end if;
  -- Lock assignment and enrollment against concurrent reassignment/configuration.
  perform 1 from public.coach_trainees where trainee_id=v.trainee_id and coach_id=(select auth.uid()) for share;
  if not found then raise exception 'Assigned coach required' using errcode='42501'; end if;
  perform 1 from public.pilot_participants where trainee_id=v.trainee_id and starts_on<=v.week_start
    and (ends_on is null or ends_on>=v.week_start) for share;
  if not found then raise exception 'Pilot period required' using errcode='23514'; end if;
  if v.week_start+6>=public.business_date() then raise exception 'Completed week required' using errcode='23514'; end if;
  select * into old_row from public.pilot_weekly_reports where trainee_id=v.trainee_id and week_start=v.week_start for update;
  if (found and p_expected_revision is distinct from old_row.revision) or (not found and p_expected_revision is not null) then
    raise exception 'Report changed; reload before editing' using errcode='40001';
  end if;
  v.coach_id:=(select auth.uid());
  v.status:=p_report->>'status';
  v.average_daily_steps:=nullif(p_report->>'average_daily_steps','')::numeric;
  v.strength_workouts:=nullif(p_report->>'strength_workouts','')::integer;
  v.aerobic_workouts:=nullif(p_report->>'aerobic_workouts','')::integer;
  v.screenshot_path:=nullif(p_report->>'screenshot_path','');
  if v.screenshot_path is not null then
    if split_part(v.screenshot_path,'/',1)<>v.trainee_id::text or split_part(v.screenshot_path,'/',2)<>v.week_start::text
      or not private.pilot_screenshot_access(v.screenshot_path)
      or not exists(select 1 from storage.objects where bucket_id='pilot-step-evidence' and name=v.screenshot_path) then
      raise exception 'Valid uploaded screenshot for this week required' using errcode='23514';
    end if;
  end if;
  v.call_completed:=coalesce((p_report->>'call_completed')::boolean,false);
  v.call_date:=nullif(p_report->>'call_date','')::date;
  if v.call_date>public.business_date() then raise exception 'Future conversation' using errcode='23514'; end if;
  v.general_feeling:=btrim(coalesce(p_report->>'general_feeling',''));
  v.difficulties:=btrim(coalesce(p_report->>'difficulties',''));
  v.progress:=btrim(coalesce(p_report->>'progress',''));
  v.agreements:=btrim(coalesce(p_report->>'agreements',''));
  v.next_week_goal:=btrim(coalesce(p_report->>'next_week_goal',''));
  v.attention_required:=coalesce((p_report->>'attention_required')::boolean,false);
  v.previous_goal_met:=(p_report->>'previous_goal_met')::boolean;
  if old_row.id is null then
    insert into public.pilot_weekly_reports(trainee_id,coach_id,week_start,status,average_daily_steps,strength_workouts,aerobic_workouts,
      screenshot_path,call_completed,call_date,general_feeling,difficulties,progress,agreements,next_week_goal,attention_required,previous_goal_met,submitted_at)
    values(v.trainee_id,v.coach_id,v.week_start,v.status,v.average_daily_steps,v.strength_workouts,v.aerobic_workouts,v.screenshot_path,
      v.call_completed,v.call_date,v.general_feeling,v.difficulties,v.progress,v.agreements,v.next_week_goal,v.attention_required,v.previous_goal_met,
      case when v.status='submitted' then now() end)
    on conflict(trainee_id,week_start) do nothing returning * into v;
    if v.id is null then raise exception 'Concurrent report creation; reload' using errcode='40001'; end if;
  else
    update public.pilot_weekly_reports set coach_id=v.coach_id,status=v.status,average_daily_steps=v.average_daily_steps,
      strength_workouts=v.strength_workouts,aerobic_workouts=v.aerobic_workouts,screenshot_path=v.screenshot_path,
      call_completed=v.call_completed,call_date=v.call_date,general_feeling=v.general_feeling,difficulties=v.difficulties,
      progress=v.progress,agreements=v.agreements,next_week_goal=v.next_week_goal,attention_required=v.attention_required,
      previous_goal_met=v.previous_goal_met,
      revision=revision+1,updated_at=now(),submitted_at=case when v.status='submitted' then now() end
      where id=old_row.id returning * into v;
  end if;
  return v;
end $$;

-- Alternative sources, never additive. Preserve the old view and raw reports.
create view public.pilot_weekly_figures with(security_invoker=true) as
select coalesce(r.trainee_id,d.trainee_id) as trainee_id,coalesce(r.week_start,d.week_start) as week_start,
  case when r.id is not null then r.average_daily_steps else d.average_daily_steps end as average_daily_steps,
  case when r.id is not null then r.strength_workouts else d.strength_sessions end as strength_workouts,
  case when r.id is not null then r.aerobic_workouts else d.cardio_sessions end as aerobic_workouts,
  case when r.id is not null then 'manual_coach' else 'historical_daily' end as source,
  case when r.id is not null then 7 else d.step_days end as step_days
from public.weekly_activity d full join (select * from public.pilot_weekly_reports where status='submitted') r
  on r.trainee_id=d.trainee_id and r.week_start=d.week_start;
revoke all on public.pilot_weekly_figures from public,anon,authenticated,service_role;
grant select on public.pilot_weekly_figures to authenticated;

create function public.get_pilot_week_overview(p_week_start date,p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if (select private.current_role()) not in ('admin','coach') or (select private.current_role()) is null then
    raise exception 'Coach or admin required' using errcode='42501';
  end if;
  if p_week_start is null or not isfinite(p_week_start) or extract(dow from p_week_start)<>0
    or p_week_start+6>=public.business_date() or p_page is null or p_page<1 then
    raise exception 'Completed reporting week required' using errcode='22023';
  end if;
  with facts as materialized (
    select m.trainee_id,p.full_name as trainee_name,ct.coach_id,c.full_name as coach_name,
      coalesce(r.status,'missing') as status,coalesce(r.call_completed,false) as call_completed,r.call_date,
      (select max(call_date) from public.pilot_weekly_reports where trainee_id=m.trainee_id and call_completed and week_start<=p_week_start) as last_call_date,
      f.average_daily_steps,f.strength_workouts,f.aerobic_workouts,f.source,
      coalesce(r.next_week_goal,(select next_week_goal from public.pilot_weekly_reports where trainee_id=m.trainee_id and status='submitted' and week_start<p_week_start order by week_start desc limit 1)) as next_week_goal,
      r.difficulties,coalesce(r.attention_required,false) as attention_required,r.previous_goal_met,
      f.average_daily_steps-(select average_daily_steps from public.pilot_weekly_figures
        where trainee_id=m.trainee_id and week_start=p_week_start-7) as step_change,
      (select count(*) from (select previous_goal_met from public.pilot_weekly_reports
        where trainee_id=m.trainee_id and week_start<=p_week_start and status='submitted' order by week_start desc limit 4) recent
        where previous_goal_met) as goals_met_recent,
      public.business_date()>p_week_start+7 and coalesce(r.status,'missing')<>'submitted' as overdue
    from public.pilot_participants m join public.profiles p on p.id=m.trainee_id
    left join public.coach_trainees ct on ct.trainee_id=m.trainee_id left join public.profiles c on c.id=ct.coach_id
    left join public.pilot_weekly_reports r on r.trainee_id=m.trainee_id and r.week_start=p_week_start
    left join public.pilot_weekly_figures f on f.trainee_id=m.trainee_id and f.week_start=p_week_start
    where m.starts_on<=p_week_start and (m.ends_on is null or m.ends_on>=p_week_start)
      and ((select private.current_role())='admin' or private.is_assigned_trainee(m.trainee_id))
  ), coaches as (select coach_id,max(coach_name) as coach_name,count(*) as participants,
    count(*) filter(where status='submitted') as submitted,count(*) filter(where call_completed) as conversations
    from facts where coach_id is not null group by coach_id), page as (
    select * from facts order by overdue desc,trainee_name,trainee_id limit 25 offset (p_page::bigint-1)*25
  )
  select jsonb_build_object('week_start',p_week_start,'week_end',p_week_start+6,
    'total',(select count(*) from facts),'summary',(select jsonb_build_object(
      'participants',count(*),'submitted',count(*) filter(where status='submitted'),
      'missing',count(*) filter(where status<>'submitted'),'conversations',count(*) filter(where call_completed),
      'pending_conversations',count(*) filter(where not call_completed),'overdue',count(*) filter(where overdue),
      'completion_rate',100.0*(count(*) filter(where status='submitted'))/nullif(count(*),0)) from facts),
    'coaches',coalesce((select jsonb_agg(to_jsonb(coaches) order by coach_name) from coaches),'[]'::jsonb),
    'participants',coalesce((select jsonb_agg(to_jsonb(page) order by overdue desc,trainee_name,trainee_id) from page),'[]'::jsonb)) into result;
  return result;
end $$;

-- Pilot enrollment removes the obligation to enter daily reports. Keep all
-- prior records and all non-pilot write behavior. Enforce at DB as well as UI.
create function private.pilot_daily_write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (select private.current_role())='trainee' and exists(select 1 from public.pilot_participants
    where trainee_id=new.trainee_id and starts_on<=new.date and (ends_on is null or ends_on>=new.date)) then
    raise exception 'Coach weekly reporting is active for this period' using errcode='42501';
  end if;
  return new;
end $$;
create trigger pilot_daily_write_guard before insert or update on public.daily_steps
  for each row execute function private.pilot_daily_write_guard();
revoke all on function private.pilot_daily_write_guard() from public,anon,authenticated,service_role;
revoke all on function public.set_pilot_enrollment(uuid,date,date),public.save_pilot_weekly_report(jsonb,integer),
  public.get_pilot_week_overview(date,integer) from public,anon,authenticated,service_role;
grant execute on function public.set_pilot_enrollment(uuid,date,date),public.save_pilot_weekly_report(jsonb,integer),
  public.get_pilot_week_overview(date,integer) to authenticated;
commit;
