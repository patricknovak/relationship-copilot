-- Daily-question loop. One daily instance per connection per day, generated
-- idempotently. The app can pull today's question on demand (ensure_daily_prompt),
-- and pg_cron pre-creates them for active connections (assign_daily_prompts).

-- Create (or return) today's daily instance for a connection. Picks a daily
-- template for the connection's type (or a generic one), preferring ones not
-- yet used by this connection so questions don't repeat until the pool is spent.
create or replace function ensure_daily_prompt(p_conn uuid, p_date date default current_date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_type connection_type;
  v_tmpl prompt_templates%rowtype;
  v_id   uuid;
begin
  -- App callers must be members; cron/service-role (auth.uid() is null) may pass.
  if auth.uid() is not null and not is_connection_member(p_conn) then
    raise exception 'not a member of this connection';
  end if;

  select id into v_id from prompt_instances
   where connection_id = p_conn and kind = 'daily' and scheduled_for = p_date;
  if found then return v_id; end if;

  select type into v_type from connections where id = p_conn;
  if v_type is null then return null; end if;

  -- Prefer an unused template; fall back to any (allowing repeats) once spent.
  select * into v_tmpl from prompt_templates t
   where t.kind = 'daily' and t.active
     and (t.relationship_type = v_type or t.relationship_type is null)
     and not exists (
       select 1 from prompt_instances i
        where i.connection_id = p_conn and i.template_id = t.id
     )
   order by (t.relationship_type = v_type) desc, random()
   limit 1;

  if not found then
    select * into v_tmpl from prompt_templates t
     where t.kind = 'daily' and t.active
       and (t.relationship_type = v_type or t.relationship_type is null)
     order by (t.relationship_type = v_type) desc, random()
     limit 1;
  end if;
  if not found then return null; end if;

  insert into prompt_instances
    (connection_id, template_id, kind, questions, scheduled_for, status)
  values
    (p_conn, v_tmpl.id, 'daily', v_tmpl.questions, p_date, 'open')
  on conflict (connection_id, kind, scheduled_for) do nothing
  returning id into v_id;

  -- Lost a race? Read the row the other writer created.
  if v_id is null then
    select id into v_id from prompt_instances
     where connection_id = p_conn and kind = 'daily' and scheduled_for = p_date;
  end if;
  return v_id;
end;
$$;

grant execute on function ensure_daily_prompt(uuid, date) to authenticated;

-- Assign today's daily prompt to every active connection. Cron/service-role only.
create or replace function assign_daily_prompts(p_date date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare c record; n int := 0;
begin
  for c in select id from connections where status = 'active' loop
    perform ensure_daily_prompt(c.id, p_date);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Schedule on Supabase (where pg_cron is available). Guarded so plain Postgres
-- used for local migration tests doesn't fail.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'assign-daily-prompts',
      '5 8 * * *',
      'select assign_daily_prompts();'
    );
  end if;
end
$$;
