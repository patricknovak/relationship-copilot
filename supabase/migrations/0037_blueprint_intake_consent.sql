-- Blueprint v2 (roadmap 13): each person may choose to include their private
-- profile reflections (goals, values, attachment result) in a connection's
-- shared Blueprint. Intake is collected as private (profiles RLS; the
-- partner_profiles view omits it), so it is never fed in silently.
--
--   * One row per (connection, person) who opted in. No row = not shared.
--   * Members of the connection can see who opted in (transparency); only
--     the person themselves can grant or revoke.
--   * The intake text itself is read by the server with the service role,
--     only for members with a row here, after the Blueprint action's
--     membership, premium and reveal checks; it is redacted before it
--     reaches the AI provider and never shown to the other person.
--   * Rows cascade with the connection and with the person's account.

create table public.blueprint_intake_consent (
  connection_id uuid not null references public.connections (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  granted_at    timestamptz not null default now(),
  primary key (connection_id, user_id)
);

comment on table public.blueprint_intake_consent is
  'Opt-in to include your private profile reflections in a connection''s '
  'AI Blueprint. Visible to the connection''s members; granted and revoked '
  'only by the person themselves.';

alter table public.blueprint_intake_consent enable row level security;
revoke all on public.blueprint_intake_consent from public, anon;
grant select, insert, delete on public.blueprint_intake_consent to authenticated;
grant all on public.blueprint_intake_consent to service_role;

create policy blueprint_intake_consent_members_read
  on public.blueprint_intake_consent for select to authenticated
  using (public.is_connection_member(connection_id));

create policy blueprint_intake_consent_self_grant
  on public.blueprint_intake_consent for insert to authenticated
  with check (user_id = auth.uid() and public.is_connection_member(connection_id));

create policy blueprint_intake_consent_self_revoke
  on public.blueprint_intake_consent for delete to authenticated
  using (user_id = auth.uid());
