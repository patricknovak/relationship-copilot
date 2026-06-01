-- Education library: evidence-based, healthy-relationship content.
-- Basic content is free; advanced packs are premium (gated by has_premium()).

create table education_articles (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  title             text not null,
  summary           text,
  body              text not null,                 -- markdown
  category          text,                          -- 'communication','conflict','attachment',...
  relationship_type connection_type,               -- null = applies to all
  life_stage        text,
  framework         text,                          -- 'gottman','attachment','aron',...
  evidence_rating   int,                           -- 1..5 stars (honesty about strength)
  is_premium        boolean not null default false,
  published         boolean not null default true,
  created_at        timestamptz not null default now()
);
create index education_articles_filter_idx
  on education_articles(relationship_type, category) where published;

alter table education_articles enable row level security;

-- Published free content is readable by everyone; premium content needs entitlement.
create policy education_select on education_articles for select to authenticated
  using (published and (not is_premium or has_premium(auth.uid())));
