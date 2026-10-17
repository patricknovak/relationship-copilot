-- Answer first, while you wait (activation).
--
-- The inviter can now answer the connection's first questions before their
-- person joins. Nothing about the reveal gate changes:
--   * maybe_reveal_instance (0014) only reveals when more than one member has
--     joined and every joined member has answered, so a solo answer can never
--     reveal;
--   * responses_select (0001) lets you read a co-member's row only after you
--     have answered yourself, so the invitee still sees nothing until they
--     share.
--
-- This migration adds one lookup for the public invite page: "has the person
-- who invited you already answered?" Boolean only, never answer text. The
-- invite code is the authorization (same as the existing invite preview), and
-- only the server's service role may call it; anon and authenticated cannot,
-- so it cannot be used to probe codes from a browser.

create or replace function public.invite_inviter_has_answered(p_code text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.connections c
      join public.prompt_instances i
        on i.connection_id = c.id and i.kind = 'onboarding'
      join public.prompt_responses r
        on r.instance_id = i.id and r.user_id = c.created_by
     where c.invite_code = upper(trim(p_code))
       and c.invite_expires_at is not null
       and c.invite_expires_at > now()
       and c.status not in ('archived', 'blocked')
       and public.response_has_content(r.answers)
  );
$$;

revoke all on function public.invite_inviter_has_answered(text) from public, anon, authenticated;
grant execute on function public.invite_inviter_has_answered(text) to service_role;

-- Measuring answer-first (roadmap §6): a once-only funnel step when the
-- inviter submits their first answers before their person has joined, so
-- join and reveal rates can be compared for connections with and without it.
-- Same table and claim function as invite_sent / partner_joined (0018).
alter table public.connection_funnel_steps
  drop constraint if exists connection_funnel_steps_step_check;
alter table public.connection_funnel_steps
  add constraint connection_funnel_steps_step_check
  check (step in ('invite_sent', 'partner_joined', 'answered_before_join'));

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
     or p_step not in ('invite_sent', 'partner_joined', 'answered_before_join') then
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
  'answer. Steps: invite_sent, partner_joined, answered_before_join.';
