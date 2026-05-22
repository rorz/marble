#!/usr/bin/env bun

/**
 * harness/agent-routes.ts
 *
 * Generates the static, minimal route reference consumed by internal browser
 * agents. The artifact intentionally contains only URL patterns derived from
 * App Router `page.tsx` filenames.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { collectFiles, REPO_ROOT } from "./lib";

const APP_DIR = "apps/web/src/app";
const OUTPUT_FILE = "apps/web/agent-routes.generated.json";
const ROUTE_PAGE_GLOB = `${APP_DIR}/**/page.tsx`;
const INTERCEPTION_MARKERS = [
  "(..)(..)",
  "(...)",
  "(..)",
  "(.)",
] as const;

interface AgentRoutesManifest {
  routes: string[];
  version: 1;
}

const isRouteGroup = (segment: string): boolean => {
  return segment.startsWith("(") && segment.endsWith(")");
};

const stripInterceptionMarker = (segment: string): string => {
  const marker = INTERCEPTION_MARKERS.find((candidate) =>
    segment.startsWith(candidate),
  );
  return marker === undefined ? segment : segment.slice(marker.length);
};

const toVisibleSegment = (segment: string): string | null => {
  if (segment.startsWith("@")) return null;
  if (isRouteGroup(segment)) return null;

  const visible = stripInterceptionMarker(segment);
  return visible.length === 0 ? null : visible;
};

const toRoutePath = (relPath: string): string | null => {
  const routeFile = relPath.slice(APP_DIR.length + 1);
  const routeSegments = routeFile.split("/").slice(0, -1);
  const visibleSegments: string[] = [];

  for (const segment of routeSegments) {
    if (segment.startsWith("_")) return null;

    const visible = toVisibleSegment(segment);
    if (visible !== null) visibleSegments.push(visible);
  }

  return visibleSegments.length === 0 ? "/" : `/${visibleSegments.join("/")}`;
};

const compareRoutes = (left: string, right: string): number => {
  if (left === right) return 0;
  if (left === "/") return -1;
  if (right === "/") return 1;
  return left.localeCompare(right);
};

const findDuplicates = (routePatterns: readonly string[]): string[] => {
  const seen = new Set<string>();
  const duplicateRoutes = new Set<string>();

  for (const route of routePatterns) {
    if (seen.has(route)) {
      duplicateRoutes.add(route);
    } else {
      seen.add(route);
    }
  }

  return [
    ...duplicateRoutes,
  ].sort(compareRoutes);
};

const renderManifest = (manifest: AgentRoutesManifest): string => {
  return `${JSON.stringify(manifest, null, 2)}\n`;
};

const readExistingOutput = (outputPath: string): string | null => {
  return existsSync(outputPath) ? readFileSync(outputPath, "utf8") : null;
};

const writeManifest = (manifest: AgentRoutesManifest): void => {
  const outputPath = resolve(REPO_ROOT, OUTPUT_FILE);
  const nextOutput = renderManifest(manifest);
  const currentOutput = readExistingOutput(outputPath);

  if (currentOutput === nextOutput) {
    console.log(`harness/agent-routes: OK (${manifest.routes.length} routes)`);
    return;
  }

  mkdirSync(dirname(outputPath), {
    recursive: true,
  });
  writeFileSync(outputPath, nextOutput);
  console.log(
    `harness/agent-routes: wrote ${OUTPUT_FILE} (${manifest.routes.length} routes)`,
  );
};

const pageFiles = await collectFiles([
  ROUTE_PAGE_GLOB,
]);
const agentRoutes = pageFiles
  .map(toRoutePath)
  .filter((route): route is string => route !== null)
  .sort(compareRoutes);
const routeCollisions = findDuplicates(agentRoutes);

if (routeCollisions.length > 0) {
  console.error("harness/agent-routes: duplicate route patterns found");
  for (const duplicate of routeCollisions) {
    console.error(`  ${duplicate}`);
  }
  process.exit(1);
}

writeManifest({
  routes: agentRoutes,
  version: 1,
});
