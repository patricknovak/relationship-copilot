-- Once-only claims for funnel steps `invite_sent` and `partner_joined`.
--
-- Complements 0017's first_mutual_reveal_completed claim so the invite → join
-- → reveal funnel is measurable in Supabase (and via GA4 MP from the app).
-- Additive only: does not change the mutual-reveal gate, accept_invite, or
-- invite RLS.
--
-- Backfill below is inferred from membership counts — we only mark invite_sent
-- when a partner has already joined (honest proof the invite left the product).

create table public.connection_funnel_steps (
  connection_id uuid not null
    references public.connections (id) on delete cascade,
  step text not null
    check (step in ('invite_sent', 'partner_joined')),
  claimed_at timestamptz not null default now(),
  primary key (connection_id, step)
);

comment on table public.connection_funnel_steps is
  'Once-only claim markers for invite_sent / partner_joined funnel steps. '
  'No client DML; claim via claim_funnel_step(). Stores only connection_id '
  '(internal); never exported to analytics payloads.';

alter table public.connection_funnel_steps enable row level security;

revoke all on public.connection_funnel_steps from public, anon, authenticated;

drop policy if exists connection_funnel_steps_deny_clients
  on public.connection_funnel_steps;
create policy connection_funnel_steps_deny_clients
  on public.connection_funnel_steps
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.connection_funnel_steps to service_role;

-- Atomically claim a funnel step for a connection the caller belongs to.
-- Returns true only when this call inserted the marker (exactly one winner
-- under concurrency). partner_joined also requires two joined members.
create or replace function public.claim_funnel_step(
  p_connection_id uuid,
  p_step text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_step text;
  joined_count int;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_step is null or p_step not in ('invite_sent', 'partner_joined') then
    return false;
  end if;

  if not exists (
    select 1
    from public.connection_members m
    where m.connection_id = p_connection_id
      and m.user_id = auth.uid()
      and m.joined_at is not null
  ) then
    return false;
  end if;

  if p_step = 'partner_joined' then
    select count(*)::int into joined_count
      from public.connection_members m
     where m.connection_id = p_connection_id
       and m.joined_at is not null;
    if joined_count < 2 then
      return false;
    end if;
  end if;

  insert into public.connection_funnel_steps (connection_id, step)
  values (p_connection_id, p_step)
  on conflict (connection_id, step) do nothing
  returning step into inserted_step;

  return inserted_step is not null;
end;
$$;

comment on function public.claim_funnel_step(uuid, text) is
  'Returns true iff this call claimed the once-only funnel step marker for a '
  'connection the caller belongs to. partner_joined requires two joined '
  'members. Steps: invite_sent, partner_joined.';

revoke all on function public.claim_funnel_step(uuid, text)
  from public, anon;
revoke execute on function public.claim_funnel_step(uuid, text)
  from public, anon;
grant execute on function public.claim_funnel_step(uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Inferred backfill (honest only): a second joined member is proof an invite
-- left the product and that a partner joined. Solo connections with an unused
-- invite_code are NOT marked invite_sent — creation alone is not a send.
-- ---------------------------------------------------------------------------

-- invite_sent: connections that already have two joined members.
insert into public.connection_funnel_steps (connection_id, step, claimed_at)
select c.id,
       'invite_sent',
       coalesce(c.created_at, now())
  from public.connections c
 where (
   select count(*)::int
     from public.connection_members m
    where m.connection_id = c.id
      and m.joined_at is not null
 ) >= 2
on conflict (connection_id, step) do nothing;

-- partner_joined: same cohort; claimed_at = earliest non-creator joined_at.
insert into public.connection_funnel_steps (connection_id, step, claimed_at)
select c.id,
       'partner_joined',
       coalesce(
         (
           select min(m.joined_at)
             from public.connection_members m
            where m.connection_id = c.id
              and m.joined_at is not null
              and (c.created_by is null or m.user_id is distinct from c.created_by)
         ),
         now()
       )
  from public.connections c
 where (
   select count(*)::int
     from public.connection_members m
    where m.connection_id = c.id
      and m.joined_at is not null
 ) >= 2
on conflict (connection_id, step) do nothing;
