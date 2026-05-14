#!/usr/bin/env bun

/**
 * harness/index.ts
 *
 * Single entry point for the harness pack. Each harness script is a
 * standalone Bun executable; this barrel just orchestrates running them
 * in sequence with a unified summary at the end. Adding a new harness
 * is one line in CHECKS — no root `package.json` edit required.
 *
 * Usage:
 *
 *   bun run harness/index.ts              # run all checks
 *   bun run harness/index.ts patterns     # run a single check
 *   bun run harness/index.ts patterns catalog   # run a subset
 *
 * Exit code is non-zero if any check fails. Other checks still run so a
 * single sweep of `bun harness` surfaces every issue at once instead of
 * forcing fix-build-fix-build cycles.
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { REPO_ROOT } from "./lib";

const CHECKS = [
  "patterns",
  "catalog",
  "almanac",
  "handlers",
  "exports",
  "showcase",
  "migrations",
  "realtime",
  "seed",
  "enforce-arrow-function",
  "no-forward-reference",
  "max-file-lines",
  "knip",
] as const;

type CheckName = (typeof CHECKS)[number];

const isCheck = (value: string): value is CheckName => {
  return (CHECKS as readonly string[]).includes(value);
};

const runCheck = (
  name: CheckName,
): Promise<{
  exitCode: number;
  name: CheckName;
}> => {
  return new Promise((resolveCheck) => {
    const child = spawn(
      "bun",
      [
        "run",
        resolve(REPO_ROOT, `harness/${name}.ts`),
      ],
      {
        stdio: "inherit",
      },
    );
    child.on("close", (code) => {
      resolveCheck({
        exitCode: code ?? 1,
        name,
      });
    });
  });
};

const requested = process.argv.slice(2);
for (const arg of requested) {
  if (!isCheck(arg)) {
    console.error(`harness: unknown check "${arg}"`);
    console.error(`  available: ${CHECKS.join(", ")}`);
    process.exit(2);
  }
}

const toRun: readonly CheckName[] =
  requested.length > 0 ? (requested as CheckName[]) : CHECKS;

const results: Array<{
  exitCode: number;
  name: CheckName;
}> = [];
for (const name of toRun) {
  // Each check prints its own header / OK line; we just preserve order.
  const result = await runCheck(name);
  results.push(result);
}

const failed = results.filter((r) => r.exitCode !== 0);

if (failed.length > 0) {
  console.error("");
  console.error(
    `harness: ${failed.length} of ${results.length} check(s) failed — ${failed.map((r) => r.name).join(", ")}`,
  );
  process.exit(1);
}

console.log("");
console.log(`harness: all ${results.length} check(s) passed`);
