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
 * Worker runtime operations (`@marble/store` internals invoked by executor /
 * ingestor) are a different surface and not yet validated here.
 */

import { marbleContract } from "@marble/contracts";
import { parseAlmanac, readAlmanac } from "./lib";

const extractContractOperations = (): Map<string, Set<string>> => {
  const result = new Map<string, Set<string>>();
  for (const [resource, contract] of Object.entries(marbleContract)) {
    result.set(
      resource,
      // harness-ignore: no-forward-reference -- `contract` here is the loop BindingElement, not the module-level const; the checker lacks scope analysis
      new Set(Object.keys(contract as Record<string, unknown>)),
    );
  }
  return result;
};

interface DriftReport {
  /** Operations in the almanac with no contract implementation. Info. */
  almanacNotInContract: Array<{
    operation: string;
    resource: string;
  }>;
  /** Resources in the almanac with no contract entry. Info. */
  almanacResourceNotInContract: string[];
  /** Operations on the contract that are NOT in the almanac. Hard error. */
  contractNotInAlmanac: Array<{
    operation: string;
    resource: string;
  }>;
  /** Resources on the contract that are NOT in the almanac at all. Hard error. */
  contractResourceNotInAlmanac: string[];
  /** Almanac sections without an `Allowed operations:` block. Info. */
  unknownSections: string[];
}

const contract = extractContractOperations();

const diff = (
  contract: Map<string, Set<string>>,
  almanac: ReturnType<typeof parseAlmanac>["resources"],
  unknownSections: string[],
): DriftReport => {
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
};

const report = (
  d: DriftReport,
): {
  failed: boolean;
} => {
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
        "    Action: either give the section an Allowed operations: list, or add it to NON_RESOURCE_SECTIONS in harness/lib.ts.",
      );
      console.warn("");
    }
  }

  return {
    failed: errors > 0,
  };
};

const { resources: almanac, unknownSections } = parseAlmanac(readAlmanac());
const driftReport = diff(contract, almanac, unknownSections);
const { failed } = report(driftReport);

process.exit(failed ? 1 : 0);
