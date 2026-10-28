-- One free AI Blueprint per connection.
--
-- Nothing in the free loop showed what the AI layer is like, so Premium was
-- a leap of faith. After a pair's first 20 are revealed, either member can
-- now generate one Blueprint without Premium. Premium keeps regeneration,
-- the weekly digest and the rest.
--
--   * One row per connection, ever: the primary key is the guarantee, so two
--     members clicking at once cannot both get one.
--   * Claimed by the server with the service role, only after the Blueprint
--     action's membership (RLS read), reveal and AI-availability checks; the
--     claim is deleted again if the AI call fails, so a provider error never
--     burns the pair's free Blueprint.
--   * Members can read the row (the page shows whether it has been used);
--     clients cannot write it.
--   * Cascades with the connection. claimed_by is kept for the audit trail
--     and set to null if that person deletes their account, so the free
--     Blueprint is not handed out a second time.

create table public.free_blueprint_claims (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  claimed_by    uuid references auth.users (id) on delete set null,
  claimed_at    timestamptz not null default now()
);

comment on table public.free_blueprint_claims is
  'The one free AI Blueprint a connection gets without Premium. Written by '
  'the server only; readable by the connection''s members.';

alter table public.free_blueprint_claims enable row level security;
revoke all on public.free_blueprint_claims from public, anon, authenticated;
grant select on public.free_blueprint_claims to authenticated;
grant all on public.free_blueprint_claims to service_role;

create index free_blueprint_claims_claimed_by_idx
  on public.free_blueprint_claims (claimed_by);

create policy free_blueprint_claims_members_read
  on public.free_blueprint_claims for select to authenticated
  using (public.is_connection_member(connection_id));
