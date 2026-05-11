#!/usr/bin/env bun

/**
 * harness/handlers.ts
 *
 * Asserts that every operation listed in the data interface almanac has a
 * wired handler in either of the two supported layouts:
 *
 *   1. flat   — packages/api/src/router/<resource>.ts
 *   2. nested — packages/api/src/<resource>/actions.ts
 *               + packages/api/src/<resource>/index.ts (boundary)
 *
 * The nested layout is the documented preference for resources whose
 * implementation has outgrown a single flat router file (see AGENTS.md
 * "Repository Convention Discipline"). Both layouts produce the same
 * `<resource>Router` export and must be mounted in `marbleRouter` at
 * `packages/api/src/router/index.ts`.
 *
 * Three checks:
 *
 *   1. ERROR — almanac operation has no handler in any router file.
 *   2. ERROR — router file declares a handler that is not in the almanac.
 *   3. ERROR — a `<resource>Router` exists on disk but is not mounted in
 *              `marbleRouter` at `packages/api/src/router/index.ts`.
 *
 * Strategy: parse the router source statically. Each router source —
 * whether `router/<resource>.ts` or `<resource>/actions.ts` — follows
 * the same shape:
 *
 *     export const projectRouter = {
 *       create: os.projects.create.handler(...),
 *       delete: os.projects.delete.handler(...),
 *       ...
 *     } satisfies RouterResourcePart<"projects">;
 *
 * That lets us:
 *   - Extract the resource name from the `satisfies` annotation.
 *   - Extract operation names from `os.<resource>.<op>.handler` callsites.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectFiles, parseAlmanac, REPO_ROOT, readAlmanac } from "./lib";

const ROUTER_DIR = "packages/api/src/router";
const ROUTER_INDEX = `${ROUTER_DIR}/index.ts`;
const API_SRC = "packages/api/src";

interface RouterFile {
  filePath: string;
  layout: "flat" | "nested";
  operations: Set<string>;
  resource: string;
}

/**
 * Parse a router source file for `export const <resource>Router = { ... }
 * satisfies RouterResourcePart<"<resource>">`.
 *
 * Returns the resource name (from the satisfies annotation) and the set of
 * operation keys. Object keys are simple identifiers; the parser tolerates
 * keys preceded by whitespace + line comments + multi-line handler bodies.
 */
function parseRouterFile(
  filePath: string,
  source: string,
  layout: "flat" | "nested",
): RouterFile | null {
  const satisfiesMatch = /satisfies\s+RouterResourcePart<"([^"]+)">/.exec(
    source,
  );
  if (!satisfiesMatch) return null;
  const resource = satisfiesMatch[1];

  const bodyMatch =
    /export\s+const\s+\w+Router\s*=\s*\{([\s\S]*?)\}\s*satisfies/.exec(source);
  if (!bodyMatch) return null;
  const body = bodyMatch[1];

  const keys = new Set<string>();
  const opRegex = new RegExp(`os\\.${resource}\\.(\\w+)\\.handler\\b`, "g");
  let m: RegExpExecArray | null = opRegex.exec(body);
  while (m !== null) {
    keys.add(m[1]);
    m = opRegex.exec(body);
  }

  return {
    filePath,
    layout,
    operations: keys,
    resource,
  };
}

async function collectRouterFiles(): Promise<RouterFile[]> {
  const result: RouterFile[] = [];

  // Flat layout: packages/api/src/router/<resource>.ts (excluding index.ts).
  const flatFiles = await collectFiles([
    `${ROUTER_DIR}/*.ts`,
  ]);
  for (const rel of flatFiles) {
    if (rel === ROUTER_INDEX) continue;
    const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    const parsed = parseRouterFile(rel, source, "flat");
    if (parsed) result.push(parsed);
  }

  // Nested layout: packages/api/src/<resource>/actions.ts.
  // Glob skips the `router/` directory (its files were handled above) and
  // any directory whose actions.ts is missing (not all subdirs are nested
  // resources — e.g. shared helpers — and the satisfies-annotation match
  // is the disambiguator anyway).
  const nestedFiles = await collectFiles([
    `${API_SRC}/*/actions.ts`,
  ]);
  for (const rel of nestedFiles) {
    const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    const parsed = parseRouterFile(rel, source, "nested");
    if (parsed) result.push(parsed);
  }

  return result;
}

function parseMountedResources(indexSource: string): Set<string> {
  const mounted = new Set<string>();
  const objectMatch =
    /marbleRouter\s*=\s*os\.router\(\s*\{([\s\S]*?)\}\s*\)/.exec(indexSource);
  if (!objectMatch) return mounted;
  const body = objectMatch[1];
  const keyRegex = /^\s*([a-zA-Z_]\w*)\s*:/gm;
  let m: RegExpExecArray | null = keyRegex.exec(body);
  while (m !== null) {
    mounted.add(m[1]);
    m = keyRegex.exec(body);
  }
  return mounted;
}

const indexSource = readFileSync(resolve(REPO_ROOT, ROUTER_INDEX), "utf8");

const { resources: almanac } = parseAlmanac(readAlmanac());
const routerFiles = await collectRouterFiles();
const mountedResources = parseMountedResources(indexSource);

const routerByResource = new Map<string, RouterFile>();
const duplicateResources: Array<{
  resource: string;
  paths: string[];
}> = [];
for (const rf of routerFiles) {
  const existing = routerByResource.get(rf.resource);
  if (existing) {
    duplicateResources.push({
      paths: [
        existing.filePath,
        rf.filePath,
      ],
      resource: rf.resource,
    });
    continue;
  }
  routerByResource.set(rf.resource, rf);
}

interface Issue {
  filePath?: string;
  kind:
    | "almanac-op-missing-handler"
    | "almanac-resource-no-router"
    | "duplicate-router"
    | "handler-not-in-almanac"
    | "router-not-mounted";
  operation?: string;
  paths?: string[];
  resource: string;
}

const issues: Issue[] = [];

// A resource declaring both `router/<resource>.ts` AND `<resource>/actions.ts`
// is structural drift — only one home is allowed.
for (const dup of duplicateResources) {
  issues.push({
    kind: "duplicate-router",
    paths: dup.paths,
    resource: dup.resource,
  });
}

// Check 1: every almanac op has a handler.
for (const [resource, entry] of almanac) {
  const router = routerByResource.get(resource);
  if (!router) {
    issues.push({
      kind: "almanac-resource-no-router",
      resource,
    });
    continue;
  }
  for (const op of entry.allowed) {
    if (!router.operations.has(op)) {
      issues.push({
        kind: "almanac-op-missing-handler",
        operation: op,
        resource,
      });
    }
  }
}

// Check 2: every handler in a router file is in the almanac.
for (const rf of routerFiles) {
  const entry = almanac.get(rf.resource);
  if (!entry) {
    for (const op of rf.operations) {
      issues.push({
        filePath: rf.filePath,
        kind: "handler-not-in-almanac",
        operation: op,
        resource: rf.resource,
      });
    }
    continue;
  }
  for (const op of rf.operations) {
    if (!entry.allowed.has(op)) {
      issues.push({
        filePath: rf.filePath,
        kind: "handler-not-in-almanac",
        operation: op,
        resource: rf.resource,
      });
    }
  }
}

// Check 3: every router file is mounted in the top-level marbleRouter.
for (const rf of routerFiles) {
  if (!mountedResources.has(rf.resource)) {
    issues.push({
      filePath: rf.filePath,
      kind: "router-not-mounted",
      resource: rf.resource,
    });
  }
}

if (issues.length === 0) {
  const totalOps = [
    ...almanac.values(),
  ].reduce((sum, e) => sum + e.allowed.size, 0);
  const nestedCount = routerFiles.filter((r) => r.layout === "nested").length;
  console.log(
    `harness/handlers: OK (${routerFiles.length} router files${
      nestedCount > 0 ? ` — ${nestedCount} nested` : ""
    }, ${totalOps} almanac operations all wired)`,
  );
  process.exit(0);
}

console.error("");
console.error("harness/handlers: contract / handler drift");
console.error("");

const missingHandlers = issues.filter(
  (i) => i.kind === "almanac-op-missing-handler",
);
const driftHandlers = issues.filter((i) => i.kind === "handler-not-in-almanac");
const notMounted = issues.filter((i) => i.kind === "router-not-mounted");
const noRouter = issues.filter((i) => i.kind === "almanac-resource-no-router");
const duplicates = issues.filter((i) => i.kind === "duplicate-router");

if (duplicates.length > 0) {
  console.error("  Resources with both a flat and nested router (pick one):");
  for (const i of duplicates) {
    console.error(`    ${i.resource}`);
    for (const p of i.paths ?? []) {
      console.error(`      - ${p}`);
    }
  }
  console.error(
    "    Action: delete the flat router file (`packages/api/src/router/<resource>.ts`) once the nested layout is in place, or vice versa.",
  );
  console.error("");
}

if (missingHandlers.length > 0) {
  console.error("  Almanac operations with no router handler:");
  for (const i of missingHandlers) {
    console.error(`    ${i.resource}.${i.operation}`);
  }
  console.error(
    `    Action: add the handler to packages/api/src/router/${missingHandlers[0].resource}.ts (flat) or packages/api/src/${missingHandlers[0].resource}/actions.ts (nested).`,
  );
  console.error("");
}

if (driftHandlers.length > 0) {
  console.error("  Router handlers not listed in the almanac:");
  for (const i of driftHandlers) {
    console.error(`    ${i.resource}.${i.operation}  (${i.filePath})`);
  }
  console.error(
    `    Action: add the operation to docs/internal/data-interface-definitions.md, or remove the handler.`,
  );
  console.error("");
}

if (notMounted.length > 0) {
  console.error("  Router files not mounted in marbleRouter:");
  for (const i of notMounted) {
    console.error(`    ${i.resource}  (${i.filePath})`);
  }
  console.error(
    `    Action: add the router to ${ROUTER_INDEX}'s marbleRouter object.`,
  );
  console.error("");
}

if (noRouter.length > 0) {
  console.error("  Almanac resources with no router file:");
  for (const i of noRouter) {
    console.error(`    ${i.resource}`);
  }
  console.error(
    `    Action: create packages/api/src/router/<resource>.ts (flat) or packages/api/src/<resource>/{actions,index}.ts (nested).`,
  );
  console.error("");
}

console.error(`${issues.length} issue(s) total.`);
process.exit(1);
