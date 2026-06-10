-- Account lifecycle: deletion semantics, Stripe webhook idempotency, audit log.
--
-- Deletion model ("redact, partner keeps theirs"): deleting an auth user
-- cascades through profiles to the user's own responses, discussions,
-- memberships, safety events, and subscription — but must NOT take down the
-- shared connection (and with it the other member's answers). created_by
-- therefore becomes SET NULL instead of CASCADE; app code archives the
-- connection for the remaining member and removes shared AI insights derived
-- from the deleted user's answers.

alter table connections alter column created_by drop not null;
alter table connections drop constraint connections_created_by_fkey;
alter table connections
  add constraint connections_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Stripe webhook idempotency: Stripe retries deliveries; processing an event
-- id twice must be a no-op. Service-role only (no policies).
-- ---------------------------------------------------------------------------
create table stripe_events (
  id          text primary key,            -- Stripe event id (evt_...)
  type        text not null,
  received_at timestamptz not null default now()
);
alter table stripe_events enable row level security;

-- ---------------------------------------------------------------------------
-- Audit trail for sensitive actions. Writes are service-role only; a user can
-- read their own entries (transparency). user_id is SET NULL on deletion so
-- the trail of an account deletion survives the account.
-- ---------------------------------------------------------------------------
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete set null,
  action     text not null,                -- e.g. account.export, blueprint.generate
  target     text,                         -- e.g. a connection id
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_user_idx on audit_log(user_id, created_at desc);
alter table audit_log enable row level security;
create policy audit_select_own on audit_log for select to authenticated
  using (user_id = auth.uid());
