-- Business Onboarding Intake — per-business schema
-- Run once against a freshly created Railway Postgres for each new business.
-- One row per business (this Postgres instance only ever holds one business's data).

create table if not exists intake_data (
  id bigint generated always as identity primary key,

  -- Business Identity
  business_name text,
  business_description text,
  industry text,
  primary_color text,
  secondary_color text,
  accent_color text,
  logo_url text,
  font_names text,

  -- Audience
  audience_role text,
  audience_pain_points text,
  fit_criteria text,
  channels text,
  audience_sophistication text,

  -- Voice & Hard Rules
  tone_descriptors text,
  words_to_avoid text,
  forbidden_claims text,

  -- Content Structure
  formats text,
  content_lanes text,
  content_natures text,

  -- Sources
  source_feeds text,

  -- Posting Defaults
  posting_timezone text,
  posting_time text,
  posting_cadence text,

  -- Raw + tracking
  raw_intake_dump text,
  status text not null default 'collecting', -- collecting | ready | graduated
  completeness_pct numeric,
  missing_fields text, -- JSON array, plain-language gap report cache

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce single-row-per-instance at the app layer (functions always upsert id=1).
insert into intake_data (id, status) values (1, 'collecting')
  on conflict (id) do nothing;
