-- Shared goals and rituals. Roadmap item 14 (docs/ROADMAP.md): a small
-- both-edit list per connection ("things we're trying"), so the pair has
-- somewhere to put what the reveals surface. Either member may add, tick
-- off, edit or remove an item. Nothing here is gated by the reveal rule:
-- goals are deliberately shared from the moment they are written.
--
-- Account deletion keeps the list for the remaining member (created_by is
-- set null; the text stays), matching "redact, partner keeps theirs" for
-- content that was shared on purpose.

create table public.connection_goals (
  id            uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  created_by    uuid references public.profiles (id) on delete set null,
  body          text not null check (length(btrim(body)) between 1 and 200),
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index connection_goals_connection_idx
  on public.connection_goals (connection_id, done_at, created_at);

comment on table public.connection_goals is
  'Both-edit list of things a pair is trying. Members only; shared on purpose, not reveal-gated.';

alter table public.connection_goals enable row level security;

create policy connection_goals_select on public.connection_goals
  for select to authenticated
  using (is_connection_member(connection_id));

create policy connection_goals_insert on public.connection_goals
  for insert to authenticated
  with check (created_by = auth.uid() and is_connection_member(connection_id));

create policy connection_goals_update on public.connection_goals
  for update to authenticated
  using (is_connection_member(connection_id))
  with check (is_connection_member(connection_id));

create policy connection_goals_delete on public.connection_goals
  for delete to authenticated
  using (is_connection_member(connection_id));

grant select, insert, update, delete on public.connection_goals to authenticated;
grant all on public.connection_goals to service_role;

-- Keep connection_id and created_by fixed after insert; members may change
-- body and done_at only.
create or replace function public.connection_goals_protect_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if new.id is distinct from old.id
       or new.connection_id is distinct from old.connection_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
    then
      raise exception 'connection_goals: column update not permitted';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_connection_goals_protect on public.connection_goals;
create trigger trg_connection_goals_protect
  before update on public.connection_goals
  for each row execute function public.connection_goals_protect_columns();
