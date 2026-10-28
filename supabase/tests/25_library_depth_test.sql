-- Migration 0044: the library has real depth, friends have reads, and the
-- migration is safe to re-run (it was just applied twice by run.sh).

do $$
declare n int;
begin
  -- Every 0003 read is now a real article, not a two-line stub.
  select count(*) into n from education_articles
   where slug in ('four-horsemen','bids-for-connection','attachment-basics',
                  '36-questions','repair-attempts','parent-teen-emotion-coaching')
     and length(body) > 2000;
  assert n = 6, format('EXPECTED 6 deepened reads, got %s', n);

  -- Friends, the lead marketing segment, have free reads of their own.
  select count(*) into n from education_articles
   where relationship_type = 'friend' and not is_premium and published;
  assert n >= 2, format('EXPECTED at least 2 free friend reads, got %s', n);

  -- "Deeper premium library reads" is true: every Premium read is long.
  select count(*) into n from education_articles where is_premium and length(body) < 3000;
  assert n = 0, format('%s Premium reads are shorter than 3000 characters', n);

  -- No duplicates from re-applying.
  select count(*) into n from education_articles
   where slug in ('friendships-that-last','reconnecting-with-an-old-friend',
                  'you-and-your-parents-as-adults','when-things-go-right','when-a-friendship-hurts');
  assert n = 5, format('EXPECTED 5 new reads exactly once, got %s', n);

  -- Every body renders as plain paragraphs and lists: no HTML.
  select count(*) into n from education_articles where body ~ '<[a-zA-Z/]';
  assert n = 0, 'article bodies must not contain HTML';

  raise notice 'PASS: library depth (deepened, friend reads, premium depth, idempotent)';
end $$;
