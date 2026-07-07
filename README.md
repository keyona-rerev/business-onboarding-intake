# Business Onboarding Intake

Collects and verifies a new business's setup information before it graduates
into a real Knowledge Loom Prismm instance. One shared login screen, one
Railway Postgres per business (disposable, torn down after graduation),
Wayfinder holds the mapping from login to business.

## How a new business gets added

This is documented as a procedure template in Wayfinder
(`procedure_templates` / `procedure_steps`, attached to the
`business-onboarding-intake` project). Short version:

1. Keyona says "spin up a new onboarding instance for [Business Name]"
2. Claude creates a Railway project + Postgres for that business
3. Claude runs `schema.sql` against it
4. Claude asks Keyona for the login she wants to set
5. Claude writes one row into Wayfinder's `business_intake_instances` table
   mapping that login (bcrypt-hashed password) to the new Railway project
6. Keyona gets back one link (same URL for every business) and the login to send

## Environment variables (Netlify site settings)

- `WAYFINDER_SUPABASE_URL` — Wayfinder's Supabase project URL
- `WAYFINDER_SUPABASE_ANON_KEY` — Wayfinder's Supabase anon key (RLS policy is
  "anon full access" on the intake mapping table, matching the rest of Wayfinder)
- `ANTHROPIC_API_KEY` — used by `intake-submit` to extract structured fields
  from the raw paste
- `INTAKE_JWT_SECRET` — signs the session cookie issued at login; generate a
  long random string, do not reuse a secret from another project

## Data model

`schema.sql` is the per-business schema, run once per new Railway Postgres.
It holds a single row (`id = 1`) per business across the fields defined in
`netlify/functions/_lib/fields.js`, which is the single source of truth for
what's required vs optional — both the AI extraction step and the
completeness check read from that same file so they can't drift apart.

## What's built vs what's still manual

Built: login, intake paste + AI extraction, deterministic completeness
scoring, plain-language gap report, Wayfinder sync of completeness per business.

Still manual / not yet built: the graduation step itself (cloning the
Knowledge Loom Prismm repo, provisioning that business's real Supabase
project, seeding it from the finished intake record, then decommissioning
this Railway project). That's the next phase once the intake side has been
used for real.
