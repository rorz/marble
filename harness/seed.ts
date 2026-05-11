#!/usr/bin/env bun

/**
 * harness/seed.ts
 *
 * Asserts that the checked-in `supabase/seed.sql` is in sync with the
 * deterministic output of `supabase/generate-seed.ts`.
 *
 * Schema changes (in the squashed migration) often imply seed changes,
 * and the database guide treats regeneration as mandatory after every
 * schema SQL change. Drift here is silent until somebody runs
 * `supabase db reset` and gets a different fixture set than what's in git.
 *
 * Strategy: snapshot the current file, run the generator (which overwrites
 * `seed.sql`), diff, ALWAYS restore the original. The working tree is
 * unchanged on exit regardless of pass/fail.
 *
 * Note: the generator reads from `supabase/seed-fixtures/` and writes
 * directly to `supabase/seed.sql`. There is no `--dry-run` flag, so we
 * back it up in memory and restore unconditionally.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const SEED_PATH = resolve(REPO_ROOT, "supabase/seed.sql");
const GENERATOR_PATH = resolve(REPO_ROOT, "supabase/generate-seed.ts");

const original = readFileSync(SEED_PATH, "utf8");

let regenerated: string;
try {
  const result = spawnSync(
    "bun",
    [
      "run",
      GENERATOR_PATH,
    ],
    {
      cwd: REPO_ROOT,
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  );
  if (result.status !== 0) {
    // Always restore before failing.
    writeFileSync(SEED_PATH, original);
    console.error("harness/seed: seed generator failed to run");
    console.error(result.stderr?.toString() ?? "(no stderr)");
    process.exit(1);
  }
  regenerated = readFileSync(SEED_PATH, "utf8");
} finally {
  // Restore unconditionally so the working tree is byte-identical to what
  // the user had before this script ran.
  writeFileSync(SEED_PATH, original);
}

if (regenerated === original) {
  console.log("harness/seed: OK");
  process.exit(0);
}

console.error("");
console.error("harness/seed: supabase/seed.sql is stale");
console.error("");
console.error(
  "  The checked-in `supabase/seed.sql` does not match the output of",
);
console.error("  `bun run supabase/generate-seed.ts`. This usually means:");
console.error("");
console.error(
  "    - `supabase/seed-fixtures/` changed and the seed was not regenerated, or",
);
console.error(
  "    - the squashed schema changed in a way that implies a seed change.",
);
console.error("");
console.error(
  "  Action: run `bun run --filter=@marble/supabase gen:program-seed` (or `bun run supabase/generate-seed.ts`) and commit the result.",
);

// Surface a unified-diff-ish summary so reviewers see the scale of drift.
const originalLines = original.split("\n");
const regeneratedLines = regenerated.split("\n");
const lineDiff = regeneratedLines.length - originalLines.length;
const byteDiff = regenerated.length - original.length;
console.error("");
console.error(
  `  ${lineDiff > 0 ? "+" : ""}${lineDiff} line(s), ${byteDiff > 0 ? "+" : ""}${byteDiff} byte(s) of drift.`,
);

process.exit(1);
