begin;

-- Normal coach writes are exclusively today-only through the scoped RPC.
revoke insert(trainee_id,target_steps,effective_from,created_by) on public.step_targets from authenticated;
drop policy targets_insert on public.step_targets;

create function public.set_today_step_target(p_trainee_id uuid, p_target_steps integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_today date := public.business_date();
begin
  if not exists(select 1 from public.profiles where id=v_actor and role='coach')
     or not exists(select 1 from public.coach_trainees where coach_id=v_actor and trainee_id=p_trainee_id) then
    raise exception 'Trainee unavailable' using errcode='42501';
  end if;
  if p_target_steps is null or p_target_steps <= 0 then
    raise exception 'Positive target required' using errcode='23514';
  end if;
  -- Unique constraint serializes concurrent corrections. Only the value changes.
  insert into public.step_targets(trainee_id,target_steps,effective_from,created_by)
  values(p_trainee_id,p_target_steps,v_today,v_actor)
  on conflict(trainee_id,effective_from) do update set target_steps=excluded.target_steps;
  return p_target_steps;
end;
$$;
revoke all on function public.set_today_step_target(uuid,integer) from public,anon,service_role,supabase_auth_admin;
grant execute on function public.set_today_step_target(uuid,integer) to authenticated;

create or replace function private.validate_step_target()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='UPDATE' then
    -- Only the trusted RPC's execution owner can reach this exception. Clients
    -- have no UPDATE grant/policy. Auth identity and assignment are checked again.
    if current_user <> (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid='public.set_today_step_target(uuid,integer)'::regprocedure)
       or old.effective_from <> public.business_date()
       or (new.id,new.trainee_id,new.effective_from,new.created_by,new.created_at)
          is distinct from (old.id,old.trainee_id,old.effective_from,old.created_by,old.created_at)
       or not exists(select 1 from public.profiles where id=auth.uid() and role='coach')
       or not exists(select 1 from public.coach_trainees where coach_id=auth.uid() and trainee_id=old.trainee_id) then
      raise exception 'Historical targets are immutable' using errcode='23514';
    end if;
    return new;
  end if;
  if new.effective_from < public.business_date() then
    raise exception 'Target transitions cannot be backdated' using errcode='23514';
  end if;
  if not exists(select 1 from public.profiles where id=new.trainee_id and role='trainee') then
    raise exception 'Target must reference a trainee' using errcode='23514';
  end if;
  if not exists(select 1 from public.profiles where id=new.created_by and role in ('coach','admin')) then
    raise exception 'Target creator must be a coach or admin' using errcode='23514';
  end if;
  return new;
end;
$$;
comment on table public.step_targets is 'Historical transitions are immutable. Assigned coaches may correct only today through set_today_step_target; original author/time are preserved.';

create function public.get_coach_dashboard(p_page integer default 1, p_search text default '')
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if (select private.current_role()) is distinct from 'coach'::public.user_role then
    raise exception 'Coach membership required' using errcode='42501';
  end if;
  if p_page is null or p_page < 1 or p_search is null or length(p_search)>200 then
    raise exception 'Invalid pagination/search' using errcode='22023';
  end if;
  with scoped as materialized (
    select p.id,p.full_name from public.coach_trainees ct
    join public.profiles p on p.id=ct.trainee_id and p.role='trainee'
    where ct.coach_id=(select auth.uid())
      and (p_search='' or strpos(lower(p.full_name),lower(btrim(p_search)))>0)
  ), page as (
    select * from scoped order by full_name,id limit 25 offset (p_page::bigint-1)*25
  ), rows as (
    select p.id as trainee_id,p.full_name,s.steps as today_steps,
      t.target_steps as today_target,last_report.date as last_reported_date
    from page p
    left join public.daily_steps s on s.trainee_id=p.id and s.date=public.business_date()
    left join lateral (select target_steps from public.step_targets where trainee_id=p.id and effective_from<=public.business_date() order by effective_from desc limit 1) t on true
    left join lateral (select date from public.daily_steps where trainee_id=p.id order by date desc limit 1) last_report on true
  )
  select jsonb_build_object('total',(select count(*) from scoped),'trainees',
    coalesce((select jsonb_agg(to_jsonb(r) order by r.full_name,r.trainee_id) from rows r),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;
revoke all on function public.get_coach_dashboard(integer,text) from public,anon,service_role,supabase_auth_admin;
grant execute on function public.get_coach_dashboard(integer,text) to authenticated;
commit;
