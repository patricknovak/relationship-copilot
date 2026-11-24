-- Daily questions: the pair's own relationship type comes first.
--
-- ensure_daily_prompt (0025) picks a template with
--   order by (t.relationship_type = v_type) desc, random()
-- meaning "questions written for this relationship type first, generic ones
-- as the fallback". For a generic template relationship_type is NULL, so the
-- comparison is NULL, and Postgres sorts NULLs FIRST under DESC. The order
-- was therefore the reverse of the intent: every pair worked through the
-- whole generic pool (about two months of days) before seeing a single
-- question written for a romantic partner, a sibling, a coworker and so on.
--
-- Same function body as 0025 with the sort key made a real boolean
-- (coalesce(..., false)), in both the unseen-first pick and the repeat
-- fallback. Nothing else changes: same signature, membership check, date
-- handling, idempotency, and grants (create or replace keeps them). Existing
-- instances are untouched; only future days pick differently. Does not touch
-- the mutual-reveal gate.
--
-- Needs Patrick's explicit go before it is applied to production.

create or replace function public.ensure_daily_prompt(p_conn uuid, p_date date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.connection_type;
  v_tmpl public.prompt_templates%rowtype;
  v_id   uuid;
  v_date date;
begin
  if auth.uid() is not null and not public.is_connection_member(p_conn) then
    raise exception 'not a member of this connection';
  end if;

  v_date := coalesce(p_date, public.connection_today(p_conn));

  select id into v_id from public.prompt_instances
   where connection_id = p_conn and kind = 'daily' and scheduled_for = v_date;
  if found then return v_id; end if;

  select type into v_type from public.connections where id = p_conn;
  if v_type is null then return null; end if;

  select * into v_tmpl from public.prompt_templates t
   where t.kind = 'daily' and t.active
     and (t.relationship_type = v_type or t.relationship_type is null)
     and not exists (
       select 1 from public.prompt_instances i
        where i.connection_id = p_conn and i.template_id = t.id
     )
   order by coalesce(t.relationship_type = v_type, false) desc, random()
   limit 1;

  if not found then
    select * into v_tmpl from public.prompt_templates t
     where t.kind = 'daily' and t.active
       and (t.relationship_type = v_type or t.relationship_type is null)
     order by coalesce(t.relationship_type = v_type, false) desc, random()
     limit 1;
  end if;
  if not found then return null; end if;

  insert into public.prompt_instances
    (connection_id, template_id, kind, questions, scheduled_for, status)
  values
    (p_conn, v_tmpl.id, 'daily', v_tmpl.questions, v_date, 'open')
  on conflict (connection_id, kind, scheduled_for) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.prompt_instances
     where connection_id = p_conn and kind = 'daily' and scheduled_for = v_date;
  end if;
  return v_id;
end;
$$;
