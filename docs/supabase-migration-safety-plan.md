# Supabase Migration Safety Plan (No Production Changes)

Status: planning only. This document does not apply SQL, move data, change runtime configuration, or alter existing application files.

## Guardrails

- Keep Render service `faznetwork-web` and Render PostgreSQL as the current production system.
- Do not change `DATABASE_URL`, RouterOS/MikroTik settings, payment webhooks, or customer records.
- Do not enable Supabase production deploys from GitHub while reviewing or testing migrations.
- Keep this plan on an isolated branch until reviewed. Do not merge it to `main` without explicit approval.
- Do not make the repository public.

## Findings from the current repository and Supabase project

- Application schema source: `db/schema.sql`.
- Existing incremental migration: `migrations/20261011_olt_telemetry.sql`.
- The repository currently has no `supabase/` directory or `supabase/migrations/` directory.
- Supabase project `faznetwork` has no application tables in `public` and no recorded migrations at the time of inspection.
- The Node application uses PostgreSQL through `pg`; its existing production database connection must remain unchanged during this work.

## Why the existing SQL must not be copied and auto-applied blindly

The schema file mixes table creation with later compatibility alterations and data-changing statements. Examples include updates to rows in `transactions`, dropping/re-adding constraints, changing column types, and inserting default settings. Those statements may be appropriate for the existing application database but must be reviewed and split before using them as a new Supabase baseline. Running the full file without understanding dependencies could cause failures or unwanted state changes.

## Safe implementation sequence

1. **Inventory only:** compare all table definitions, indexes, constraints, triggers, functions, extensions, and row-level-security expectations used by application queries against `db/schema.sql` and the existing migrations.
2. **Create a clean baseline:** prepare new, numbered SQL files under `supabase/migrations/` on an isolated branch only. Preserve the existing `db/schema.sql` and `migrations/` files unchanged. Do not include production data or secrets.
3. **Static review:** check dependency order, idempotency where appropriate, PostgreSQL/Supabase compatibility, unsafe `DROP`/type-change statements, default configuration rows, and RLS/policies before any execution.
4. **Disposable test project:** apply migrations only to a separate test database/project with no production customer or payment data. Do not use the current Supabase project as a test target while production deployment settings are uncertain.
5. **Verification:** compare created tables/columns/indexes/constraints with the intended schema; run schema and application tests; verify no secrets or real customer data are in the migration files.
6. **Backup/restore rehearsal:** before any future production change, create a verified backup and prove it can be restored. Document rollback/recovery steps.
7. **Separate approval gate:** only after review and explicit approval should a production migration or database connection change even be considered. Render remains the production source until separately approved.

## Security note

A database credential was found embedded in the existing `db.js` source during review. This plan does not print or modify it. Before any repository visibility change or migration work, handle the credential separately: confirm the actual active credential, replace it with an environment variable, coordinate any rotation with the live Render configuration, and verify service health. Do not rotate credentials without a coordinated plan because it could interrupt production.

## Current execution status

- No SQL has been executed against Supabase.
- No customer/payment data has been copied.
- No application files have been edited or deleted.
- No changes have been made to Render or its PostgreSQL database.
- This document is planning-only and is on an isolated branch; it is not merged to `main`.
