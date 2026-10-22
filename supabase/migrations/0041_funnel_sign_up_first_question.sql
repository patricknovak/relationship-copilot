-- Once-only claims for GA4 funnel steps `sign_up_completed` (per user) and
-- `first_question_answered` (per connection). Complements invite_sent /
-- partner_joined (0018) and answered_before_join (0033). Additive only:
-- does not change the mutual-reveal gate or invite RLS.
--
-- Payloads stay anonymous in app code (lib/ga4.ts) — these tables store only
-- internal ids for the claim race, never exported to Measurement Protocol.

-- ---------------------------------------------------------------------------
-- Per-user: sign_up_completed
-- ---------------------------------------------------------------------------

create table public.user_funnel_steps (
  user_id uuid not null
    references auth.users (id) on delete cascade,
  step text not null
    check (step in ('sign_up_completed')),
  claimed_at timestamptz not null default now(),
  primary key (user_id, step)
);

comment on table public.user_funnel_steps is
  'Once-only claim markers for per-user funnel steps (sign_up_completed). '
  'No client DML; claim via claim_user_funnel_step(). Stores only user_id '
  '(internal); never exported to analytics payloads.';

alter table public.user_funnel_steps enable row level security;

revoke all on public.user_funnel_steps from public, anon, authenticated;

drop policy if exists user_funnel_steps_deny_clients
  on public.user_funnel_steps;
create policy user_funnel_steps_deny_clients
  on public.user_funnel_steps
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant all on public.user_funnel_steps to service_role;

create or replace function public.claim_user_funnel_step(p_step text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_step text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_step is null or p_step not in ('sign_up_completed') then
    return false;
  end if;

  insert into public.user_funnel_steps (user_id, step)
  values (auth.uid(), p_step)
  on conflict (user_id, step) do nothing
  returning step into inserted_step;

  return inserted_step is not null;
end;
$$;

comment on function public.claim_user_funnel_step(text) is
  'Returns true iff this call claimed the once-only per-user funnel step '
  '(sign_up_completed) for auth.uid().';

revoke all on function public.claim_user_funnel_step(text)
  from public, anon;
revoke execute on function public.claim_user_funnel_step(text)
  from public, anon;
grant execute on function public.claim_user_funnel_step(text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Per-connection: first_question_answered
-- ---------------------------------------------------------------------------

alter table public.connection_funnel_steps
  drop constraint if exists connection_funnel_steps_step_check;
alter table public.connection_funnel_steps
  add constraint connection_funnel_steps_step_check
  check (step in (
    'invite_sent',
    'partner_joined',
    'answered_before_join',
    'first_question_answered'
  ));

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

  if p_step is null
     or p_step not in (
       'invite_sent',
       'partner_joined',
       'answered_before_join',
       'first_question_answered'
     ) then
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

  select count(*)::int into joined_count
    from public.connection_members m
   where m.connection_id = p_connection_id
     and m.joined_at is not null;

  if p_step = 'partner_joined' and joined_count < 2 then
    return false;
  end if;

  -- Only while the caller is still alone, and only after they have answered.
  if p_step = 'answered_before_join' then
    if joined_count <> 1 then
      return false;
    end if;
    if not exists (
      select 1
        from public.prompt_instances i
        join public.prompt_responses r
          on r.instance_id = i.id and r.user_id = auth.uid()
       where i.connection_id = p_connection_id
         and i.kind = 'onboarding'
         and public.response_has_content(r.answers)
    ) then
      return false;
    end if;
  end if;

  -- First onboarding answer on this connection (partner present or not).
  if p_step = 'first_question_answered' then
    if not exists (
      select 1
        from public.prompt_instances i
        join public.prompt_responses r
          on r.instance_id = i.id and r.user_id = auth.uid()
       where i.connection_id = p_connection_id
         and i.kind = 'onboarding'
         and public.response_has_content(r.answers)
    ) then
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
  'members; answered_before_join requires the caller alone with an onboarding '
  'answer; first_question_answered requires the caller has an onboarding '
  'answer. Steps: invite_sent, partner_joined, answered_before_join, '
  'first_question_answered.';
