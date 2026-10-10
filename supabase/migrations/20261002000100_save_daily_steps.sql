begin;
-- Preserve column-level grants: a PostgREST table upsert would also update
-- identity/date columns. This invoker upsert updates only the permitted column.
create function public.save_daily_steps(p_date date, p_steps integer)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if (select private.current_role()) is distinct from 'trainee'::public.user_role then
    raise exception 'Trainee membership required' using errcode = '42501';
  end if;
  insert into public.daily_steps(trainee_id,date,steps)
  values ((select auth.uid()),p_date,p_steps)
  on conflict (trainee_id,date) do update set steps = excluded.steps;
end;
$$;
revoke all on function public.save_daily_steps(date,integer) from public, anon, service_role;
grant execute on function public.save_daily_steps(date,integer) to authenticated;
commit;
