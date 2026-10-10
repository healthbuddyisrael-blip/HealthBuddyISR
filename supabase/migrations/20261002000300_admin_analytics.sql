begin;

-- Shared admin-only facts. SQL date boundaries always use the business timezone.
create function private.admin_trainee_metrics(p_range_days integer, p_coach_id uuid default null, p_trainee_id uuid default null)
returns table(trainee_id uuid,coach_id uuid,full_name text,email text,today_steps integer,today_target integer,last_reported_date date,
 active boolean,reported_days bigint,expected_days bigint,eligible_reported_days bigint,target_reached_days bigint,completion_sum numeric)
language plpgsql stable security invoker set search_path='' as $$
begin
  if (select private.current_role()) is distinct from 'admin'::public.user_role then
    raise exception 'Admin membership required' using errcode='42501';
  end if;
  if p_range_days is null or p_range_days not in (7,30) then
    raise exception 'Invalid range' using errcode='22023';
  end if;
  return query
  with bounds as (select public.business_date() as today,public.business_date()-(p_range_days-1) as start_date),
  trainees as (
    select p.id,p.full_name,p.email,ct.coach_id,
      case when ct.created_at is not null and first_target.date is not null then
        greatest(w.start_date,public.business_date(ct.created_at),first_target.date) end as eligibility_start,
      w.today,w.start_date
    from public.profiles p cross join bounds w
    left join public.coach_trainees ct on ct.trainee_id=p.id
    left join lateral (select min(t.effective_from) as date from public.step_targets t where t.trainee_id=p.id) first_target on true
    where p.role='trainee' and (p_coach_id is null or ct.coach_id=p_coach_id) and (p_trainee_id is null or p.id=p_trainee_id)
  )
  select p.id,p.coach_id,p.full_name,p.email,current_report.steps,current_target.target_steps,last_report.date,
    facts.all_reports>0,facts.reported,
    case when p.eligibility_start is null then 0::bigint else greatest(0,p.today-p.eligibility_start+1)::bigint end,
    facts.eligible,facts.reached,facts.completion_sum
  from trainees p
  left join public.daily_steps current_report on current_report.trainee_id=p.id and current_report.date=p.today
  left join lateral (select t.target_steps from public.step_targets t where t.trainee_id=p.id and t.effective_from<=p.today order by t.effective_from desc limit 1) current_target on true
  left join lateral (select s.date from public.daily_steps s where s.trainee_id=p.id order by s.date desc limit 1) last_report on true
  cross join lateral (
    select count(*) as all_reports,
      count(*) filter(where target.target_steps>0 and s.date>=p.eligibility_start) as reported,
      count(*) filter(where target.target_steps>0) as eligible,
      count(*) filter(where target.target_steps>0 and s.steps>=target.target_steps) as reached,
      coalesce(sum(s.steps::numeric*100/nullif(target.target_steps,0)) filter(where target.target_steps>0),0) as completion_sum
    from public.daily_steps s
    left join lateral (select t.target_steps from public.step_targets t where t.trainee_id=p.id and t.effective_from<=s.date order by t.effective_from desc limit 1) target on true
    where s.trainee_id=p.id and s.date between p.start_date and p.today
  ) facts;
end;
$$;
revoke all on function private.admin_trainee_metrics(integer,uuid,uuid) from public,anon,service_role,supabase_auth_admin;
grant execute on function private.admin_trainee_metrics(integer,uuid,uuid) to authenticated;

-- Counts and raw completion sums are combined BEFORE division. No averages of
-- trainee/coach percentages and no integer division or visual progress clamp.
create function private.admin_metric_values(p_trainees bigint,p_active bigint,p_reported bigint,p_expected bigint,p_eligible bigint,p_reached bigint,p_completion_sum numeric)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('trainee_count',p_trainees,'active_trainee_count',p_active,
   'reported_days',p_reported,'expected_days',p_expected,'eligible_reported_days',p_eligible,'target_reached_days',p_reached,
   'reporting_rate',p_reported::numeric*100/nullif(p_expected,0),
   'target_attainment_rate',p_reached::numeric*100/nullif(p_eligible,0),
   'average_completion',p_completion_sum/nullif(p_eligible,0))
$$;
revoke all on function private.admin_metric_values(bigint,bigint,bigint,bigint,bigint,bigint,numeric) from public,anon,service_role,supabase_auth_admin;
grant execute on function private.admin_metric_values(bigint,bigint,bigint,bigint,bigint,bigint,numeric) to authenticated;

create function public.get_admin_coach_analytics(p_range_days integer default 7,p_search text default '',p_page integer default 1)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if (select private.current_role()) is distinct from 'admin'::public.user_role then raise exception 'Admin membership required' using errcode='42501'; end if;
  if p_range_days is null or p_range_days not in (7,30) or p_page is null or p_page<1 or p_search is null or length(p_search)>200 then raise exception 'Invalid query' using errcode='22023'; end if;
  with facts as materialized (select * from private.admin_trainee_metrics(p_range_days)),
  coaches as materialized (select p.id,p.full_name,p.email from public.profiles p where p.role='coach' and (p_search='' or strpos(lower(p.full_name),lower(btrim(p_search)))>0 or strpos(lower(p.email),lower(btrim(p_search)))>0)),
  page as (select * from coaches order by full_name,id limit 25 offset (p_page::bigint-1)*25),
  coach_rows as (
    select p.id,p.full_name,jsonb_build_object('coach_id',p.id,'full_name',p.full_name,'email',p.email) ||
      private.admin_metric_values(count(f.trainee_id),count(f.trainee_id) filter(where f.active),coalesce(sum(f.reported_days),0)::bigint,coalesce(sum(f.expected_days),0)::bigint,coalesce(sum(f.eligible_reported_days),0)::bigint,coalesce(sum(f.target_reached_days),0)::bigint,coalesce(sum(f.completion_sum),0)) as value
    from page p left join facts f on f.coach_id=p.id group by p.id,p.full_name,p.email
  ), summary as (
    select private.admin_metric_values(count(*),count(*) filter(where active),coalesce(sum(reported_days),0)::bigint,coalesce(sum(expected_days),0)::bigint,coalesce(sum(eligible_reported_days),0)::bigint,coalesce(sum(target_reached_days),0)::bigint,coalesce(sum(completion_sum),0)) as value from facts
  )
  select jsonb_build_object('today',public.business_date(),'range_days',p_range_days,
    'summary',(select value from summary)||jsonb_build_object('coach_count',(select count(*) from public.profiles where role='coach')),
    'total',(select count(*) from coaches),'coaches',coalesce((select jsonb_agg(value order by full_name,id) from coach_rows),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;

create function public.get_admin_coach_detail(p_coach_id uuid,p_range_days integer default 7,p_page integer default 1,p_search text default '')
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_coach public.profiles%rowtype; v_result jsonb;
begin
  if (select private.current_role()) is distinct from 'admin'::public.user_role then raise exception 'Admin membership required' using errcode='42501'; end if;
  if p_range_days is null or p_range_days not in (7,30) or p_page is null or p_page<1 or p_search is null or length(p_search)>200 then raise exception 'Invalid query' using errcode='22023'; end if;
  select * into v_coach from public.profiles where id=p_coach_id and role='coach';
  if not found then return null; end if;
  with facts as materialized (select * from private.admin_trainee_metrics(p_range_days,p_coach_id)),
  matched as (select * from facts where p_search='' or strpos(lower(full_name),lower(btrim(p_search)))>0 or strpos(lower(email),lower(btrim(p_search)))>0),
  page as (select * from matched order by full_name,trainee_id limit 25 offset (p_page::bigint-1)*25),
  summary as (select private.admin_metric_values(count(*),count(*) filter(where active),coalesce(sum(reported_days),0)::bigint,coalesce(sum(expected_days),0)::bigint,coalesce(sum(eligible_reported_days),0)::bigint,coalesce(sum(target_reached_days),0)::bigint,coalesce(sum(completion_sum),0)) as value from facts)
  select jsonb_build_object('today',public.business_date(),'range_days',p_range_days,
    'coach',jsonb_build_object('coach_id',v_coach.id,'full_name',v_coach.full_name,'email',v_coach.email)||(select value from summary),
    'total',(select count(*) from matched),'trainees',coalesce((select jsonb_agg(jsonb_build_object('trainee_id',p.trainee_id,'full_name',p.full_name,'today_steps',p.today_steps,'today_target',p.today_target,'last_reported_date',p.last_reported_date)||private.admin_metric_values(1,case when p.active then 1 else 0 end,p.reported_days,p.expected_days,p.eligible_reported_days,p.target_reached_days,p.completion_sum) order by p.full_name,p.trainee_id) from page p),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;

create function public.get_admin_trainee_analytics(p_coach_id uuid,p_trainee_id uuid,p_range_days integer default 7)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
  if (select private.current_role()) is distinct from 'admin'::public.user_role then raise exception 'Admin membership required' using errcode='42501'; end if;
  if p_range_days is null or p_range_days not in (7,30) then raise exception 'Invalid range' using errcode='22023'; end if;
  select jsonb_build_object('trainee_id',f.trainee_id,'full_name',f.full_name,'today',public.business_date(),'range_days',p_range_days)||private.admin_metric_values(1,case when f.active then 1 else 0 end,f.reported_days,f.expected_days,f.eligible_reported_days,f.target_reached_days,f.completion_sum)
  into v_result from private.admin_trainee_metrics(p_range_days,p_coach_id,p_trainee_id) f
  where f.coach_id=p_coach_id and f.trainee_id=p_trainee_id and exists(select 1 from public.profiles where id=p_coach_id and role='coach');
  return v_result;
end;
$$;
revoke all on function public.get_admin_coach_analytics(integer,text,integer),public.get_admin_coach_detail(uuid,integer,integer,text),public.get_admin_trainee_analytics(uuid,uuid,integer) from public,anon,service_role,supabase_auth_admin;
grant execute on function public.get_admin_coach_analytics(integer,text,integer),public.get_admin_coach_detail(uuid,integer,integer,text),public.get_admin_trainee_analytics(uuid,uuid,integer) to authenticated;
commit;
