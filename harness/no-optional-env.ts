#!/usr/bin/env bun

/**
 * Enforces strict environment schemas. Env variables are required by default;
 * `.optional()` inside `src/env.ts` must carry an explicit justification:
 *
 *   // harness-ignore: no-optional-env -- <why absent is valid>
 *   OPTIONAL_PROVIDER_KEY: z.string().min(1).optional(),
 *
 * This keeps "optional because local build was easier" from becoming product
 * behavior. Use the opt-out only for truly conditional integrations, defaults,
 * or variables whose absence is a real supported mode.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectFiles,
  hasIgnore,
  lineAt,
  locate,
  prevLine,
  REPO_ROOT,
} from "./lib";

const RULE_ID = "no-optional-env";
const OPTIONAL_CALL_PATTERN = /\.optional\s*\(/g;

const SCAN_GLOBS: readonly string[] = [
  "apps/**/src/env.ts",
  "packages/**/src/env.ts",
];

type Finding = {
  col: number;
  line: number;
  relPath: string;
};

const detectFindings = (relPath: string, source: string): Finding[] => {
  const findings: Finding[] = [];
  let match: RegExpExecArray | null = OPTIONAL_CALL_PATTERN.exec(source);

  while (match !== null) {
    const currentLine = lineAt(source, match.index);
    const previousLine = prevLine(source, match.index);

    if (!hasIgnore(currentLine, RULE_ID) && !hasIgnore(previousLine, RULE_ID)) {
      const location = locate(source, match.index);
      findings.push({
        col: location.col,
        line: location.line,
        relPath,
      });
    }

    match = OPTIONAL_CALL_PATTERN.exec(source);
  }

  return findings;
};

const files = await collectFiles(SCAN_GLOBS);
const allFindings: Finding[] = [];

for (const relPath of files) {
  let source: string;
  try {
    source = readFileSync(resolve(REPO_ROOT, relPath), "utf8");
  } catch {
    continue;
  }

  allFindings.push(...detectFindings(relPath, source));
}

if (allFindings.length === 0) {
  console.log("harness/no-optional-env: OK");
  process.exit(0);
}

console.error("");
console.error(
  `harness/no-optional-env: ${allFindings.length} optional env schema(s) lack justification`,
);
console.error("");
console.error(
  "  Env vars are required by default. Only use `.optional()` when",
);
console.error(
  "  absence is a real supported mode, then document that mode with:",
);
console.error("");
console.error(
  "    // harness-ignore: no-optional-env -- <why absent is valid>",
);
console.error("");
console.error("  Findings:");
for (const finding of allFindings) {
  console.error(
    `    ${finding.relPath}:${finding.line}:${finding.col}  .optional()`,
  );
}

process.exit(1);
