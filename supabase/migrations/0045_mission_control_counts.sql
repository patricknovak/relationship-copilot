-- 0045: record mission_control_counts and its tables in the repo.
--
-- ALREADY IN PRODUCTION. Do not apply this file to digbnrhwsifmycrxyquo.
-- The schema, the passcode table and the first function were created by hand
-- before 2026-10-31; the current function and test_users came in through the
-- Supabase connector on 2026-10-31 with Patrick's go (schema_migrations
-- version 20261031193517, "relationship_copilot_test_users"). Patrick decided
-- on 2026-10-31 to keep the function anon-executable: it is passcode-gated and
-- the external Mission Control dashboard calls it daily.
--
-- This file copies the production definitions (read 2026-11-10) so a database
-- built from supabase/migrations/ matches production. Everything here is
-- idempotent. The passcode hash is NOT here: production holds one row in
-- mission_control.counts_passcode, set by hand, and a fresh database has none,
-- so the function refuses every call until one is inserted.
--
-- Counts only aggregates (no answer text, no ids) and excludes test accounts
-- (an email filter plus mission_control.test_users).

create schema if not exists mission_control;
revoke all on schema mission_control from public, anon, authenticated;

create table if not exists mission_control.counts_passcode (
  id boolean primary key default true check (id),
  sha256_hex text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);
alter table mission_control.counts_passcode enable row level security;
revoke all on mission_control.counts_passcode from public, anon, authenticated;

create table if not exists mission_control.test_users (
  user_id uuid primary key,
  note text,
  labelled_at timestamptz not null default now()
);
alter table mission_control.test_users enable row level security;
revoke all on mission_control.test_users from public, anon, authenticated;

create or replace function public.mission_control_counts(
  p_yesterday_start timestamptz,
  p_yesterday_end   timestamptz,
  p_last7_start     timestamptz,
  p_last7_end       timestamptz,
  p_passcode        text
)
returns table(
  signups_yesterday bigint,
  signups_7d bigint,
  signups_all bigint,
  signup_starts_yesterday bigint,
  signup_starts_7d bigint,
  signup_starts_all bigint,
  reveals_yesterday bigint,
  reveals_7d bigint,
  reveals_all bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'mission_control', 'extensions'
as $function$
begin
  if p_passcode is null or not exists (
       select 1 from mission_control.counts_passcode
       where sha256_hex = encode(extensions.digest(p_passcode, 'sha256'), 'hex')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with real_users as (
    select au.id, au.created_at, au.email_confirmed_at
    from auth.users au
    where not (coalesce(au.email,'') ilike '%patricknovak%' or coalesce(au.email,'') ilike '%planetterrian%'
      or coalesce(au.email,'') ilike '%+test%' or coalesce(au.email,'') ilike '%test@%'
      or coalesce(au.email,'') ilike '%example.com%' or coalesce(au.email,'') ilike '%qa@%'
      or coalesce(au.email,'') ilike '%relationshipcopilot.com%'
      or (coalesce(au.email,'') ilike '%relationshipcopilot%' and coalesce(au.email,'') ilike '%test%'))
      and not exists (select 1 from mission_control.test_users t where t.user_id = au.id)
  ),
  confirmed as (
    select ru.email_confirmed_at as at from real_users ru where ru.email_confirmed_at is not null
  ),
  rv as (
    select pi.revealed_at from public.prompt_instances pi
    where pi.revealed_at is not null
      and exists (select 1 from public.connection_members m where m.connection_id = pi.connection_id)
      and not exists (select 1 from public.connection_members m
                      where m.connection_id = pi.connection_id
                        and m.user_id not in (select ru.id from real_users ru))
  )
  select
    (select count(*) from confirmed c where c.at >= p_yesterday_start and c.at < p_yesterday_end)::bigint,
    (select count(*) from confirmed c where c.at >= p_last7_start and c.at < p_last7_end)::bigint,
    (select count(*) from confirmed)::bigint,
    (select count(*) from real_users ru where ru.created_at >= p_yesterday_start and ru.created_at < p_yesterday_end)::bigint,
    (select count(*) from real_users ru where ru.created_at >= p_last7_start and ru.created_at < p_last7_end)::bigint,
    (select count(*) from real_users)::bigint,
    (select count(*) from rv where rv.revealed_at >= p_yesterday_start and rv.revealed_at < p_yesterday_end)::bigint,
    (select count(*) from rv where rv.revealed_at >= p_last7_start and rv.revealed_at < p_last7_end)::bigint,
    (select count(*) from rv)::bigint;
end;
$function$;

revoke all on function public.mission_control_counts(timestamptz, timestamptz, timestamptz, timestamptz, text) from public;
grant execute on function public.mission_control_counts(timestamptz, timestamptz, timestamptz, timestamptz, text)
  to anon, authenticated, service_role;
