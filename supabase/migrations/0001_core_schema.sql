-- Relationship Copilot — core schema (re-platform on Supabase)
-- Identity, connections, the unified prompt engine, AI insights, safety, billing.
-- The mutual-reveal mechanic is enforced entirely in RLS (see prompt_responses policies).
--
-- Assumes a Supabase database: `auth.users`, `auth.uid()`, and the roles
-- `anon` / `authenticated` / `service_role` already exist. For local validation
-- against plain Postgres, supabase/tests/00_supabase_stubs.sql provides shims.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type connection_type   as enum (
  'romantic','friend','family','coworker','parent_child','sibling','mentor'
);
create type connection_status as enum (
  'pending','onboarding','active','archived','blocked'
);
create type prompt_kind   as enum ('onboarding','daily','quiz','challenge');
create type prompt_source as enum ('seed','grok','user');

-- ---------------------------------------------------------------------------
-- Profiles (app mirror of auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique,
  display_name text,
  avatar_url   text,
  birthday     date,          -- captured at signup → zodiac + age-gating
  birth_time   time,          -- optional, richer (entertainment) chart
  birth_place  text,
  life_stage   text,
  intake       jsonb not null default '{}'::jsonb,  -- intake profile + attachment quiz
  preferences  jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-provision a profile row whenever a new auth user is created.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Connections + membership (one canonical row per pair)
-- ---------------------------------------------------------------------------
create table connections (
  id                uuid primary key default gen_random_uuid(),
  type              connection_type not null,
  sub_type          text,
  status            connection_status not null default 'pending',
  created_by        uuid not null references profiles(id) on delete cascade,
  invite_code       text unique,
  invite_expires_at timestamptz,
  onboarding_done   boolean not null default false,
  life_stage        text,
  start_date        date,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table connection_members (
  connection_id        uuid not null references connections(id) on delete cascade,
  user_id              uuid not null references profiles(id) on delete cascade,
  role                 text not null default 'member',  -- creator|member|guardian|minor
  joined_at            timestamptz,                     -- null while invited, pre-accept
  onboarding_submitted boolean not null default false,
  primary key (connection_id, user_id)
);
create index connection_members_user_idx on connection_members(user_id);

-- Membership helper (security definer so policies can call it without recursion).
create or replace function is_connection_member(conn uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from connection_members m
    where m.connection_id = conn and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Unified prompt engine: templates → instances → responses → discussion
-- ---------------------------------------------------------------------------
create table prompt_templates (
  id                uuid primary key default gen_random_uuid(),
  kind              prompt_kind not null,
  relationship_type connection_type,        -- null = applies to all types
  framework         text,                    -- 'gottman_love_maps','aron_36',...
  title             text,
  description       text,
  questions         jsonb not null,          -- [{id,text,format,options}]
  source            prompt_source not null default 'seed',
  config            jsonb not null default '{}'::jsonb,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index prompt_templates_lookup_idx
  on prompt_templates(kind, relationship_type) where active;

create table prompt_instances (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  template_id   uuid references prompt_templates(id),
  kind          prompt_kind not null,
  questions     jsonb not null,              -- snapshot at assignment time
  scheduled_for date,
  status        text not null default 'open',-- open|revealed|completed|skipped
  revealed_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (connection_id, kind, scheduled_for) -- idempotent daily assignment
);
create index prompt_instances_conn_idx
  on prompt_instances(connection_id, kind, created_at desc);

create table prompt_responses (
  id           uuid primary key default gen_random_uuid(),
  instance_id  uuid not null references prompt_instances(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  answers      jsonb not null,              -- {question_id: answer}
  submitted_at timestamptz not null default now(),
  edited_at    timestamptz,
  unique (instance_id, user_id)
);
create index prompt_responses_instance_idx on prompt_responses(instance_id);

-- Has the given user already answered this instance? Used by the reveal policy.
-- SECURITY DEFINER so it bypasses RLS on prompt_responses and avoids the
-- "infinite recursion in policy" error a self-referencing policy would cause.
create or replace function has_answered(p_instance uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from prompt_responses r
    where r.instance_id = p_instance and r.user_id = p_user
  );
$$;

create table prompt_discussions (
  id          uuid primary key default gen_random_uuid(),
  instance_id uuid not null references prompt_instances(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index prompt_discussions_instance_idx
  on prompt_discussions(instance_id, created_at);

-- Reveal transition: when every member of the connection has answered an
-- instance, flip it to 'revealed'. Runs as definer so it can read across rows.
create or replace function maybe_reveal_instance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  member_count   int;
  response_count int;
  conn_id        uuid;
begin
  select connection_id into conn_id from prompt_instances where id = new.instance_id;
  select count(*) into member_count
    from connection_members where connection_id = conn_id and joined_at is not null;
  select count(*) into response_count
    from prompt_responses where instance_id = new.instance_id;

  if member_count > 0 and response_count >= member_count then
    update prompt_instances
       set status = 'revealed', revealed_at = now()
     where id = new.instance_id and status = 'open';
  end if;
  return new;
end;
$$;
create trigger trg_maybe_reveal_instance
  after insert on prompt_responses
  for each row execute function maybe_reveal_instance();

-- ---------------------------------------------------------------------------
-- AI analysis (Blueprint, digests) + safety audit
-- ---------------------------------------------------------------------------
create table relationship_insights (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  kind          text not null,   -- blueprint|weekly_digest|green_red_flags|goal_suggestion
  audience      text not null default 'shared',  -- shared|user
  for_user      uuid references profiles(id) on delete cascade,
  summary       text,
  payload       jsonb not null default '{}'::jsonb,
  model         text,
  safety_flags  jsonb not null default '{}'::jsonb,
  generated_at  timestamptz not null default now()
);
create index relationship_insights_conn_idx on relationship_insights(connection_id, kind);

create table safety_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  category           text not null,
  surfaced_resources jsonb,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Billing / entitlements (freemium)
-- ---------------------------------------------------------------------------
create table subscriptions (
  user_id                uuid primary key references profiles(id) on delete cascade,
  plan                   text not null default 'free',     -- free|premium
  status                 text not null default 'inactive', -- active|trialing|past_due|canceled|inactive
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);

create or replace function has_premium(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from subscriptions s
    where s.user_id = uid
      and s.plan = 'premium'
      and s.status in ('active','trialing')
  );
$$;

-- ---------------------------------------------------------------------------
-- Invite acceptance RPC (definer: invitee mutates a connection they don't
-- yet belong to). One transaction: add membership, advance status, burn code.
-- ---------------------------------------------------------------------------
create or replace function accept_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  conn connections%rowtype;
  uid  uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into conn from connections
   where invite_code = p_code
     and (invite_expires_at is null or invite_expires_at > now())
   for update;
  if not found then raise exception 'invalid or expired invite'; end if;

  if conn.created_by = uid then raise exception 'cannot accept your own invite'; end if;

  insert into connection_members (connection_id, user_id, role, joined_at)
  values (conn.id, uid, 'member', now())
  on conflict (connection_id, user_id) do nothing;

  update connections
     set status = case when status = 'pending' then 'onboarding' else status end,
         invite_code = null,
         updated_at = now()
   where id = conn.id;

  return conn.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table profiles              enable row level security;
alter table connections           enable row level security;
alter table connection_members    enable row level security;
alter table prompt_templates      enable row level security;
alter table prompt_instances      enable row level security;
alter table prompt_responses      enable row level security;
alter table prompt_discussions    enable row level security;
alter table relationship_insights enable row level security;
alter table safety_events         enable row level security;
alter table subscriptions         enable row level security;

-- profiles: read any (display names visible to connections); write your own
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- connections: members read; creator creates; members update
create policy connections_select on connections for select to authenticated
  using (is_connection_member(id) or created_by = auth.uid());
create policy connections_insert on connections for insert to authenticated
  with check (created_by = auth.uid());
create policy connections_update on connections for update to authenticated
  using (is_connection_member(id) or created_by = auth.uid())
  with check (is_connection_member(id) or created_by = auth.uid());

-- connection_members: visible to members of the same connection; you manage your own row
create policy members_select on connection_members for select to authenticated
  using (is_connection_member(connection_id));
create policy members_insert on connection_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (select 1 from connections c where c.id = connection_id and c.created_by = auth.uid())
  );
create policy members_update on connection_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- prompt_templates: active content is readable by all authenticated users
create policy templates_select on prompt_templates for select to authenticated
  using (active);

-- prompt_instances: members of the connection
create policy instances_select on prompt_instances for select to authenticated
  using (is_connection_member(connection_id));
create policy instances_insert on prompt_instances for insert to authenticated
  with check (is_connection_member(connection_id));
create policy instances_update on prompt_instances for update to authenticated
  using (is_connection_member(connection_id)) with check (is_connection_member(connection_id));

-- prompt_responses: THE REVEAL GATE.
-- Read your own always; read a co-member's only once you have answered too.
create policy responses_select on prompt_responses for select to authenticated
  using (
    user_id = auth.uid()
    or (
      is_connection_member(
        (select i.connection_id from prompt_instances i where i.id = instance_id)
      )
      and has_answered(instance_id, auth.uid())
    )
  );
create policy responses_insert on prompt_responses for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_connection_member((select i.connection_id from prompt_instances i where i.id = instance_id))
    and exists (select 1 from prompt_instances i where i.id = instance_id and i.status in ('open','revealed'))
  );
-- Edit only your own answer, and only while the instance is still open (freeze on reveal).
create policy responses_update on prompt_responses for update to authenticated
  using (
    user_id = auth.uid()
    and (select status from prompt_instances i where i.id = instance_id) = 'open'
  )
  with check (user_id = auth.uid());

-- prompt_discussions: members read; insert only after reveal
create policy discussions_select on prompt_discussions for select to authenticated
  using (is_connection_member((select i.connection_id from prompt_instances i where i.id = instance_id)));
create policy discussions_insert on prompt_discussions for insert to authenticated
  with check (
    user_id = auth.uid()
    and (select status from prompt_instances i where i.id = instance_id) = 'revealed'
  );

-- relationship_insights: shared → members; user-scoped → only that user.
-- Writes happen server-side via the service role (bypasses RLS), so no insert policy.
create policy insights_select on relationship_insights for select to authenticated
  using (
    is_connection_member(connection_id)
    and (audience = 'shared' or for_user = auth.uid())
  );

-- safety_events: a user sees only their own; writes are service-role only.
create policy safety_select on safety_events for select to authenticated
  using (user_id = auth.uid());

-- subscriptions: read your own; writes are service-role only (Stripe webhook).
create policy subscriptions_select on subscriptions for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime: broadcast reveal signal + discussion + insights to members
-- (RLS still applies to what each client actually receives).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table prompt_instances;
alter publication supabase_realtime add table prompt_discussions;
alter publication supabase_realtime add table relationship_insights;
