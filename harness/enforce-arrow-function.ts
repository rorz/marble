#!/usr/bin/env bun

/**
 * harness/enforce-arrow-function.ts
 *
 * Enforces AGENTS.md NEVER #14: all authored TypeScript must use arrow
 * functions (`const x = () => {}`) instead of `function` declarations.
 *
 * Algorithmic exemptions (no opt-out comment needed):
 *   - Generator functions (`function*` / `async function*`)
 *   - TypeScript overload clusters: a group of FunctionDeclarations that
 *     share the same name where every declaration except the last has no
 *     body (i.e. they are overload signatures, not implementations)
 *
 * Inline opt-out — add on the violation line OR the line immediately above:
 *   // harness-ignore: enforce-arrow-function -- <written justification>
 *
 * CLI:
 *   bun harness/enforce-arrow-function.ts             # scan all in-scope files
 *   bun harness/enforce-arrow-function.ts --file <p>  # scan a single file
 *
 * Exit 0 = clean. Exit 1 = violations found. Exit 2 = bad arguments / read error.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { collectFiles, hasIgnore, lineAt, prevLine, REPO_ROOT } from "./lib";

const RULE_ID = "enforce-arrow-function";

const SCAN_GLOBS: readonly string[] = [
  "apps/**/*.{ts,tsx}",
  "packages/**/*.{ts,tsx}",
  "supabase/**/*.{ts,tsx}",
  "harness/**/*.{ts,tsx}",
];

const isExcludedFile = (relPath: string): boolean =>
  /\.generated\.(ts|tsx)$/.test(relPath) ||
  /\.d\.(ts|tsx)$/.test(relPath) ||
  relPath.startsWith("harness/fixtures/");

// ─── Public types ─────────────────────────────────────────────────────────────

export type Violation = {
  col: number;
  file: string;
  line: number;
  message: string;
};

// ─── Module-local AST helpers (not exported per AGENTS.md NEVER #11) ─────────

/**
 * Recursively collect every FunctionDeclaration node in the subtree rooted
 * at `root`. Uses `ts.forEachChild` for breadth (direct children), calling
 * itself recursively to reach all descendants.
 */
const collectFunctionDecls = (
  root: ts.Node,
  results: ts.FunctionDeclaration[],
): void => {
  if (ts.isFunctionDeclaration(root)) {
    results.push(root);
  }
  ts.forEachChild(root, (child) => collectFunctionDecls(child, results));
};

/**
 * Given a flat list of FunctionDeclaration nodes from a single file, return
 * the set of nodes that belong to a TypeScript overload cluster.
 *
 * A cluster is detected when ≥2 declarations share the same `name.text` and
 * every declaration except the last has no body (`body === undefined`). The
 * whole cluster — signatures AND implementation — is considered exempt.
 */
const buildExemptOverloads = (
  decls: readonly ts.FunctionDeclaration[],
): ReadonlySet<ts.FunctionDeclaration> => {
  const byName = new Map<string, ts.FunctionDeclaration[]>();
  for (const decl of decls) {
    if (decl.name === undefined) continue; // anonymous default-export — not a cluster member
    const name = decl.name.text;
    const bucket = byName.get(name) ?? [];
    bucket.push(decl);
    byName.set(name, bucket);
  }

  const exempt = new Set<ts.FunctionDeclaration>();
  for (const [, cluster] of byName) {
    if (cluster.length < 2) continue;
    if (cluster.slice(0, -1).every((d) => d.body === undefined)) {
      for (const d of cluster) exempt.add(d);
    }
  }
  return exempt;
};

// ─── Public API (consumed by the T6 vitest spec) ──────────────────────────────

/**
 * Parse `source` as TypeScript and return every `function` declaration that
 * violates the arrow-function-only rule. Pure — no side effects.
 *
 * `filename` is stored verbatim in `Violation.file`; callers choose whether
 * to pass an absolute path or a repo-relative path.
 */
export const detectViolations = (
  filename: string,
  source: string,
): Violation[] => {
  const sf = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );

  const allDecls: ts.FunctionDeclaration[] = [];
  collectFunctionDecls(sf, allDecls);

  const exempt = buildExemptOverloads(allDecls);
  const violations: Violation[] = [];

  for (const decl of allDecls) {
    // Generators are exempt: function* / async function*
    if (decl.asteriskToken !== undefined) continue;

    // Overload clusters are exempt (detected above)
    if (exempt.has(decl)) continue;

    const start = decl.getStart(sf);
    const { line: tsLine, character: tsChar } =
      sf.getLineAndCharacterOfPosition(start);

    // ts positions are 0-indexed; line is shown 1-indexed, col stays 0-indexed
    const line = tsLine + 1;
    const col = tsChar;

    // harness-ignore opt-out: check current line and the line immediately above
    const currLine = lineAt(source, start);
    const prev = prevLine(source, start);
    if (hasIgnore(currLine, RULE_ID) || hasIgnore(prev, RULE_ID)) continue;

    const name = decl.name?.text ?? "(anonymous)";
    violations.push({
      col,
      file: filename,
      line,
      message: `${RULE_ID} — use arrow function (const ${name} = (...) => {}). See AGENTS.md NEVER #14.`,
    });
  }

  return violations;
};

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const USAGE = `Usage: bun harness/${RULE_ID}.ts [--file <abs-or-rel-path>]`;

  const printUsage = (): void => {
    console.error(USAGE);
  };

  const printViolation = (v: Violation): void => {
    console.log(`${v.file}:${v.line}:${v.col} ${v.message}`);
  };

  const args = process.argv.slice(2);

  // Validate and parse arguments
  let singleFile: string | undefined;

  if (args.length === 0) {
    singleFile = undefined; // bulk scan
  } else if (args.length === 2 && args[0] === "--file") {
    singleFile = args[1];
  } else if (args.length === 1 && args[0] === "--file") {
    console.error(`${RULE_ID}: --file requires a path argument.`);
    printUsage();
    process.exit(2);
  } else {
    console.error(`${RULE_ID}: unknown argument(s): ${args.join(" ")}`);
    printUsage();
    process.exit(2);
  }

  console.error(`harness/${RULE_ID}: scanning…`);

  if (singleFile !== undefined) {
    // ── Single-file mode ────────────────────────────────────────────────────────
    const rawPath = singleFile;
    const absPath = rawPath.startsWith("/")
      ? rawPath
      : resolve(REPO_ROOT, rawPath);

    let source: string;
    try {
      source = readFileSync(absPath, "utf8");
    } catch {
      console.error(`${RULE_ID}: cannot read file: ${absPath}`);
      process.exit(2);
    }

    // Use the path as provided for the violation display (preserves intent of caller)
    const violations = detectViolations(rawPath, source);

    if (violations.length === 0) {
      console.error(`harness/${RULE_ID}: OK`);
      process.exit(0);
    }

    for (const v of violations) printViolation(v);
    process.exit(1);
  }

  // ── Bulk scan mode ─────────────────────────────────────────────────────────────
  const files = await collectFiles(SCAN_GLOBS, {
    skipDirs: [
      "coverage",
    ],
  });
  const allViolations: Violation[] = [];

  for (const relPath of files) {
    if (isExcludedFile(relPath)) continue;

    let source: string;
    try {
      source = readFileSync(resolve(REPO_ROOT, relPath), "utf8");
    } catch {
      continue;
    }

    allViolations.push(...detectViolations(relPath, source));
  }

  if (allViolations.length === 0) {
    console.error(`harness/${RULE_ID}: OK`);
    process.exit(0);
  }

  for (const v of allViolations) printViolation(v);
  console.error(`\n${RULE_ID}: ${allViolations.length} violation(s) found.`);
  process.exit(1);
}
