-- Reactions on revealed answers. Roadmap item 9 (docs/ROADMAP.md).
--
-- One tap per answer ("❤️", "😂", "🥹", "👀") as a lighter step than a
-- discussion reply. One reaction per (instance, reactor, answer owner,
-- question); changing it replaces it. Only members of the instance's
-- connection can see reactions, only after the instance has revealed, and
-- you can react only to someone else's answer. Because reactions exist only
-- for revealed instances, they can never signal anything about an answer
-- you aren't yet allowed to read: the mutual-reveal gate is untouched.

create table public.answer_reactions (
  instance_id uuid not null
    references public.prompt_instances (id) on delete cascade,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  target_user_id uuid not null
    references auth.users (id) on delete cascade,
  question_id text not null,
  emoji text not null check (emoji in ('❤️', '😂', '🥹', '👀')),
  created_at timestamptz not null default now(),
  primary key (instance_id, user_id, target_user_id, question_id),
  check (user_id <> target_user_id)
);

comment on table public.answer_reactions is
  'One emoji per reactor per revealed answer. Members only; revealed instances only.';

alter table public.answer_reactions enable row level security;

create policy answer_reactions_select on public.answer_reactions
  for select to authenticated
  using (
    is_connection_member(
      (select i.connection_id from public.prompt_instances i where i.id = instance_id)
    )
  );

create policy answer_reactions_insert on public.answer_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_connection_member(
      (select i.connection_id from public.prompt_instances i where i.id = instance_id)
    )
    and (select i.status from public.prompt_instances i where i.id = instance_id) = 'revealed'
    and exists (
      select 1 from public.prompt_responses r
      where r.instance_id = answer_reactions.instance_id
        and r.user_id = answer_reactions.target_user_id
    )
  );

create policy answer_reactions_update on public.answer_reactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy answer_reactions_delete on public.answer_reactions
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.answer_reactions to authenticated;
grant all on public.answer_reactions to service_role;

-- Live: the other person sees your reaction land without a refresh.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.answer_reactions;
  end if;
end $$;
