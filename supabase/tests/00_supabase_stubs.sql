-- Local-only shims so the migrations can run + be tested on plain Postgres.
-- On real Supabase these objects already exist and this file is NOT applied.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Supabase's auth.uid() reads the JWT 'sub' claim. For tests we read a GUC
-- ('test.user_id') that we set per simulated user.
create or replace function auth.uid()
returns uuid language sql stable as $$
  select nullif(current_setting('test.user_id', true), '')::uuid;
$$;

-- Roles used by RLS policies.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Realtime publication referenced by the migration.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Let the test (authenticated) role use the schema + tables; RLS still applies.
grant usage on schema public, auth to authenticated, anon, service_role;
alter default privileges in schema public grant all on tables to authenticated, service_role;
