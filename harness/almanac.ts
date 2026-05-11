#!/usr/bin/env bun

/**
 * harness/almanac.ts
 *
 * Validates the public oRPC contract surface against the data interface
 * almanac at docs/internal/data-interface-definitions.md.
 *
 * Two checks:
 *
 *   1. ERROR — every operation present on `marbleContract` MUST be listed in
 *      the almanac. An LLM (or human) adding a new contract method without
 *      almanac coverage is exactly the silent surface-area drift this rail
 *      exists to catch.
 *
 *   2. INFO — almanac operations with no contract implementation are
 *      reported but do not fail. These are usually intentional gaps where
 *      the almanac has been written ahead of the code, and the surface
 *      will catch up.
 *
 * The almanac uses prose-with-structure:
 *
 *     ## projects
 *     ...
 *     Allowed operations:
 *     - `create` - Description.
 *     - `list` - Description.
 *
 * Non-resource sections (`Review Rule For Agents`, `Action And RPC Rules`,
 * `Internal worker runtime`) are deliberately skipped — they don't enumerate
 * public operations on a resource.
 *
 * Worker runtime operations (`@marble/store` internals invoked by executor /
 * ingestor) are a different surface and not yet validated here.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { marbleContract } from "@marble/contracts";

const REPO_ROOT = resolve(import.meta.dir, "..");
const ALMANAC_REL_PATH = "docs/internal/data-interface-definitions.md";

/**
 * Sections in the almanac that look like `## name` but are NOT resources.
 * Keeping this allowlisted means the parser fails closed: if a new
 * non-resource section is added, the validator complains until it's added
 * here intentionally.
 */
const NON_RESOURCE_SECTIONS = new Set<string>([
  "Review Rule For Agents",
  "Action And RPC Rules",
  "Internal worker runtime",
]);

interface ResourceAlmanacEntry {
  allowed: Set<string>;
  name: string;
}

function parseAlmanac(source: string): {
  resources: Map<string, ResourceAlmanacEntry>;
  unknownSections: string[];
} {
  const resources = new Map<string, ResourceAlmanacEntry>();
  const unknownSections: string[] = [];

  // Find all `## ` header positions. JS regex has no `\Z` end-of-input
  // anchor, so we use a two-pass approach: first index every header, then
  // slice between consecutive headers (with the final header running to
  // end-of-file).
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
    if (!allowedMatch) {
      unknownSections.push(title);
      continue;
    }

    const allowed = new Set<string>();
    const bulletRegex = /- `([^`]+)`/g;
    let bulletMatch: RegExpExecArray | null = bulletRegex.exec(allowedMatch[1]);
    while (bulletMatch !== null) {
      allowed.add(bulletMatch[1]);
      bulletMatch = bulletRegex.exec(allowedMatch[1]);
    }

    resources.set(title, {
      allowed,
      name: title,
    });
  }

  return {
    resources,
    unknownSections,
  };
}

function extractContractOperations(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const [resource, contract] of Object.entries(marbleContract)) {
    result.set(
      resource,
      new Set(Object.keys(contract as Record<string, unknown>)),
    );
  }
  return result;
}

interface DriftReport {
  /** Operations in the almanac with no contract implementation. Info. */
  almanacNotInContract: Array<{
    resource: string;
    operation: string;
  }>;
  /** Resources in the almanac with no contract entry. Info. */
  almanacResourceNotInContract: string[];
  /** Operations on the contract that are NOT in the almanac. Hard error. */
  contractNotInAlmanac: Array<{
    resource: string;
    operation: string;
  }>;
  /** Resources on the contract that are NOT in the almanac at all. Hard error. */
  contractResourceNotInAlmanac: string[];
  /** Almanac sections without an `Allowed operations:` block. Info. */
  unknownSections: string[];
}

function diff(
  contract: Map<string, Set<string>>,
  almanac: Map<string, ResourceAlmanacEntry>,
  unknownSections: string[],
): DriftReport {
  const contractNotInAlmanac: DriftReport["contractNotInAlmanac"] = [];
  const contractResourceNotInAlmanac: string[] = [];
  const almanacNotInContract: DriftReport["almanacNotInContract"] = [];
  const almanacResourceNotInContract: string[] = [];

  for (const [resource, ops] of contract) {
    const entry = almanac.get(resource);
    if (!entry) {
      contractResourceNotInAlmanac.push(resource);
      continue;
    }
    for (const op of ops) {
      if (!entry.allowed.has(op)) {
        contractNotInAlmanac.push({
          operation: op,
          resource,
        });
      }
    }
  }

  for (const [resource, entry] of almanac) {
    const ops = contract.get(resource);
    if (!ops) {
      almanacResourceNotInContract.push(resource);
      continue;
    }
    for (const op of entry.allowed) {
      if (!ops.has(op)) {
        almanacNotInContract.push({
          operation: op,
          resource,
        });
      }
    }
  }

  return {
    almanacNotInContract,
    almanacResourceNotInContract,
    contractNotInAlmanac,
    contractResourceNotInAlmanac,
    unknownSections,
  };
}

function report(d: DriftReport): {
  failed: boolean;
} {
  const errors =
    d.contractNotInAlmanac.length + d.contractResourceNotInAlmanac.length;
  const info =
    d.almanacNotInContract.length +
    d.almanacResourceNotInContract.length +
    d.unknownSections.length;

  if (errors > 0) {
    console.error("");
    console.error("harness/almanac: contract drift detected");
    console.error("");

    if (d.contractResourceNotInAlmanac.length > 0) {
      console.error("  Resources on `marbleContract` with no almanac entry:");
      for (const resource of d.contractResourceNotInAlmanac) {
        console.error(`    - ${resource}`);
      }
      console.error(
        `    Action: add a \`## ${d.contractResourceNotInAlmanac[0]}\` section to docs/internal/data-interface-definitions.md with an \`Allowed operations:\` list and rationale.`,
      );
      console.error("");
    }

    if (d.contractNotInAlmanac.length > 0) {
      const byResource = new Map<string, string[]>();
      for (const { resource, operation } of d.contractNotInAlmanac) {
        const arr = byResource.get(resource) ?? [];
        arr.push(operation);
        byResource.set(resource, arr);
      }
      console.error("  Contract operations missing from almanac:");
      for (const [resource, ops] of byResource) {
        console.error(
          `    ${resource}: ${ops.map((o) => `\`${o}\``).join(", ")}`,
        );
      }
      console.error(
        "    Action: add the operation(s) to the almanac's resource section, or remove from the contract.",
      );
      console.error("");
    }
  } else {
    console.log("harness/almanac: OK");
  }

  if (info > 0) {
    if (errors > 0) console.error("---");
    console.warn("");
    console.warn("harness/almanac: informational");
    console.warn("");
    if (d.almanacResourceNotInContract.length > 0) {
      console.warn("  Almanac resources with no contract entry (gap):");
      for (const resource of d.almanacResourceNotInContract) {
        console.warn(`    - ${resource}`);
      }
      console.warn("");
    }
    if (d.almanacNotInContract.length > 0) {
      const byResource = new Map<string, string[]>();
      for (const { resource, operation } of d.almanacNotInContract) {
        const arr = byResource.get(resource) ?? [];
        arr.push(operation);
        byResource.set(resource, arr);
      }
      console.warn("  Almanac operations with no contract implementation:");
      for (const [resource, ops] of byResource) {
        console.warn(
          `    ${resource}: ${ops.map((o) => `\`${o}\``).join(", ")}`,
        );
      }
      console.warn("");
    }
    if (d.unknownSections.length > 0) {
      console.warn(
        "  Almanac sections that look like resources but have no `Allowed operations:` block:",
      );
      for (const s of d.unknownSections) {
        console.warn(`    - ${s}`);
      }
      console.warn(
        "    Action: either give the section an Allowed operations: list, or add it to NON_RESOURCE_SECTIONS in harness/almanac.ts.",
      );
      console.warn("");
    }
  }

  return {
    failed: errors > 0,
  };
}

const almanacSource = readFileSync(
  resolve(REPO_ROOT, ALMANAC_REL_PATH),
  "utf8",
);
const { resources: almanac, unknownSections } = parseAlmanac(almanacSource);
const contract = extractContractOperations();
const driftReport = diff(contract, almanac, unknownSections);
const { failed } = report(driftReport);

process.exit(failed ? 1 : 0);
