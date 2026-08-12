-- Reveal-gate hardening. Two real-world holes in the mutual-reveal mechanic:
--
-- 1. A blank submission counted as "answered": inserting a row whose answers
--    were all empty strings both unlocked the partner's answers (has_answered
--    checked row existence only) and fired the reveal — an end-run around the
--    core promise, reachable from the UI with one click and from PostgREST
--    directly. A response now only counts once it has at least one non-empty
--    answer.
--
-- 2. Simultaneous submissions could strand an instance: two concurrent
--    inserts each counted only their own row (READ COMMITTED), so neither
--    revealed, and with an INSERT-only trigger nothing ever re-evaluated —
--    the pair waited on each other forever. The trigger now serializes on
--    the instance row and also fires on UPDATE, so content added to an
--    existing row re-evaluates the reveal.
--
-- Also: reveal now requires at least two joined members, so an activity
-- started before the invitee joins can no longer "solo-reveal" on the
-- creator's first answer.

-- Does a response body contain any real content?
create or replace function response_has_content(p_answers jsonb)
returns boolean language sql immutable as $$
  select exists (
    select 1 from jsonb_each_text(coalesce(p_answers, '{}'::jsonb))
    where btrim(value) <> ''
  );
$$;

-- A user has "answered" only when their response has content.
create or replace function has_answered(p_instance uuid, p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from prompt_responses r
    where r.instance_id = p_instance and r.user_id = p_user
      and response_has_content(r.answers)
  );
$$;

create or replace function maybe_reveal_instance()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  member_count   int;
  response_count int;
  conn_id        uuid;
begin
  -- Serialize concurrent submitters on the instance row; the second waits
  -- here and then counts with a fresh snapshot that includes the first.
  select connection_id into conn_id
    from prompt_instances where id = new.instance_id for update;

  select count(*) into member_count
    from connection_members where connection_id = conn_id and joined_at is not null;
  select count(*) into response_count
    from prompt_responses
   where instance_id = new.instance_id and response_has_content(answers);

  if member_count > 1 and response_count >= member_count then
    update prompt_instances
       set status = 'revealed', revealed_at = now()
     where id = new.instance_id and status = 'open';
  end if;
  return new;
end;
$$;

-- Re-evaluate on UPDATE too: an upsert that adds content to a previously
-- blank row must be able to complete the reveal.
drop trigger if exists trg_maybe_reveal_instance on prompt_responses;
create trigger trg_maybe_reveal_instance
  after insert or update on prompt_responses
  for each row execute function maybe_reveal_instance();
