#!/usr/bin/env bun

/**
 * harness/seed.ts
 *
 * Smoke-tests `bun run supabase/generate-seed/index.ts` — verifies the
 * generator runs to completion without errors.
 *
 * `supabase/seed.sql` is regenerated per-operator before each `supabase db
 * reset` and is gitignored, so there is no checked-in snapshot to diff
 * against. This check exists to catch syntax errors, missing fixtures, and
 * other generator-time regressions before they bite an operator mid-reset.
 *
 * Strategy: snapshot the current seed.sql (if any), run the generator,
 * ALWAYS restore the original (or delete the freshly-generated file when
 * no original existed). Working tree byte-identical on exit.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT } from "./lib";

const SEED_PATH = resolve(REPO_ROOT, "supabase/seed.sql");
const GENERATOR_PATH = resolve(REPO_ROOT, "supabase/generate-seed/index.ts");

const originalExists = existsSync(SEED_PATH);
const original = originalExists ? readFileSync(SEED_PATH, "utf8") : null;

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
    console.error("harness/seed: seed generator failed to run");
    console.error(result.stderr?.toString() ?? "(no stderr)");
    process.exit(1);
  }
} finally {
  if (original !== null) {
    writeFileSync(SEED_PATH, original);
  } else if (existsSync(SEED_PATH)) {
    unlinkSync(SEED_PATH);
  }
}

console.log("harness/seed: OK");
process.exit(0);
