-- Once-only claim for GA4 north-star `first_mutual_reveal_completed`.
--
-- Concurrent final submits can both observe status='revealed' after the
-- maybe_reveal_instance trigger serializes the transition. App-side counting
-- alone can therefore double-fire. This migration adds a connection-scoped
-- unique claim; only the winner schedules the Measurement Protocol send.
--
-- Does not change the mutual-reveal gate, RLS on prompt_responses, or
-- maybe_reveal_instance behavior.

create table public.connection_first_reveal_ga4 (
  connection_id uuid primary key
    references public.connections (id) on delete cascade,
  claimed_at timestamptz not null default now()
);

comment on table public.connection_first_reveal_ga4 is
  'Once-only claim marker for server-side first_mutual_reveal_completed GA4. '
  'No client DML; claim via claim_first_mutual_reveal_ga4(). Stores only '
  'connection_id (internal); never exported to analytics payloads.';

alter table public.connection_first_reveal_ga4 enable row level security;

revoke all on public.connection_first_reveal_ga4 from public, anon, authenticated;

drop policy if exists connection_first_reveal_ga4_deny_clients
  on public.connection_first_reveal_ga4;
create policy connection_first_reveal_ga4_deny_clients
  on public.connection_first_reveal_ga4
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.connection_first_reveal_ga4 to service_role;

-- Atomically claim the connection's first mutual-reveal GA4 slot.
-- Returns true only when this call inserted the marker (exactly one winner
-- under concurrency; false for non-members, non-first reveals, or losers).
create or replace function public.claim_first_mutual_reveal_ga4(p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted uuid;
begin
  if auth.uid() is null then
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

  insert into public.connection_first_reveal_ga4 (connection_id)
  select p_connection_id
  where (
    select count(*)::int
    from public.prompt_instances pi
    where pi.connection_id = p_connection_id
      and pi.status = 'revealed'
  ) = 1
  on conflict (connection_id) do nothing
  returning connection_id into inserted;

  return inserted is not null;
end;
$$;

comment on function public.claim_first_mutual_reveal_ga4(uuid) is
  'Returns true iff this call claimed the once-only first-mutual-reveal GA4 '
  'marker for a connection the caller belongs to. Firstness is checked in the '
  'DB (exactly one revealed prompt_instances row).';

revoke all on function public.claim_first_mutual_reveal_ga4(uuid)
  from public, anon;
revoke execute on function public.claim_first_mutual_reveal_ga4(uuid)
  from public, anon;
grant execute on function public.claim_first_mutual_reveal_ga4(uuid)
  to authenticated, service_role;
