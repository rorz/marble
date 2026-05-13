#!/usr/bin/env bun

/**
 * harness/catalog.ts
 *
 * Asserts catalog discipline across the monorepo:
 *
 *   - Every external dep in every workspace package.json must use
 *     `catalog:base` (or `catalog:<name>`) and the catalog entry must exist
 *     in the root package.json's catalogs map.
 *   - Every internal dep must use `workspace:*` (not `workspace:` or any
 *     other variant Bun happens to tolerate today).
 *   - Catalog drift (anything else) is a hard error.
 *   - Unused catalog entries are surfaced as a warning so we can prune them.
 *
 * Catalog drift kills dedup, makes `bun check` flap, and produces silent
 * version skew across packages. Catch it at the harness, not in production.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectFiles, REPO_ROOT } from "./lib";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  peerDependencies?: Record<string, string>;
}

interface RootPackageJson extends PackageJson {
  workspaces: {
    catalog?: Record<string, string>;
    catalogs?: Record<string, Record<string, string>>;
  };
}

interface CatalogError {
  depName: string;
  field: string;
  message: string;
  packagePath: string;
  spec: string;
}

const rootPkg = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"),
) as RootPackageJson;

const namedCatalogs = rootPkg.workspaces.catalogs ?? {};
const defaultCatalog = rootPkg.workspaces.catalog ?? {};

const knownCatalogKeys = new Map<string, Set<string>>();
knownCatalogKeys.set("", new Set(Object.keys(defaultCatalog)));
for (const [name, entries] of Object.entries(namedCatalogs)) {
  knownCatalogKeys.set(name, new Set(Object.keys(entries)));
}

const usedCatalogKeys = new Map<string, Set<string>>();
for (const name of knownCatalogKeys.keys()) {
  usedCatalogKeys.set(name, new Set());
}

const errors: CatalogError[] = [];

const classify = (
  spec: string,
): {
  kind: "workspace" | "catalog" | "drift";
  catalog?: string;
} => {
  if (spec === "workspace:*")
    return {
      kind: "workspace",
    };
  if (spec.startsWith("workspace:")) {
    return {
      kind: "drift",
    };
  }
  if (spec === "catalog:")
    return {
      catalog: "",
      kind: "catalog",
    };
  if (spec.startsWith("catalog:")) {
    return {
      catalog: spec.slice("catalog:".length),
      kind: "catalog",
    };
  }
  return {
    kind: "drift",
  };
};

const FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
] as const;

const packages = await collectFiles([
  "apps/*/package.json",
  "packages/*/package.json",
  "harness/package.json",
  "supabase/package.json",
]);

for (const pkgPath of packages) {
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(
      readFileSync(resolve(REPO_ROOT, pkgPath), "utf8"),
    ) as PackageJson;
  } catch (cause) {
    errors.push({
      depName: "(file)",
      field: "(parse)",
      message: `failed to parse package.json: ${(cause as Error).message}`,
      packagePath: pkgPath,
      spec: "",
    });
    continue;
  }

  for (const field of FIELDS) {
    const deps = pkg[field];
    if (!deps) continue;

    for (const [depName, spec] of Object.entries(deps)) {
      const c = classify(spec);

      if (c.kind === "workspace") continue;

      if (c.kind === "catalog") {
        const cat = c.catalog ?? "";
        const keys = knownCatalogKeys.get(cat);
        if (!keys) {
          errors.push({
            depName,
            field,
            message: `catalog "${cat || "(default)"}" is referenced but not declared at workspaces.catalogs.${cat || "(default)"}`,
            packagePath: pkgPath,
            spec,
          });
          continue;
        }
        if (!keys.has(depName)) {
          errors.push({
            depName,
            field,
            message: `uses ${spec} but ${depName} is not listed in root catalogs.${cat || "(default)"}`,
            packagePath: pkgPath,
            spec,
          });
          continue;
        }
        const used = usedCatalogKeys.get(cat);
        used?.add(depName);
        continue;
      }

      const isInternalLooking = depName.startsWith("@marble/");
      errors.push({
        depName,
        field,
        message: isInternalLooking
          ? `internal package must use "workspace:*", got "${spec}"`
          : `external dep must use "catalog:base" (or another declared catalog), got "${spec}"`,
        packagePath: pkgPath,
        spec,
      });
    }
  }
}

const warnings: string[] = [];
for (const [catalogName, allKeys] of knownCatalogKeys) {
  const used = usedCatalogKeys.get(catalogName) ?? new Set();
  for (const key of allKeys) {
    if (!used.has(key)) {
      warnings.push(
        `unused catalog entry: catalogs.${catalogName || "(default)"}.${key}`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error("");
  console.error("harness/catalog: drift detected");
  console.error("");

  const byPackage = new Map<string, CatalogError[]>();
  for (const e of errors) {
    const arr = byPackage.get(e.packagePath) ?? [];
    arr.push(e);
    byPackage.set(e.packagePath, arr);
  }
  for (const [pkgPath, hits] of byPackage) {
    console.error(`  ${pkgPath}`);
    for (const hit of hits) {
      console.error(`    [${hit.field}] ${hit.depName}: ${hit.message}`);
    }
  }
  console.error("");
}

if (warnings.length > 0) {
  console.warn("harness/catalog: unused catalog entries (warning)");
  for (const w of warnings) {
    console.warn(`  ${w}`);
  }
  console.warn("");
}

if (errors.length > 0) {
  console.error(`${errors.length} catalog drift error(s).`);
  process.exit(1);
}

console.log(
  `harness/catalog: OK (${packages.length} packages, ${warnings.length} unused catalog entr${warnings.length === 1 ? "y" : "ies"})`,
);
