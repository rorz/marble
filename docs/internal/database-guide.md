# Internal Database Guide

This is the canonical workflow for Marble database changes.

If you touch `supabase/migrations`, `supabase/generate-seed.ts`, or `supabase/seed.sql`, read this first.

## Non-Negotiables

1. The committed migration end state is exactly one schema file:
   `supabase/migrations/<timestamp>_squashed_schema.sql`
2. Do not leave incremental migration files checked in after schema work. Squash back to one file before you report completion.
3. `supabase migration squash` rewrites the newest migration file by default and preserves its old suffix. Rename the result to `*_squashed_schema.sql`.
4. `supabase/seed.sql` is part of the schema contract. Supabase runs it after migrations on every `supabase db reset`, so schema edits are not complete until seed compatibility is checked.
5. Any change to `supabase/migrations/*.sql` requires auditing `supabase/generate-seed.ts` and regenerating `supabase/seed.sql`, even if you expect the generated seed to stay the same.
6. Keep schema in the squashed migration. Keep local development data in `supabase/seed.sql`. Do not split ordinary schema evolution across multiple committed SQL files.
7. Seed SQL should stay data-only and should prefer explicit `public.` qualification for application tables instead of relying on incidental `search_path` behavior.

## Required Workflow

1. Make the schema change locally.
2. Collapse the migration history back to one file with `supabase migration squash --local --yes`.
3. Rename the resulting file to `supabase/migrations/<timestamp>_squashed_schema.sql`.
4. Audit `supabase/generate-seed.ts` for every schema-sensitive assumption.
5. Regenerate `supabase/seed.sql`.
   In this repo that means running `bun run gen:program-seed` from `supabase/`.
6. If you need a clean reset to validate the new schema, ask for permission before running `bun run dangerously-splat`.
7. Run `bun check` from the workspace root and do not stop until it is clean.

## Why This Exists

Supabase resets apply migrations first and then execute `supabase/seed.sql`.

That means a schema change can break local development in at least two ways:

1. The squashed schema SQL itself is wrong.
2. The schema succeeds, but the seed file no longer matches the schema or reset environment.

If you only update one of those files, you have left the repo in a half-migrated state.

## Practical Guardrails

1. When the squashed migration changes, assume the seed needs regeneration.
2. When the seed changes, make sure the generator is still the source of truth instead of hand-editing the generated SQL.
3. If the squashed dump introduces awkward session state, fix the migration or the seed workflow before you declare victory.
4. If a reset succeeds only because of an accidental local condition, it is not done.
