-- 0046: close write-side gaps found in the pre-launch security review
-- (2026-11-24). None of these let anyone READ another couple's answers (the
-- reveal gate in responses_select is unchanged), but each let a signed-in
-- user WRITE somewhere the app never intended, by calling the REST API
-- directly instead of going through a server action.
--
--   1. prompt_discussions: insert checked "is the instance revealed" but not
--      "is the author a member". Anyone holding an instance id could post
--      into another couple's discussion.
--   2. prompt_responses: update re-checked only user_id, so a row could be
--      re-pointed (instance_id) at an instance in someone else's connection.
--      The reveal trigger then counted that outsider row and could flip the
--      other couple's instance to "revealed" early, locking out the member
--      who had not answered yet.
--   3. answer_reactions: update had the same re-pointing gap.
--   4. maybe_reveal_instance: only counts answers from joined members, so the
--      reveal can never depend on a row from outside the connection.
--   5. connections: once someone leaves (archived) or a connection is
--      blocked, the other member could set status back to "active" with a
--      direct update. Leaving is now final from the client side; only server
--      code (service role) can change a closed connection's status.
--   6. connections: the free-plan cap (3 live connections) was enforced only
--      in the createConnection action. It is now also enforced by the insert
--      policy, with the same definition of "live" and the same has_premium()
--      entitlement the rest of the app uses.
--   7. Table privileges: anon/authenticated held TRUNCATE, REFERENCES and
--      TRIGGER on every public table. Nothing reachable through the API uses
--      them and RLS does not apply to TRUNCATE, so they are revoked.
--
-- Idempotent: policies are altered in place, functions are replaced, and the
-- revoke is a no-op where the privilege is not held.

-- ---------------------------------------------------------------------------
-- 1. Discussions: members only, after reveal.
-- ---------------------------------------------------------------------------
alter policy discussions_insert on public.prompt_discussions
  with check (
    user_id = (select auth.uid())
    and public.is_connection_member(
      (select i.connection_id from public.prompt_instances i
        where i.id = prompt_discussions.instance_id)
    )
    and (select i.status from public.prompt_instances i
          where i.id = prompt_discussions.instance_id) = 'revealed'
  );

-- ---------------------------------------------------------------------------
-- 2. Responses: the row an update produces must satisfy the insert rules
--    (own row, member of the instance's connection, instance still open).
-- ---------------------------------------------------------------------------
alter policy responses_update on public.prompt_responses
  using (
    user_id = (select auth.uid())
    and (select i.status from public.prompt_instances i
          where i.id = prompt_responses.instance_id) = 'open'
  )
  with check (
    user_id = (select auth.uid())
    and public.is_connection_member(
      (select i.connection_id from public.prompt_instances i
        where i.id = prompt_responses.instance_id)
    )
    and (select i.status from public.prompt_instances i
          where i.id = prompt_responses.instance_id) = 'open'
  );

-- ---------------------------------------------------------------------------
-- 3. Reactions: the row an update produces must satisfy the insert rules.
-- ---------------------------------------------------------------------------
alter policy answer_reactions_update on public.answer_reactions
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and public.is_connection_member(
      (select i.connection_id from public.prompt_instances i
        where i.id = answer_reactions.instance_id)
    )
    and (select i.status from public.prompt_instances i
          where i.id = answer_reactions.instance_id) = 'revealed'
    and exists (
      select 1 from public.prompt_responses r
       where r.instance_id = answer_reactions.instance_id
         and r.user_id = answer_reactions.target_user_id
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Reveal trigger: count answers from joined members only. Otherwise
--    unchanged from 0014 (same lock, same "more than one member" rule).
-- ---------------------------------------------------------------------------
create or replace function public.maybe_reveal_instance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_count   int;
  response_count int;
  conn_id        uuid;
begin
  select connection_id into conn_id
    from prompt_instances where id = new.instance_id for update;

  select count(*) into member_count
    from connection_members
   where connection_id = conn_id and joined_at is not null;
  select count(*) into response_count
    from prompt_responses r
   where r.instance_id = new.instance_id
     and response_has_content(r.answers)
     and exists (
       select 1 from connection_members m
        where m.connection_id = conn_id
          and m.user_id = r.user_id
          and m.joined_at is not null
     );

  if member_count > 1 and response_count >= member_count then
    perform set_config('app.bypass_instance_guards', '1', true);
    update prompt_instances
       set status = 'revealed', revealed_at = now()
     where id = new.instance_id and status = 'open';
  end if;
  return new;
end;
$$;

revoke execute on function public.maybe_reveal_instance() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Connections: a closed connection stays closed for clients. Same guard
--    as 0014 (frozen identity/invite columns) plus the status rule.
-- ---------------------------------------------------------------------------
create or replace function public.connections_protect_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and current_setting('app.bypass_connection_guards', true) is distinct from '1'
  then
    if new.id is distinct from old.id
       or new.type is distinct from old.type
       or new.created_by is distinct from old.created_by
       or new.invite_code is distinct from old.invite_code
       or new.invite_expires_at is distinct from old.invite_expires_at
       or new.sub_type is distinct from old.sub_type
       or new.life_stage is distinct from old.life_stage
       or new.start_date is distinct from old.start_date
       or new.metadata is distinct from old.metadata
       or new.created_at is distinct from old.created_at
    then
      raise exception 'connections: column update not permitted';
    end if;
    if old.status in ('archived', 'blocked')
       and new.status is distinct from old.status
    then
      raise exception 'connections: a closed connection cannot be reopened';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Free-plan cap in the insert policy. SECURITY INVOKER on purpose: the
--    count runs under the caller's own RLS, so "my live connections" means
--    exactly what the createConnection action counts. VOLATILE so each row
--    of a multi-row insert sees the rows before it. Keep the number in sync
--    with FREE_CONNECTION_CAP (web/lib/relationships.ts).
-- ---------------------------------------------------------------------------
create or replace function public.can_create_connection()
returns boolean
language sql
volatile
set search_path = ''
as $$
  select auth.uid() is not null
     and (
       public.has_premium(auth.uid())
       or (select count(*) from public.connections c
            where c.status <> 'archived') < 3
     );
$$;

revoke execute on function public.can_create_connection() from public, anon;
grant execute on function public.can_create_connection() to authenticated, service_role;

alter policy connections_insert on public.connections
  with check (
    created_by = (select auth.uid())
    and public.can_create_connection()
  );

-- ---------------------------------------------------------------------------
-- 7. Privileges no API path uses.
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
