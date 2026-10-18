-- The Aron et al. closeness procedure is 36 questions, not 20; the seed title
-- from 0003 conflated it with our 20-question onboarding set. Slug unchanged
-- so existing links keep working.
update public.education_articles
   set title = 'The science behind the "36 questions"'
 where slug = '36-questions';
