#!/usr/bin/env bun

/**
 * harness/handlers.ts — asserts every almanac op has a wired handler in
 * one of the supported router layouts:
 *
 *   entities — packages/api/src/router/entities/<resource>.ts
 *              (default; usually `composeResourceRouter("<resource>")`)
 *   flat     — packages/api/src/router/<resource>.ts          (legacy)
 *   nested   — packages/api/src/<resource>/actions.ts         (large)
 *
 * Each layout exports `<resource>Router` and is mounted in `marbleRouter`
 * at `packages/api/src/router/index.ts`. Two router shapes are recognized
 * by the static parser:
 *
 *   (a) `export const xRouter = composeResourceRouter("<resource>");`
 *       — covers every almanac op for that resource.
 *   (b) `export const xRouter = { op: os.<resource>.op.handler(...), ... }
 *        satisfies RouterResourcePart<"<resource>">;`
 *       — covers only the explicitly-listed ops. Spread + override of
 *         compose still counts as (a).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectFiles, parseAlmanac, REPO_ROOT, readAlmanac } from "./lib";

const ROUTER_DIR = "packages/api/src/router";
const ROUTER_INDEX = `${ROUTER_DIR}/index.ts`;
const API_SRC = "packages/api/src";

interface RouterFile {
  composesAll: boolean;
  filePath: string;
  layout: "entities" | "flat" | "nested";
  operations: Set<string>;
  resource: string;
}

const parseRouterFile = (
  filePath: string,
  source: string,
  layout: "entities" | "flat" | "nested",
): RouterFile | null => {
  // Strip /* ... */ blocks so JSDoc examples (e.g. compose.ts's docstring
  // showing a `satisfies RouterResourcePart<"programFiles">` snippet) do not
  // falsely register as router files.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "");

  const composeMatch = /composeResourceRouter\("([^"]+)"\)/.exec(code);
  if (composeMatch) {
    return {
      composesAll: true,
      filePath,
      layout,
      operations: new Set(),
      resource: composeMatch[1],
    };
  }

  const satisfiesMatch = /satisfies\s+RouterResourcePart<"([^"]+)">/.exec(code);
  if (!satisfiesMatch) return null;
  const resource = satisfiesMatch[1];

  const bodyMatch =
    /export\s+const\s+\w+Router\s*=\s*\{([\s\S]*?)\}\s*satisfies/.exec(code);
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
    composesAll: false,
    filePath,
    layout,
    operations: keys,
    resource,
  };
};

const collectRouterFiles = async (): Promise<RouterFile[]> => {
  const result: RouterFile[] = [];

  // Entities layout: packages/api/src/router/entities/<resource>.ts.
  const entitiesFiles = await collectFiles([
    `${ROUTER_DIR}/entities/*.ts`,
  ]);
  for (const rel of entitiesFiles) {
    const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    const parsed = parseRouterFile(rel, source, "entities");
    if (parsed) result.push(parsed);
  }

  // Flat layout: packages/api/src/router/<resource>.ts (excluding index.ts +
  // the compose helper). Top-level only — `entities/` was handled above.
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
};

const indexSource = readFileSync(resolve(REPO_ROOT, ROUTER_INDEX), "utf8");

const parseMountedResources = (indexSource: string): Set<string> => {
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
};

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

// A resource declaring its router in more than one of the supported layouts
// (entities / flat / nested) is structural drift — only one home is allowed.
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
  if (router.composesAll) continue;
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
