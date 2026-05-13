#!/usr/bin/env bun

/**
 * harness/exports.ts
 *
 * Enforces AGENTS.md rule 11: "Export TypeScript types, interfaces,
 * schema-inferred aliases, or helper aliases unless there is a current
 * concrete consumer or the type is an intentional package/public API
 * surface."
 *
 * Scope: scans `apps/web/src/**` and `packages/**\/src/**` for
 * `export type X` / `export interface X`. For each, checks whether at
 * least one other file imports the name. If not, the export is orphan
 * drift and a hard error.
 *
 * Inline opt-out (same line as the `export type ...`):
 *
 *   export type Foo = ...;  // harness-ignore: no-orphan-type-export -- ...
 *
 * Excluded surfaces (intentional public-API barrels and type-aliased
 * declaration channels):
 *
 *   - `packages/*\/src/index.ts`     — workspace package public surface
 *   - `packages/contracts/src/**`    — public schema/type contract
 *   - `*\/src/types.ts`              — type surface modules
 *   - `*\/types.ts` at any depth     — type-only escape hatch convention
 *   - `apps/*\/next-env.d.ts`        — Next.js generated types
 *   - `worker-configuration.d.ts`    — Wrangler generated types
 *
 * Limitation: the consumer check is a substring-and-`\b` regex sweep
 * over the file set. False positives are not possible (a name that
 * appears anywhere else in source counts as a consumer), but a name
 * referenced only inside a documentation block comment will count as
 * consumed. That's an acceptable tradeoff.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectFiles,
  hasIgnore,
  lineAt,
  locate,
  prevLine,
  REPO_ROOT,
} from "./lib";

const SCAN_GLOBS: readonly string[] = [
  "apps/**/src/**/*.{ts,tsx}",
  "packages/**/src/**/*.{ts,tsx}",
];

interface OrphanExport {
  col: number;
  line: number;
  name: string;
  relPath: string;
}

const isExcludedSurface = (relPath: string): boolean => {
  // Workspace package barrels.
  if (/^packages\/[\w-]+\/src\/index\.ts$/.test(relPath)) return true;
  // Public contract package — every export is a public surface by design.
  if (relPath.startsWith("packages/contracts/src/")) return true;
  // Type surface modules.
  if (/(?:^|\/)types\.ts$/.test(relPath)) return true;
  return false;
};

const EXPORT_REGEX = /export\s+(?:type|interface)\s+([A-Z][A-Za-z0-9_]*)\b/g;

const files = await collectFiles(SCAN_GLOBS);

interface ExportSite {
  col: number;
  line: number;
  name: string;
  relPath: string;
}

const exportSites: ExportSite[] = [];

// First pass: collect every `export type|interface X` site.
for (const rel of files) {
  if (isExcludedSurface(rel)) continue;
  const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
  if (!source.includes("export ")) continue;

  EXPORT_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null = EXPORT_REGEX.exec(source);
  while (m !== null) {
    const { col, line } = locate(source, m.index);
    const excerpt = lineAt(source, m.index);
    const previous = prevLine(source, m.index);
    const ruleId = "no-orphan-type-export";
    if (!hasIgnore(excerpt, ruleId) && !hasIgnore(previous, ruleId)) {
      exportSites.push({
        col,
        line,
        name: m[1],
        relPath: rel,
      });
    }
    m = EXPORT_REGEX.exec(source);
  }
}

// Pre-load all source files once for the consumer check.
const allSources = new Map<string, string>();
for (const rel of files) {
  allSources.set(rel, readFileSync(resolve(REPO_ROOT, rel), "utf8"));
}

const hasConsumer = (name: string, definedIn: string): boolean => {
  // Word-bounded substring search across all files except the definition site.
  const re = new RegExp(`\\b${name}\\b`);
  for (const [rel, source] of allSources) {
    if (rel === definedIn) continue;
    if (re.test(source)) return true;
  }
  return false;
};

const orphans: OrphanExport[] = [];
for (const site of exportSites) {
  if (!hasConsumer(site.name, site.relPath)) {
    orphans.push(site);
  }
}

if (orphans.length === 0) {
  console.log(
    `harness/exports: OK (${exportSites.length} exported types scanned)`,
  );
  process.exit(0);
}

console.error("");
console.error("harness/exports: orphan type exports");
console.error("");
console.error(
  "  These `export type` / `export interface` names have no other file",
);
console.error("  in the workspace that imports them.");
console.error("");

const byFile = new Map<string, OrphanExport[]>();
for (const o of orphans) {
  const arr = byFile.get(o.relPath) ?? [];
  arr.push(o);
  byFile.set(o.relPath, arr);
}
for (const [rel, items] of byFile) {
  console.error(`  ${rel}`);
  for (const o of items) {
    console.error(`    :${o.line}:${o.col}  ${o.name}`);
  }
}
console.error("");
console.error(
  "  Action: either make the type module-local (drop the `export`), find the",
);
console.error(
  "  consumer that should be using it, or add a same-line directive:",
);
console.error(
  "  `// harness-ignore: no-orphan-type-export -- <justification>`.",
);
console.error("");
console.error(
  `${orphans.length} orphan export(s) across ${byFile.size} file(s).`,
);
process.exit(1);
