#!/usr/bin/env bun

/**
 * harness/wizard-skill.ts
 *
 * Keeps the Marble Wizard skill (`packages/wizard/src/SKILL.md`) honest against
 * the live CLI contract. The skill is what an agent reads before driving the
 * `marble` CLI; when it drifts, the agent confidently calls dead commands.
 *
 * Two hard checks (both sourced from `marbleCliContract` via the wizard's own
 * `catalogue` module, so the harness and the generator can never disagree):
 *
 *   1. The generated operation catalogue between the `catalogue:start` /
 *      `catalogue:end` markers must match the contract exactly.
 *   2. Every `marble <resource> <operation>` invocation anywhere in the skill
 *      (prose and worked examples) must resolve to a real contract operation.
 *
 * Fix drift with `bun run --filter @marble/wizard sync:skill`. This is the rail
 * the `sidebar getData` / `profiles create` / missing `programs delete` drift
 * tripped — caught here instead of in an agent's session.
 */

import { auditSkill, readSkill } from "@marble/wizard/catalogue";

const audit = auditSkill(readSkill());

const errors: string[] = [];

if (!audit.hasMarkers) {
  errors.push(
    "SKILL.md is missing the catalogue:start / catalogue:end markers — the catalogue can't be generated.",
  );
}

if (audit.hasMarkers && !audit.catalogueInSync) {
  errors.push(
    "Operation catalogue is out of sync with `marbleCliContract`. Run `bun run --filter @marble/wizard sync:skill`.",
  );
}

if (audit.phantomReferences.length > 0) {
  console.error("");
  console.error("harness/wizard-skill: phantom CLI references in SKILL.md");
  console.error(
    "  (these `marble` commands have no matching contract operation)",
  );
  console.error("");
  for (const ref of audit.phantomReferences) {
    console.error(
      `    SKILL.md:${ref.line}  ${ref.raw}  →  ${ref.resource}.${ref.operation}`,
    );
  }
  console.error(
    "    Action: fix the example, or add the operation to the contract.",
  );
  console.error("");
  errors.push(`${audit.phantomReferences.length} phantom CLI reference(s).`);
}

if (errors.length > 0) {
  console.error("harness/wizard-skill: drift detected");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(
  "harness/wizard-skill: OK (catalogue + references match marbleCliContract)",
);
