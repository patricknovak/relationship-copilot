-- The library is advertised as free and public (landing hero, FAQ, footer),
-- but its select policy was scoped to authenticated users only — signed-out
-- visitors bounced to /login and, even without the middleware gate, would
-- have read zero rows. Published free articles are now world-readable;
-- premium articles still require entitlement (and therefore sign-in).
create policy education_select_anon on education_articles
  for select to anon
  using (published and not is_premium);
