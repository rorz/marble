#!/usr/bin/env bun

/**
 * packages/wizard/catalogue.ts
 *
 * Single source of truth for the Marble Wizard skill's operation catalogue.
 *
 * The skill (`src/SKILL.md`) used to hand-maintain the list of CLI operations.
 * It drifted: it advertised a `sidebar` resource the CLI strips, `profiles`
 * create/delete operations that don't exist, and omitted `programs.delete`.
 * An agent reading the skill would confidently call dead commands.
 *
 * This module regenerates the catalogue directly from `marbleCliContract` —
 * the *exact* object the CLI builds its commands from (`packages/cli/src/root.ts`)
 * and that `marble describe` enumerates. If the contract and the skill disagree,
 * the contract wins.
 *
 * Two jobs:
 *
 *   1. Render the catalogue and splice it into SKILL.md between the
 *      `catalogue:start` / `catalogue:end` markers.
 *   2. Audit every `marble <resource> <operation>` reference *anywhere* in the
 *      skill (prose + examples) and flag any that the contract can't satisfy —
 *      so a phantom command in a worked example fails the build, not the agent.
 *
 * Run as a writer:   `bun run catalogue.ts`           (rewrites SKILL.md)
 * Run as a guard:    `bun run catalogue.ts --check`   (exits 1 on any drift)
 *
 * The read-only guard is also wired into the harness (`harness/wizard-skill.ts`)
 * so `bun check` catches drift in CI.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { marbleCliContract } from "@marble/contracts";

const skillUrl = new URL("./src/SKILL.md", import.meta.url);

/** Absolute path to the skill markdown this module owns. */
export const SKILL_PATH: string = fileURLToPath(skillUrl);

/** Marker comments that bracket the generated catalogue block in SKILL.md. */
export const CATALOGUE_START = "<!-- catalogue:start -->";
export const CATALOGUE_END = "<!-- catalogue:end -->";

/**
 * `marble <token> ...` invocations whose first token is a real CLI command but
 * NOT a contract resource. These are the hand-written escape hatches in
 * `packages/cli/src/root.ts` and must be exempt from the contract audit.
 */
const NON_CONTRACT_COMMANDS: ReadonlySet<string> = new Set([
  "describe",
  "program-dir",
]);

/**
 * The CLI surface as `resource -> operations`, in contract declaration order
 * (the same order `marble describe` prints). Not sorted on purpose: the
 * catalogue should line up 1:1 with what an agent sees from `describe`.
 */
export const contractIndex = (): Map<string, string[]> => {
  const index = new Map<string, string[]>();
  for (const [resource, operations] of Object.entries(marbleCliContract)) {
    index.set(resource, Object.keys(operations as Record<string, unknown>));
  }
  return index;
};

/** Flat set of `resource.operation` keys for fast membership checks. */
const contractOperationKeys = (): Set<string> => {
  const keys = new Set<string>();
  for (const [resource, operations] of contractIndex()) {
    for (const operation of operations) {
      keys.add(`${resource}.${operation}`);
    }
  }
  return keys;
};

/**
 * Render the catalogue body (the bullet list only — markers are added by the
 * splicer). One line per resource: `` - `resource`: `op`, `op`, ... ``.
 */
export const renderCatalogue = (): string =>
  [
    ...contractIndex(),
  ]
    .map(
      ([resource, operations]) =>
        `- \`${resource}\`: ${operations.map((op) => `\`${op}\``).join(", ")}`,
    )
    .join("\n");

/** The catalogue block exactly as it should appear on disk, markers included. */
const renderCatalogueBlock = (): string =>
  `${CATALOGUE_START}\n${renderCatalogue()}\n${CATALOGUE_END}`;

interface SplicedResult {
  changed: boolean;
  content: string;
  hasMarkers: boolean;
}

/**
 * Replace whatever sits between the markers with a freshly rendered block.
 * Returns `hasMarkers: false` (and the input untouched) if the markers are
 * missing — the caller decides whether that's fatal.
 */
export const spliceCatalogue = (markdown: string): SplicedResult => {
  const startAt = markdown.indexOf(CATALOGUE_START);
  const endAt = markdown.indexOf(CATALOGUE_END);

  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    return {
      changed: false,
      content: markdown,
      hasMarkers: false,
    };
  }

  const before = markdown.slice(0, startAt);
  const after = markdown.slice(endAt + CATALOGUE_END.length);
  const content = `${before}${renderCatalogueBlock()}${after}`;

  return {
    changed: content !== markdown,
    content,
    hasMarkers: true,
  };
};

export interface PhantomReference {
  line: number;
  operation: string;
  raw: string;
  resource: string;
}

/**
 * Find every `marble <resource> <operation>` invocation in the skill that the
 * contract cannot satisfy. Placeholders (`marble <resource> ...`), flags
 * (`marble --help`), the `bunx marble-cli` fallback, and the non-contract
 * commands (`describe`, `program-dir`) are all skipped.
 */
export const phantomReferences = (markdown: string): PhantomReference[] => {
  const known = contractOperationKeys();
  const violations: PhantomReference[] = [];

  // `\bmarble ` (a real space, not `marble-cli`) followed by two identifier-ish
  // tokens. Placeholders start with `<` and flags with `-`, so they never match.
  const pattern = /\bmarble[ \t]+([a-zA-Z][\w-]*)[ \t]+([a-zA-Z][\w-]*)/g;

  let match: RegExpExecArray | null = pattern.exec(markdown);
  while (match !== null) {
    const [raw, resource, operation] = match;
    if (
      !NON_CONTRACT_COMMANDS.has(resource) &&
      !known.has(`${resource}.${operation}`)
    ) {
      violations.push({
        line: markdown.slice(0, match.index).split("\n").length,
        operation,
        raw: raw.trim(),
        resource,
      });
    }
    match = pattern.exec(markdown);
  }

  return violations;
};

export interface SkillAudit {
  /** Generated catalogue block matches the one on disk. */
  catalogueInSync: boolean;
  /** The markers are present and well-formed. */
  hasMarkers: boolean;
  /** `marble` invocations the contract can't satisfy. */
  phantomReferences: PhantomReference[];
}

/** Read-only audit of a skill markdown string against the live contract. */
export const auditSkill = (markdown: string): SkillAudit => {
  const spliced = spliceCatalogue(markdown);
  return {
    catalogueInSync: spliced.hasMarkers && !spliced.changed,
    hasMarkers: spliced.hasMarkers,
    phantomReferences: phantomReferences(markdown),
  };
};

export const readSkill = (): string => readFileSync(skillUrl, "utf8");

/**
 * CLI entry point. `--check` audits without writing; otherwise rewrites the
 * catalogue in place. Phantom references are fatal in both modes — they can't
 * be auto-fixed, and a dead command in the skill is the whole bug this guards.
 */
const main = (): void => {
  const check = process.argv.includes("--check");
  const markdown = readSkill();
  const spliced = spliceCatalogue(markdown);
  const phantoms = phantomReferences(markdown);

  if (!spliced.hasMarkers) {
    console.error(
      `wizard/catalogue: missing ${CATALOGUE_START} / ${CATALOGUE_END} markers in SKILL.md`,
    );
    process.exit(1);
  }

  if (phantoms.length > 0) {
    console.error(
      "wizard/catalogue: phantom CLI references (no such contract operation):",
    );
    for (const p of phantoms) {
      console.error(
        `  SKILL.md:${p.line}  ${p.raw}  →  ${p.resource}.${p.operation}`,
      );
    }
  }

  if (check) {
    if (!spliced.changed && phantoms.length === 0) {
      console.log("wizard/catalogue: OK (in sync with marbleCliContract)");
      process.exit(0);
    }
    if (spliced.changed) {
      console.error(
        "wizard/catalogue: catalogue is out of sync — run `bun run --filter @marble/wizard sync:skill`",
      );
    }
    process.exit(1);
  }

  if (spliced.changed) {
    writeFileSync(skillUrl, spliced.content);
    console.log(
      "wizard/catalogue: catalogue regenerated from marbleCliContract",
    );
  } else {
    console.log("wizard/catalogue: catalogue already in sync");
  }

  if (phantoms.length > 0) {
    process.exit(1);
  }
};

if (import.meta.main) {
  main();
}
