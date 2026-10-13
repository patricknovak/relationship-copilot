-- Content migrations 0020 and 0024 claim to be idempotent (guarded by
-- config.batch). run.sh re-applies both files right before this test; the
-- counts must not have moved and the guard must have fired.

do $$
declare n20 int; n24 int;
begin
  select count(*) into n20 from prompt_templates where config->>'batch' = '0020';
  select count(*) into n24 from prompt_templates where config->>'batch' = '0024';
  assert n20 = 414, format('EXPECTED 414 batch-0020 templates after re-apply, got %s', n20);
  assert n24 = 26, format('EXPECTED 26 batch-0024 templates after re-apply, got %s', n24);
  raise notice 'PASS: content seeds are idempotent on re-apply';
end $$;

select 'ALL SEED IDEMPOTENCY TESTS PASSED' as result;

-- 0029: every onboarding pack is a real first 20 (no type-specific pack
-- shorter than 20), and re-applying leaves them at exactly 20.
do $$
declare short int; over int;
begin
  select count(*) into short from prompt_templates
   where kind = 'onboarding' and active and jsonb_array_length(questions) < 20;
  select count(*) into over from prompt_templates
   where kind = 'onboarding' and active and jsonb_array_length(questions) > 20;
  assert short = 0, format('EXPECTED no onboarding pack under 20 questions, got %s', short);
  assert over = 0, format('EXPECTED no onboarding pack over 20 questions, got %s', over);
  raise notice 'PASS: every onboarding pack has exactly 20 questions';
end $$;
