-- A personal note from the inviter, shown to the invitee on the invite page
-- and quoted in the share message ("Sam: 'I miss our late-night talks'").
-- Personal invites convert better than generic ones; the join step is the
-- biggest drop in the funnel.
--
-- Its own table, so the connections column guard (0014) stays untouched:
--   * only the connection's creator reads or writes it (RLS), and only
--     while the connection is still pending (writes);
--   * the invite page reads it with the service role after validating the
--     invite code, the same authorization as the existing invite preview;
--   * it cascades with the connection and with the author's account
--     (invariant 6: the leaver's own words go with them).

create table public.invite_notes (
  connection_id uuid primary key
    references public.connections (id) on delete cascade,
  author_id     uuid not null references auth.users (id) on delete cascade,
  note          text not null check (char_length(note) between 1 and 280),
  updated_at    timestamptz not null default now()
);

comment on table public.invite_notes is
  'Optional personal note from a connection''s creator to the person they '
  'invite. Creator-only under RLS; the invite page reads it server-side.';

alter table public.invite_notes enable row level security;
revoke all on public.invite_notes from public, anon;
grant select, insert, update, delete on public.invite_notes to authenticated;
grant all on public.invite_notes to service_role;

create policy invite_notes_creator_read on public.invite_notes
  for select to authenticated
  using (
    author_id = auth.uid()
    and exists (
      select 1 from public.connections c
       where c.id = connection_id and c.created_by = auth.uid()
    )
  );

create policy invite_notes_creator_write on public.invite_notes
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.connections c
       where c.id = connection_id
         and c.created_by = auth.uid()
         and c.status = 'pending'
    )
  );

create policy invite_notes_creator_update on public.invite_notes
  for update to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.connections c
       where c.id = connection_id
         and c.created_by = auth.uid()
         and c.status = 'pending'
    )
  );

create policy invite_notes_creator_delete on public.invite_notes
  for delete to authenticated
  using (author_id = auth.uid());
