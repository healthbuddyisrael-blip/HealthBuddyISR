-- Disposable plain PostgreSQL harness only. Clock, fixtures, and DDL roll back.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
create function pg_temp.expect_error(query text,expected text) returns void language plpgsql as $$ begin
  begin execute query; exception when others then if sqlstate=expected then return; end if; raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm; end;
  raise exception 'Expected rejection: %',query;
end $$;
-- Simulate two business days without bypassing RLS or target integrity triggers.
create or replace function public.business_date(p_timestamp timestamptz default statement_timestamp()) returns date
language sql stable security invoker set search_path='' as $$
 select (coalesce(nullif(current_setting('test.business_timestamp',true),'')::timestamptz,p_timestamp) at time zone 'Asia/Jerusalem')::date
$$;
select set_config('test.business_timestamp','2026-10-01T12:00:00Z',true);
insert into auth.users(id,email,email_confirmed_at) values
('70000000-0000-4000-8000-000000000001','coach-a@example.test',now()),
('70000000-0000-4000-8000-000000000002','coach-b@example.test',now()),
('70000000-0000-4000-8000-000000000003','coach-own@example.test',now()),
('70000000-0000-4000-8000-000000000004','coach-other@example.test',now()),
('70000000-0000-4000-8000-000000000005','coach-empty@example.test',now());
insert into public.profiles(id,email,full_name,role) values
('70000000-0000-4000-8000-000000000001','coach-a@example.test','Coach A','coach'),
('70000000-0000-4000-8000-000000000002','coach-b@example.test','Coach B','coach'),
('70000000-0000-4000-8000-000000000003','coach-own@example.test','ישראל ישראלי','trainee'),
('70000000-0000-4000-8000-000000000004','coach-other@example.test','Other trainee','trainee'),
('70000000-0000-4000-8000-000000000005','coach-empty@example.test','Empty trainee','trainee');
insert into public.coach_trainees(coach_id,trainee_id) values
('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000003'),
('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000004'),
('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000005');
insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values
('70000000-0000-4000-8000-000000000003',8000,public.business_date(),'70000000-0000-4000-8000-000000000001'),
('70000000-0000-4000-8000-000000000004',8000,public.business_date(),'70000000-0000-4000-8000-000000000002'),
('70000000-0000-4000-8000-000000000005',8000,public.business_date(),'70000000-0000-4000-8000-000000000001');
set constraints all immediate;
insert into public.daily_steps(trainee_id,date,steps) values
('70000000-0000-4000-8000-000000000003','2026-09-30',0),
('70000000-0000-4000-8000-000000000003','2026-10-01',8000),
('70000000-0000-4000-8000-000000000004','2026-10-01',123);
select set_config('test.business_timestamp','2026-10-02T12:00:00Z',true);
insert into public.daily_steps(trainee_id,date,steps) values('70000000-0000-4000-8000-000000000003','2026-10-02',8000);
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select count(*)=1 from public.profiles where id='70000000-0000-4000-8000-000000000003'),'assigned trainee visible');
select pg_temp.assert_true((select count(*)=0 from public.profiles where id='70000000-0000-4000-8000-000000000004'),'unassigned trainee invisible');
select pg_temp.assert_true((select count(*)=3 from public.daily_steps),'only assigned reports visible');
select pg_temp.assert_true((select count(*)=0 from public.daily_steps where trainee_id='70000000-0000-4000-8000-000000000004'),'unrelated steps invisible');
with changed as (update public.daily_steps set steps=1 returning *) select pg_temp.assert_true((select count(*)=0 from changed),'coach cannot update steps');
select pg_temp.expect_error($q$update public.coach_trainees set coach_id='70000000-0000-4000-8000-000000000002'$q$,'42501');
select pg_temp.assert_true(public.get_coach_dashboard()->>'total'='2','dashboard scoped total');
select pg_temp.assert_true(jsonb_array_length(public.get_coach_dashboard()->'trainees')=2,'dashboard scoped rows');
select pg_temp.assert_true(public.get_coach_dashboard(1,'ישראל')->>'total'='1','scoped Hebrew search');
select pg_temp.assert_true(public.get_coach_dashboard(1,'Other')->>'total'='0','search cannot reveal unrelated trainee');
select pg_temp.assert_true(public.get_coach_dashboard(2)->'trainees'='[]'::jsonb,'pagination returns bounded page');
select pg_temp.assert_true((select item->>'last_reported_date'='2026-10-02' from jsonb_array_elements(public.get_coach_dashboard()->'trainees') item where item->>'trainee_id'='70000000-0000-4000-8000-000000000003'),'last report is MAX date');
select pg_temp.assert_true((select item->'today_steps'='null'::jsonb and item->'last_reported_date'='null'::jsonb from jsonb_array_elements(public.get_coach_dashboard()->'trainees') item where item->>'trainee_id'='70000000-0000-4000-8000-000000000005'),'absence is not zero or fabricated date');
select public.set_today_step_target('70000000-0000-4000-8000-000000000003',10000);
select pg_temp.assert_true((select count(*)=1 and max(target_steps)=10000 from public.step_targets where trainee_id='70000000-0000-4000-8000-000000000003' and effective_from=public.business_date()),'target creates today transition');
select pg_temp.assert_true(public.get_step_target('70000000-0000-4000-8000-000000000003','2026-10-01')=8000,'past target stays unchanged');
select pg_temp.assert_true((select round(steps*100.0/public.get_step_target(trainee_id,date))=100 from public.daily_steps where trainee_id='70000000-0000-4000-8000-000000000003' and date='2026-10-01'),'historical completion remains 100');
select pg_temp.assert_true((select round(steps*100.0/public.get_step_target(trainee_id,date))=80 from public.daily_steps where trainee_id='70000000-0000-4000-8000-000000000003' and date='2026-10-02'),'today recalculates to 80');
reset role;
create temporary table original_target as select id,created_by,created_at from public.step_targets where trainee_id='70000000-0000-4000-8000-000000000003' and effective_from=public.business_date();
set local role authenticated;
select public.set_today_step_target('70000000-0000-4000-8000-000000000003',9000);
select pg_temp.assert_true((select count(*)=2 and max(target_steps)=9000 from public.step_targets where trainee_id='70000000-0000-4000-8000-000000000003'),'same-day correction does not duplicate transition');
select pg_temp.assert_true(public.get_step_target('70000000-0000-4000-8000-000000000003','2026-10-01')=8000,'same-day correction preserves history');
select pg_temp.expect_error($q$select public.set_today_step_target('70000000-0000-4000-8000-000000000004',1)$q$,'42501');
select pg_temp.expect_error($q$select public.set_today_step_target('70000000-0000-4000-8000-000000000003',0)$q$,'23514');
select pg_temp.expect_error($q$update public.step_targets set target_steps=1 where effective_from='2026-10-01'$q$,'42501');
select pg_temp.expect_error($q$delete from public.step_targets$q$,'42501');
select pg_temp.expect_error($q$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values('70000000-0000-4000-8000-000000000003',1,public.business_date()-1,'70000000-0000-4000-8000-000000000001')$q$,'42501');
select pg_temp.expect_error($q$insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values('70000000-0000-4000-8000-000000000003',1,public.business_date()+1,'70000000-0000-4000-8000-000000000001')$q$,'42501');
-- Genuine DB rows/targets validate the exact summary denominators.
with reports as (select steps,public.get_step_target(trainee_id,date) as target from public.daily_steps where trainee_id='70000000-0000-4000-8000-000000000003' and date between public.business_date()-6 and public.business_date())
select pg_temp.assert_true(count(*)=3 and count(target)=2 and count(*) filter(where steps>=target)=1 and round(avg(steps))=5333 and round(avg(steps*100.0/nullif(target,0)))=94,'summary counts zero, ignores missing, uses historical target and eligible denominator') from reports;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000003',true);
select pg_temp.expect_error($q$select public.set_today_step_target('70000000-0000-4000-8000-000000000003',1)$q$,'42501');
select pg_temp.expect_error($q$select public.get_coach_dashboard()$q$,'42501');
reset role;
select pg_temp.assert_true((select t.id=o.id and t.created_by=o.created_by and t.created_at=o.created_at from public.step_targets t join original_target o on o.id=t.id),'original author/time/identity preserved');
-- Even the trusted execution owner cannot change history or immutable columns.
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
select pg_temp.expect_error($q$update public.step_targets set target_steps=1 where effective_from='2026-10-01'$q$,'23514');
select pg_temp.expect_error($q$update public.step_targets set created_by='70000000-0000-4000-8000-000000000002' where trainee_id='70000000-0000-4000-8000-000000000003' and effective_from='2026-10-02'$q$,'23514');
select pg_temp.assert_true(not has_function_privilege('anon','public.get_coach_dashboard(integer,text)','EXECUTE') and not has_function_privilege('service_role','public.set_today_step_target(uuid,integer)','EXECUTE'),'execution grants closed');
set local role authenticated;
select pg_temp.expect_error($q$select public.get_coach_dashboard(1,'','70000000-0000-4000-8000-000000000002'::uuid)$q$,'42883');
select pg_temp.expect_error($q$select public.set_today_step_target('70000000-0000-4000-8000-000000000003'::uuid,1,public.business_date()+1)$q$,'42883');
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000005',true);
select public.save_daily_steps(public.business_date(),0);
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true((select item->>'today_steps'='0' and item->>'last_reported_date'='2026-10-02' from jsonb_array_elements(public.get_coach_dashboard()->'trainees') item where item->>'trainee_id'='70000000-0000-4000-8000-000000000005'),'today zero is a genuine report in dashboard');
reset role;
-- Real multi-page fixture, without loading all trainees into application memory.
set constraints all deferred;
create temporary table pagination_users as select gen_random_uuid() as id,'Pagination '||lpad(value::text,3,'0') as name from generate_series(1,26) value;
insert into auth.users(id,email,email_confirmed_at) select id,id::text||'@example.test',now() from pagination_users;
insert into public.profiles(id,email,full_name,role) select id,id::text||'@example.test',name,'trainee' from pagination_users;
insert into public.coach_trainees(coach_id,trainee_id) select '70000000-0000-4000-8000-000000000001',id from pagination_users;
insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) select id,8000,public.business_date(),'70000000-0000-4000-8000-000000000001' from pagination_users;
set constraints all immediate;
set local role authenticated;
select pg_temp.assert_true(public.get_coach_dashboard()->>'total'='28' and jsonb_array_length(public.get_coach_dashboard()->'trainees')=25,'first page is capped at 25');
select pg_temp.assert_true(jsonb_array_length(public.get_coach_dashboard(2)->'trainees')=3,'second page has remaining trainees');
select pg_temp.assert_true(public.get_coach_dashboard(2,'Pagination')->>'total'='26' and jsonb_array_length(public.get_coach_dashboard(2,'Pagination')->'trainees')=1,'search pagination remains scoped');
rollback;
\echo 'Coach scoping, target corrections, immutability, and summary assertions passed.'
