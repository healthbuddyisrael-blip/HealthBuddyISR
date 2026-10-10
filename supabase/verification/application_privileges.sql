-- Read-only effective permissions, including inherited/PUBLIC execution rights.
with roles(role_name) as (
  values ('anon'),('authenticated'),('service_role'),('supabase_auth_admin')
), objects as (
  select 'table_privilege' as kind,n.nspname as schema_name,
    c.relname || ':' || r.role_name || ':' || v.permission as object_name,
    pg_catalog.has_table_privilege(r.role_name,c.oid,v.permission)::text as fingerprint
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  cross join roles r cross join (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(permission)
  where n.nspname in ('public','private') and c.relkind in ('r','p')
  union all
  select 'function_privilege',n.nspname,
    p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || '):' || r.role_name,
    pg_catalog.has_function_privilege(r.role_name,p.oid,'EXECUTE')::text
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  cross join roles r where n.nspname in ('public','private') and p.prokind='f'
  union all
  select 'schema_privilege',n.nspname,r.role_name || ':' || v.permission,
    pg_catalog.has_schema_privilege(r.role_name,n.oid,v.permission)::text
  from pg_catalog.pg_namespace n cross join roles r cross join (values ('USAGE'),('CREATE')) v(permission)
  where n.nspname='private'
)
select kind,schema_name,object_name,fingerprint from objects order by kind,schema_name,object_name;
