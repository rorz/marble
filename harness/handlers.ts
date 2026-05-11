#!/usr/bin/env bun

/**
 * harness/handlers.ts
 *
 * Asserts that every operation listed in the data interface almanac has a
 * wired handler in `packages/api/src/router/<resource>.ts`, and that every
 * wired handler is mounted in the top-level `marbleRouter`.
 *
 * Compared to harness/almanac.ts (contract ↔ almanac), this rail closes the
 * loop on the *implementation* side: contract → handler → mounted router.
 *
 * Three checks:
 *
 *   1. ERROR — almanac operation has no handler in any router file.
 *   2. ERROR — router file declares a handler that is not in the almanac.
 *   3. ERROR — a `<resource>Router` exists on disk but is not mounted in
 *              `marbleRouter` at `packages/api/src/router/index.ts`.
 *
 * Strategy: parse the router files statically. Each follows the same shape:
 *
 *     export const projectRouter = {
 *       create: os.projects.create.handler(...),
 *       delete: os.projects.delete.handler(...),
 *       ...
 *     } satisfies RouterResourcePart<"projects">;
 *
 * That lets us:
 *   - Extract the resource name from the `satisfies` annotation.
 *   - Extract operation names from the literal keys of the object.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Glob } from "bun";

const REPO_ROOT = resolve(import.meta.dir, "..");
const ALMANAC_REL_PATH = "docs/internal/data-interface-definitions.md";
const ROUTER_DIR = "packages/api/src/router";
const ROUTER_INDEX = `${ROUTER_DIR}/index.ts`;

const NON_RESOURCE_SECTIONS = new Set<string>([
  "Review Rule For Agents",
  "Action And RPC Rules",
  "Internal worker runtime",
]);

interface AlmanacEntry {
  allowed: Set<string>;
  name: string;
}

function parseAlmanac(source: string): Map<string, AlmanacEntry> {
  const resources = new Map<string, AlmanacEntry>();
  const headers: Array<{
    title: string;
    bodyStart: number;
  }> = [];
  const headerRegex = /^##\s+(.+?)\s*$/gm;
  let headerMatch: RegExpExecArray | null = headerRegex.exec(source);
  while (headerMatch !== null) {
    headers.push({
      bodyStart: headerMatch.index + headerMatch[0].length,
      title: headerMatch[1].trim(),
    });
    headerMatch = headerRegex.exec(source);
  }

  for (let i = 0; i < headers.length; i++) {
    const { title, bodyStart } = headers[i];
    const bodyEnd =
      i + 1 < headers.length ? headers[i + 1].bodyStart : source.length;
    const body = source.slice(bodyStart, bodyEnd);

    if (NON_RESOURCE_SECTIONS.has(title)) continue;

    const allowedMatch =
      /Allowed operations:\s*\n+((?:- `[^`]+`[^\n]*\n?)+)/.exec(body);
    if (!allowedMatch) continue;

    const allowed = new Set<string>();
    const bulletRegex = /- `([^`]+)`/g;
    let m: RegExpExecArray | null = bulletRegex.exec(allowedMatch[1]);
    while (m !== null) {
      allowed.add(m[1]);
      m = bulletRegex.exec(allowedMatch[1]);
    }

    resources.set(title, {
      allowed,
      name: title,
    });
  }

  return resources;
}

interface RouterFile {
  filePath: string;
  operations: Set<string>;
  resource: string;
}

/**
 * Parse a router file for `export const <resource>Router = { ... } satisfies
 * RouterResourcePart<"<resource>">`.
 *
 * Returns the resource name (from the satisfies annotation) and the set of
 * operation keys. Object keys are simple identifiers; the parser tolerates
 * keys preceded by whitespace + line comments + multi-line handler bodies.
 */
function parseRouterFile(filePath: string, source: string): RouterFile | null {
  // The satisfies annotation is the most reliable source of the resource
  // name — the variable name (`projectRouter`) could in theory diverge.
  const satisfiesMatch = /satisfies\s+RouterResourcePart<"([^"]+)">/.exec(
    source,
  );
  if (!satisfiesMatch) return null;
  const resource = satisfiesMatch[1];

  // Find the router object body. Match `export const <name>Router = {` then
  // capture up to the matching `}` followed by ` satisfies`.
  const bodyMatch =
    /export\s+const\s+\w+Router\s*=\s*\{([\s\S]*?)\}\s*satisfies/.exec(source);
  if (!bodyMatch) return null;
  const body = bodyMatch[1];

  // Extract top-level keys. A handler key looks like:
  //
  //   create: os.<resource>.create.handler(
  //
  // We exploit the fact that every handler invocation references the
  // operation by name in `os.<resource>.<op>.handler`.
  const keys = new Set<string>();
  const opRegex = new RegExp(`os\\.${resource}\\.(\\w+)\\.handler\\b`, "g");
  let m: RegExpExecArray | null = opRegex.exec(body);
  while (m !== null) {
    keys.add(m[1]);
    m = opRegex.exec(body);
  }

  return {
    filePath,
    operations: keys,
    resource,
  };
}

async function collectRouterFiles(): Promise<RouterFile[]> {
  const result: RouterFile[] = [];
  const glob = new Glob("*.ts");
  for await (const file of glob.scan({
    absolute: false,
    cwd: resolve(REPO_ROOT, ROUTER_DIR),
  })) {
    if (file === "index.ts") continue;
    const rel = `${ROUTER_DIR}/${file}`;
    const source = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    const parsed = parseRouterFile(rel, source);
    if (parsed) result.push(parsed);
  }
  return result;
}

function parseMountedResources(indexSource: string): Set<string> {
  const mounted = new Set<string>();
  // marbleRouter object literal: each line is `<resource>: <ident>Router,`
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

const almanacSource = readFileSync(
  resolve(REPO_ROOT, ALMANAC_REL_PATH),
  "utf8",
);
const indexSource = readFileSync(resolve(REPO_ROOT, ROUTER_INDEX), "utf8");

const almanac = parseAlmanac(almanacSource);
const routerFiles = await collectRouterFiles();
const mountedResources = parseMountedResources(indexSource);

const routerByResource = new Map<string, RouterFile>();
for (const rf of routerFiles) {
  routerByResource.set(rf.resource, rf);
}

interface Issue {
  filePath?: string;
  kind:
    | "almanac-op-missing-handler"
    | "handler-not-in-almanac"
    | "router-not-mounted"
    | "almanac-resource-no-router";
  operation?: string;
  resource: string;
}

const issues: Issue[] = [];

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
    // No almanac entry at all — this is also covered by harness/almanac.ts.
    // Don't double-report; just flag any handlers as drift.
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
  console.log(
    `harness/handlers: OK (${routerFiles.length} router files, ${[
      ...almanac.values(),
    ].reduce(
      (sum, e) => sum + e.allowed.size,
      0,
    )} almanac operations all wired)`,
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

if (missingHandlers.length > 0) {
  console.error("  Almanac operations with no router handler:");
  for (const i of missingHandlers) {
    console.error(`    ${i.resource}.${i.operation}`);
  }
  console.error(
    `    Action: add the handler to packages/api/src/router/${missingHandlers[0].resource}.ts.`,
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
    `    Action: create packages/api/src/router/<resource>.ts (or hyphenated equivalent).`,
  );
  console.error("");
}

console.error(`${issues.length} issue(s) total.`);
process.exit(1);
