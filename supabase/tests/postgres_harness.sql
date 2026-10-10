-- Disposable PostgreSQL ONLY: this is not a Supabase migration or production seed.
-- Represents the Auth columns and API roles used by these migrations. Real
-- Supabase-managed Auth, PostgREST, and provider behavior must be tested later.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin;
  end if;
end;
$$;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb not null default '{}'::jsonb
);
grant usage on schema public to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable security invoker set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

-- Local-only Storage metadata harness. Actual uploads/signed URLs are verified
-- separately against Supabase; these tables exercise the exact migration RLS.
create schema storage;
create table storage.buckets(id text primary key,name text not null,public boolean not null default false,
  file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),
  name text not null,owner_id text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert,delete on storage.objects to authenticated;
