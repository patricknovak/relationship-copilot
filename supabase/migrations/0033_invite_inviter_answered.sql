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
