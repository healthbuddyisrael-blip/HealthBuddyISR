-- Disposable local PostgreSQL harness only. All fixture data rolls back.
begin;
create function pg_temp.assert_true(value boolean, label text) returns void
language plpgsql as $$ begin if value is distinct from true then raise exception 'FAILED: %', label; end if; end $$;
create function pg_temp.expect_error(query text, expected text) returns void
language plpgsql as $$ begin
  begin execute query; exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Expected %, got %', expected, sqlstate;
  end;
  raise exception 'Expected rejection';
end $$;
insert into auth.users(id,email,email_confirmed_at) values
('60000000-0000-4000-8000-000000000001','steps-coach@example.test',now()),
('60000000-0000-4000-8000-000000000002','steps-one@example.test',now()),
('60000000-0000-4000-8000-000000000003','steps-two@example.test',now());
insert into public.profiles(id,email,full_name,role) values
('60000000-0000-4000-8000-000000000001','steps-coach@example.test','Coach','coach'),
('60000000-0000-4000-8000-000000000002','steps-one@example.test','One','trainee'),
('60000000-0000-4000-8000-000000000003','steps-two@example.test','Two','trainee');
insert into public.coach_trainees(coach_id,trainee_id) values
('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002'),
('60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000003');
insert into public.step_targets(trainee_id,created_by,effective_from,target_steps) values
('60000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001',public.business_date(),10000),
('60000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000001',public.business_date(),8000);
set constraints all immediate;
set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
select public.save_daily_steps(public.business_date(),999);
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
select public.save_daily_steps(public.business_date(),7430);
select pg_temp.assert_true((select steps=7430 from public.daily_steps where date=public.business_date()),'today insert');
select public.save_daily_steps(public.business_date(),11000);
select pg_temp.assert_true((select count(*)=1 and max(steps)=11000 from public.daily_steps),'today upsert updates without duplicate');
select public.save_daily_steps(public.business_date()-1,8450);
select pg_temp.assert_true((select steps=8450 from public.daily_steps where date=public.business_date()-1),'past insert');
select public.save_daily_steps(public.business_date()-1,0);
select pg_temp.assert_true((select count(*)=1 and max(steps)=0 from public.daily_steps where date=public.business_date()-1),'past update preserves zero report');
select pg_temp.expect_error('select public.save_daily_steps(public.business_date()+1,10)','23514');
select pg_temp.expect_error('select public.save_daily_steps(public.business_date(),-1)','23514');
select pg_temp.assert_true((select count(*)=case when extract(day from public.business_date())=1 then 1 else 2 end from public.daily_steps where date between date_trunc('month',public.business_date())::date and (date_trunc('month',public.business_date())+interval '1 month - 1 day')::date),'month read only own rows');
select pg_temp.assert_true((select count(*)=1 and max(target_steps)=10000 from public.step_targets),'target history only own');
with changed as (update public.daily_steps set steps=1 where trainee_id='60000000-0000-4000-8000-000000000003' returning *)
select pg_temp.assert_true((select count(*)=0 from changed),'cannot update another trainee');
select pg_temp.expect_error($q$insert into public.daily_steps(trainee_id,date,steps) values ('60000000-0000-4000-8000-000000000003',public.business_date()-1,1)$q$,'23514');
select pg_temp.expect_error($q$update public.daily_steps set trainee_id='60000000-0000-4000-8000-000000000003'$q$,'42501');
select pg_temp.assert_true(not has_column_privilege('authenticated','public.daily_steps','date','UPDATE'),'date column grant preserved');
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
select pg_temp.expect_error('select public.save_daily_steps(public.business_date(),1)','42501');
reset role;
set local role anon;
select pg_temp.expect_error('select public.save_daily_steps(current_date,1)','42501');
reset role;
rollback;
\echo 'Daily steps invoker upsert and RLS assertions passed.'
