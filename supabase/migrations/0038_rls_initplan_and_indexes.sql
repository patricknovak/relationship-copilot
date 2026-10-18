-- Scale pass 1: RLS initplan + covering indexes.
--
-- 1. Every policy that calls auth.uid() now calls (select auth.uid()), so
--    Postgres evaluates it once per statement instead of once per row
--    (Supabase advisor 0003_auth_rls_initplan, 25 policies). Each policy's
--    predicate is otherwise identical to what production ran before; the
--    bodies below were copied from pg_policies on 2026-10-18, so this is a
--    pure plan change. Tests 01-21 cover the behaviour.
-- 2. Covering indexes for the foreign keys the advisor flagged
--    (0001_unindexed_foreign_keys), plus the hot lookups the app and cron
--    routes make. All `if not exists`; the migration is re-runnable.

begin;

alter policy answer_reactions_delete on public.answer_reactions
  using ((user_id = (select auth.uid())));

alter policy answer_reactions_insert on public.answer_reactions
  with check (((user_id = (select auth.uid())) AND is_connection_member(( SELECT i.connection_id FROM prompt_instances i WHERE (i.id = answer_reactions.instance_id))) AND (( SELECT i.status FROM prompt_instances i WHERE (i.id = answer_reactions.instance_id)) = 'revealed'::text) AND (EXISTS ( SELECT 1 FROM prompt_responses r WHERE ((r.instance_id = answer_reactions.instance_id) AND (r.user_id = answer_reactions.target_user_id))))));

alter policy answer_reactions_update on public.answer_reactions
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

alter policy audit_select_own on public.audit_log
  using ((user_id = (select auth.uid())));

alter policy blueprint_intake_consent_self_grant on public.blueprint_intake_consent
  with check (((user_id = (select auth.uid())) AND is_connection_member(connection_id)));

alter policy blueprint_intake_consent_self_revoke on public.blueprint_intake_consent
  using ((user_id = (select auth.uid())));

alter policy connection_goals_insert on public.connection_goals
  with check (((created_by = (select auth.uid())) AND is_connection_member(connection_id)));

alter policy connections_insert on public.connections
  with check ((created_by = (select auth.uid())));

alter policy connections_select on public.connections
  using ((is_connection_member(id) OR (created_by = (select auth.uid()))));

alter policy connections_update on public.connections
  using ((is_connection_member(id) OR (created_by = (select auth.uid()))))
  with check ((is_connection_member(id) OR (created_by = (select auth.uid()))));

alter policy education_select on public.education_articles
  using ((published AND ((NOT is_premium) OR has_premium((select auth.uid())))));

alter policy invite_notes_creator_delete on public.invite_notes
  using ((author_id = (select auth.uid())));

alter policy invite_notes_creator_read on public.invite_notes
  using (((author_id = (select auth.uid())) AND (EXISTS ( SELECT 1 FROM connections c WHERE ((c.id = invite_notes.connection_id) AND (c.created_by = (select auth.uid())))))));

alter policy invite_notes_creator_update on public.invite_notes
  using ((author_id = (select auth.uid())))
  with check (((author_id = (select auth.uid())) AND (EXISTS ( SELECT 1 FROM connections c WHERE ((c.id = invite_notes.connection_id) AND (c.created_by = (select auth.uid())) AND (c.status = 'pending'::connection_status))))));

alter policy invite_notes_creator_write on public.invite_notes
  with check (((author_id = (select auth.uid())) AND (EXISTS ( SELECT 1 FROM connections c WHERE ((c.id = invite_notes.connection_id) AND (c.created_by = (select auth.uid())) AND (c.status = 'pending'::connection_status))))));

alter policy profiles_insert on public.profiles
  with check ((id = (select auth.uid())));

alter policy profiles_select on public.profiles
  using ((id = (select auth.uid())));

alter policy profiles_update on public.profiles
  using ((id = (select auth.uid())))
  with check ((id = (select auth.uid())));

alter policy discussions_insert on public.prompt_discussions
  with check (((user_id = (select auth.uid())) AND (( SELECT i.status FROM prompt_instances i WHERE (i.id = prompt_discussions.instance_id)) = 'revealed'::text)));

alter policy responses_insert on public.prompt_responses
  with check (((user_id = (select auth.uid())) AND is_connection_member(( SELECT i.connection_id FROM prompt_instances i WHERE (i.id = prompt_responses.instance_id))) AND (EXISTS ( SELECT 1 FROM prompt_instances i WHERE ((i.id = prompt_responses.instance_id) AND (i.status = 'open'::text))))));

alter policy responses_select on public.prompt_responses
  using (((user_id = (select auth.uid())) OR (is_connection_member(( SELECT i.connection_id FROM prompt_instances i WHERE (i.id = prompt_responses.instance_id))) AND has_answered(instance_id, (select auth.uid())))));

alter policy responses_update on public.prompt_responses
  using (((user_id = (select auth.uid())) AND (( SELECT i.status FROM prompt_instances i WHERE (i.id = prompt_responses.instance_id)) = 'open'::text)))
  with check ((user_id = (select auth.uid())));

alter policy insights_select on public.relationship_insights
  using ((is_connection_member(connection_id) AND ((audience = 'shared'::text) OR (for_user = (select auth.uid())))));

alter policy safety_select on public.safety_events
  using ((user_id = (select auth.uid())));

alter policy subscriptions_select on public.subscriptions
  using ((user_id = (select auth.uid())));


-- Foreign keys without a covering index (advisor list) ------------------
create index if not exists answer_reactions_user_idx on public.answer_reactions (user_id);
create index if not exists answer_reactions_target_user_idx on public.answer_reactions (target_user_id);
create index if not exists blueprint_intake_consent_user_idx on public.blueprint_intake_consent (user_id);
create index if not exists connection_goals_created_by_idx on public.connection_goals (created_by);
create index if not exists connections_created_by_idx on public.connections (created_by);
create index if not exists invite_notes_author_idx on public.invite_notes (author_id);
create index if not exists notification_log_user_idx on public.notification_log (user_id);
create index if not exists prompt_discussions_user_idx on public.prompt_discussions (user_id);
create index if not exists prompt_instances_template_idx on public.prompt_instances (template_id);
create index if not exists prompt_responses_user_idx on public.prompt_responses (user_id);
create index if not exists relationship_insights_for_user_idx on public.relationship_insights (for_user);
create index if not exists safety_events_user_idx on public.safety_events (user_id);

-- Hot paths without a matching index ------------------------------------
-- Cron pages active connections by id; the hub and the reminder look up a
-- connection's daily instance by date; turn_reminder_candidates scans every
-- open first-set/quiz/challenge instance across all connections.
create index if not exists connections_status_id_idx on public.connections (status, id);
create index if not exists prompt_instances_conn_kind_scheduled_idx
  on public.prompt_instances (connection_id, kind, scheduled_for);
create index if not exists prompt_instances_open_kind_idx
  on public.prompt_instances (kind, created_at) where status = 'open';

commit;
