-- Read-only application-schema comparison. No user data or function bodies are returned.
with objects as (
  select 'table' as kind, n.nspname as schema_name, c.relname as object_name,
    md5(c.relkind::text || ':' || c.relrowsecurity::text || ':' || c.relforcerowsecurity::text) as fingerprint
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind in ('r','p','v','m','S')
  union all
  select 'column', n.nspname, c.relname || '.' || a.attname,
    md5(pg_catalog.format_type(a.atttypid,a.atttypmod) || ':' || a.attnotnull::text || ':' || a.attidentity::text || ':' || a.attgenerated::text || ':' || coalesce(pg_catalog.pg_get_expr(d.adbin,d.adrelid),''))
  from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where n.nspname in ('public','private') and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped
  union all
  select 'function', n.nspname,p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
    md5(pg_catalog.pg_get_functiondef(p.oid))
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private') and p.prokind='f'
  union all
  select 'constraint',n.nspname,c.relname || '.' || k.conname,
    md5(pg_catalog.pg_get_constraintdef(k.oid) || ':' || k.convalidated::text)
  from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
  union all
  select 'trigger',n.nspname,c.relname || '.' || t.tgname,
    md5(pg_catalog.pg_get_triggerdef(t.oid) || ':' || t.tgenabled::text)
  from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and not t.tgisinternal
  union all
  select 'index',n.nspname,c.relname,md5(pg_catalog.pg_get_indexdef(c.oid) || ':' || i.indisvalid::text)
  from pg_catalog.pg_index i join pg_catalog.pg_class c on c.oid=i.indexrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')
  union all
  select 'enum',n.nspname,t.typname,md5(string_agg(e.enumlabel,',' order by e.enumsortorder))
  from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid=t.typnamespace
  join pg_catalog.pg_enum e on e.enumtypid=t.oid where n.nspname in ('public','private') group by n.nspname,t.typname
  union all
  select 'policy',schemaname,tablename || '.' || policyname,
    md5(permissive || ':' || roles::text || ':' || cmd || ':' || coalesce(qual,'') || ':' || coalesce(with_check,''))
  from pg_catalog.pg_policies where schemaname in ('public','private')
)
select kind,schema_name,object_name,fingerprint from objects order by kind,schema_name,object_name;
