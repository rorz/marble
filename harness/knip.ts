#!/usr/bin/env bun

/**
 * harness/knip.ts
 *
 * Wraps `knip-bun` so it runs as a first-class harness check alongside the
 * other rails. Knip catches:
 *
 *   - Unused files
 *   - Unused exports (functions, types, classes, etc.)
 *   - Unused / unlisted dependencies in any workspace `package.json`
 *   - Unused catalog entries in the root catalog
 *   - Duplicate exports (intentionally disabled — the Zod aliasing pattern
 *     produces legitimate same-name value + type pairs)
 *
 * Configuration lives in `knip.jsonc` at the repo root.
 *
 * Knip's exit code is non-zero whenever it has any findings, which is
 * exactly what we want for `bun check` integration. We just spawn it and
 * mirror its exit code.
 */

import { spawn } from "node:child_process";
import { REPO_ROOT } from "./lib";

const child = spawn(
  "bunx",
  [
    "knip-bun",
    "--no-progress",
  ],
  {
    cwd: REPO_ROOT,
    stdio: "inherit",
  },
);

child.on("close", (code) => {
  if (code === 0) {
    console.log("harness/knip: OK");
  }
  process.exit(code ?? 1);
});
