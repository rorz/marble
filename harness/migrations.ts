#!/usr/bin/env bun

/**
 * harness/migrations.ts
 *
 * Asserts the single-file squashed migration invariant.
 *
 * Per the database guide, `supabase/migrations/` must converge to exactly
 * one file named `<timestamp>_squashed_schema.sql`. Pile-ups of incremental
 * migrations are forbidden — the squashed file is the canonical schema
 * source of truth.
 *
 * `supabase migration squash` by itself is not enough; the Supabase CLI
 * preserves the previous filename suffix. The rename to `*_squashed_schema.sql`
 * is the contract. This rail catches missing renames immediately.
 */

import { resolve } from "node:path";
import { Glob } from "bun";

const REPO_ROOT = resolve(import.meta.dir, "..");
const MIGRATIONS_DIR = "supabase/migrations";

const files: string[] = [];
const glob = new Glob("*.sql");
for await (const file of glob.scan({
  absolute: false,
  cwd: resolve(REPO_ROOT, MIGRATIONS_DIR),
})) {
  files.push(file);
}
files.sort();

const squashedFiles = files.filter((f) => /^\d+_squashed_schema\.sql$/.test(f));
const otherFiles = files.filter((f) => !squashedFiles.includes(f));

const errors: string[] = [];

if (squashedFiles.length === 0) {
  errors.push(
    `expected exactly one ${MIGRATIONS_DIR}/*_squashed_schema.sql, found none`,
  );
} else if (squashedFiles.length > 1) {
  errors.push(
    `expected exactly one *_squashed_schema.sql, found ${squashedFiles.length}: ${squashedFiles.join(", ")}`,
  );
}

if (otherFiles.length > 0) {
  errors.push(
    `found non-squashed migration file(s) — squash them into the existing *_squashed_schema.sql and rename: ${otherFiles.join(", ")}`,
  );
}

if (errors.length > 0) {
  console.error("");
  console.error("harness/migrations: schema invariant violated");
  console.error("");
  for (const e of errors) {
    console.error(`  ${e}`);
  }
  console.error("");
  console.error(
    `Action: see docs/internal/database-guide.md for the squash procedure.`,
  );
  process.exit(1);
}

console.log(`harness/migrations: OK (1 squashed schema: ${squashedFiles[0]})`);
