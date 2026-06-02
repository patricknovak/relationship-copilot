-- Phase 6 — parent ↔ teen content (emotion-coaching, autonomy-supportive). The
-- track is designed as connection, not surveillance: trust-first prompts, teen
-- can leave anytime (handled in the app). Full minor-compliance (COPPA /
-- GDPR-K, verifiable consent) requires legal review and is not granted by code.

insert into prompt_templates (kind, relationship_type, framework, title, description, source, questions) values
('daily','parent_child','emotion_coaching', 'Daily — Parent & Teen', null, 'seed',
  $j$[{"id":"q1","text":"What was a high and a low of your day?","format":"free_text"}]$j$::jsonb),
('daily','parent_child','autonomy_support', 'Daily — Parent & Teen', null, 'seed',
  $j$[{"id":"q1","text":"What is something you are looking forward to, big or small?","format":"free_text"}]$j$::jsonb),

('quiz','parent_child','emotion_coaching',
 'How we talk when things are hard',
 'A gentle, teen-friendly reflection. Not a test — just a way to understand each other.',
 'seed',
 $j$[
  {"id":"q1","text":"When I am upset, what helps most from the other person?","format":"choice","options":["Just listen","Help me solve it","Give me space first","A hug or comfort"]},
  {"id":"q2","text":"I feel like the other person really listens to me.","format":"scale","min":1,"max":5},
  {"id":"q3","text":"One thing I wish the other person understood about me is...","format":"free_text"}
 ]$j$::jsonb),

('challenge','parent_child','connection',
 'Do something fun together',
 'Shared positive time builds the trust that hard conversations need.',
 'seed',
 $j$[{"id":"q1","text":"Pick one fun thing to do together this week. Afterward: what was the best part?","format":"free_text"}]$j$::jsonb),
('challenge','parent_child','emotion_coaching',
 'Name a feeling',
 'Validating emotions before problem-solving (emotion coaching).',
 'seed',
 $j$[{"id":"q1","text":"Share one feeling you had this week and what was behind it — no fixing, just understanding.","format":"free_text"}]$j$::jsonb);
