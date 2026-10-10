begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
do $$
declare v_legacy public.weekly_coaching_checkins%rowtype; v_week date;
begin
  if (select count(*) from public.weekly_coaching_checkins where trainee_id=auth.uid())<>0 then raise exception 'Unexpected fixture'; end if;
  if (select count(*) from public.weekly_coaching_checkins where legacy_monday_week)<>2 then raise exception 'Legacy records lost'; end if;
  select * into v_legacy from public.weekly_coaching_checkins where id='b0000000-0000-4000-8000-000000000010';
  if v_legacy.general_status<>'Old Sunday call' or extract(dow from v_legacy.week_start)<>1 then raise exception 'Legacy identity or notes changed'; end if;
  v_week:=public.coaching_week_start(v_legacy.call_date);
  if (select count(*) from public.weekly_coaching_compliance where week_start=v_week and call_completed)<>1 then raise exception 'Legacy calls counted twice in new week'; end if;
  if public.get_weekly_call_history(v_legacy.trainee_id)->>'current_goal'<>'Later goal' then raise exception 'Legacy goal ordering failed'; end if;
  perform public.save_weekly_checkin(v_legacy.trainee_id,v_legacy.week_start,true,v_legacy.call_date,'Corrected note','None','Walk','Earlier corrected goal',false,'');
  if (select count(*) from public.weekly_coaching_checkins)<>2 then raise exception 'Legacy update duplicated records'; end if;
  if (select general_status from public.weekly_coaching_checkins where id=v_legacy.id)<>'Corrected note' then raise exception 'Legacy update failed'; end if;
  if public.get_weekly_call_history(v_legacy.trainee_id)->>'current_goal'<>'Later goal' then raise exception 'Old edit replaced newer goal'; end if;
end $$;
reset role;
delete from auth.users where id='b0000000-0000-4000-8000-000000000002';
delete from auth.users where id='b0000000-0000-4000-8000-000000000001';
commit;
\echo 'Israeli-week migration preserved legacy reports, dates, edits and compliance.'
