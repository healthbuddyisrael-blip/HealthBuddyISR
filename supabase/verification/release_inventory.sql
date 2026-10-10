-- Read-only catalog inventory: safe on hosted databases, no Auth rows/tokens.
begin read only;
select current_database() as database_name, public.business_date() as jerusalem_business_date;
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('profiles','coach_trainees','daily_steps','step_targets','invitations')
order by c.relname;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_catalog.pg_policies where schemaname in ('public','private') order by tablename,policyname;
select n.nspname as schema_name,p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,p.proconfig as settings,p.proacl as execute_grants
from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and (n.nspname='private' or p.proname in (
  'business_date','get_step_target','accept_invitation','cleanup_unactivated_auth_user',
  'create_coach_invitation','create_trainee_invitation','rotate_invitation','revoke_invitation',
  'save_daily_steps','set_today_step_target','get_coach_dashboard','get_admin_coach_analytics',
  'get_admin_coach_detail','get_admin_trainee_analytics')) order by n.nspname,p.proname;
select n.nspname,c.relname,t.tgname,pg_catalog.pg_get_triggerdef(t.oid) as definition
from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname;
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and table_name in ('profiles','coach_trainees','daily_steps','step_targets','invitations')
order by table_name,grantee,privilege_type;
select c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid) as definition
from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' order by c.relname,k.conname;
rollback;
