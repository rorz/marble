#!/usr/bin/env bun

/**
 * Rejects catch blocks that hide the caught failure. A catch must bind the
 * thrown value and actually use it for logging, reporting, wrapping, or
 * rethrowing. Intentional parser/fallback cases need an explicit opt-out:
 *
 *   // harness-ignore: no-swallowed-errors -- invalid user JSON falls back
 *   catch {
 *     return {};
 *   }
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { collectFiles, hasIgnore, lineAt, prevLine, REPO_ROOT } from "./lib";

const RULE_ID = "no-swallowed-errors";

const LEGACY_VIOLATION_KEYS = new Set([
  "apps/executor/src/index.ts:45:5",
  "apps/executor/src/runner/index.ts:102:9",
  "apps/executor/src/runner/index.ts:165:7",
  "apps/ingestor/src/consumer.ts:16:5",
  "apps/ingestor/src/producer.ts:46:5",
  "apps/web/src/app/(gui)/agent-chat/storage.ts:111:5",
  "apps/web/src/app/(gui)/agent-chat/storage.ts:133:5",
  "apps/web/src/app/(gui)/agent-chat/storage.ts:151:5",
  "apps/web/src/app/(gui)/change-spotlight/storage.ts:101:5",
  "apps/web/src/app/(gui)/change-spotlight/target-keys.ts:19:5",
  "apps/web/src/app/(gui)/programs/view/sdk.ts:8:5",
  "apps/web/src/app/(gui)/programs/view/secret-config.ts:18:5",
  "apps/web/src/app/(gui)/programs/view/use-draft-sync.ts:80:9",
  "apps/web/src/app/(gui)/programs/view/use-draft-sync.ts:142:11",
  "apps/web/src/app/(gui)/projects/[id]/tables/[tableId]/page.tsx:20:5",
  "apps/web/src/app/(gui)/projects/[id]/tables/[tableId]/view/schema-fields.ts:143:9",
  "apps/web/src/app/(gui)/projects/[id]/tables/[tableId]/view/schema-fields.ts:155:9",
  "apps/web/src/app/(gui)/projects/[id]/tables/[tableId]/view/schema-fields.ts:217:5",
  "apps/web/src/app/(gui)/projects/[id]/tables/[tableId]/view/sidebar.tsx:708:25",
  "apps/web/src/app/api/agent/chat/response.ts:88:13",
  "apps/web/src/app/api/agent/chat/response.ts:96:11",
  "apps/web/src/app/api/agent/chat/response.ts:284:13",
  "apps/web/src/app/api/agent/chat/response.ts:288:11",
  "apps/web/src/app/homepage/actions.ts:98:5",
  "apps/web/src/lib/gui-sidebar.ts:93:5",
  "apps/web/src/lib/marble-sdk-server.ts:60:7",
  "apps/web/src/lib/marble-sdk-server.ts:89:7",
  "apps/web/src/lib/supabase/server.ts:22:13",
  "harness/enforce-arrow-function.ts:202:7",
  "harness/enforce-arrow-function.ts:233:7",
  "harness/max-file-lines.ts:104:5",
  "harness/no-forward-reference.ts:279:7",
  "harness/no-forward-reference.ts:308:7",
  "harness/no-optional-env.ts:70:5",
  "harness/patterns.ts:239:7",
  "packages/agent/src/tools/prepare-call.ts:28:5",
  "packages/api/src/executor.ts:76:5",
  "packages/lib/json/index.ts:42:5",
  "packages/lib/result/index.ts:69:9",
  "packages/store/src/resources/entities/column/dependency.ts:9:5",
  "packages/store/src/resources/entities/program-file/index.ts:170:9",
  "packages/ui/src/components/copy-field.tsx:72:7",
  "packages/ui/src/components/json-preview.tsx:64:5",
  "supabase/seed-fixtures/programs/formula/main.ts:15:5",
  "supabase/seed-fixtures/programs/http-request/main.ts:21:7",
]);

const SCAN_GLOBS: readonly string[] = [
  "apps/**/*.{ts,tsx}",
  "packages/**/*.{ts,tsx}",
  "supabase/**/*.{ts,tsx}",
  "harness/**/*.{ts,tsx}",
];

type Violation = {
  col: number;
  file: string;
  line: number;
  message: string;
};

const isExcludedFile = (relPath: string): boolean =>
  /\.generated\.(ts|tsx)$/.test(relPath) ||
  /\.d\.(ts|tsx)$/.test(relPath) ||
  relPath.startsWith("harness/fixtures/");

const hasRuleIgnore = (source: string, index: number) =>
  hasIgnore(lineAt(source, index), RULE_ID) ||
  hasIgnore(prevLine(source, index), RULE_ID);

const referencesIdentifier = (node: ts.Node, name: string) => {
  let found = false;

  const visit = (child: ts.Node): void => {
    if (found) {
      return;
    }

    if (ts.isIdentifier(child) && child.text === name) {
      found = true;
      return;
    }

    ts.forEachChild(child, visit);
  };

  ts.forEachChild(node, visit);
  return found;
};

const formatLocation = (sourceFile: ts.SourceFile, index: number) => {
  const { character, line } = sourceFile.getLineAndCharacterOfPosition(index);
  return {
    col: character + 1,
    line: line + 1,
  };
};

const createViolation = (
  sourceFile: ts.SourceFile,
  clause: ts.CatchClause,
  message: string,
): Violation => {
  const { col, line } = formatLocation(sourceFile, clause.getStart(sourceFile));
  return {
    col,
    file: sourceFile.fileName,
    line,
    message,
  };
};

const detectViolations = (filename: string, source: string): Violation[] => {
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCatchClause(node)) {
      const start = node.getStart(sourceFile);

      if (!hasRuleIgnore(source, start)) {
        const binding = node.variableDeclaration?.name;

        if (node.block.statements.length === 0) {
          violations.push(
            createViolation(
              sourceFile,
              node,
              "empty catch block; report, wrap, rethrow, or justify with harness-ignore",
            ),
          );
        } else if (!binding || !ts.isIdentifier(binding)) {
          violations.push(
            createViolation(
              sourceFile,
              node,
              "catch must bind the thrown value and use it, or justify the fallback with harness-ignore",
            ),
          );
        } else if (
          binding.text.startsWith("_") ||
          !referencesIdentifier(node.block, binding.text)
        ) {
          violations.push(
            createViolation(
              sourceFile,
              node,
              `caught error "${binding.text}" is not used; log, report, wrap with cause, or rethrow it`,
            ),
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
};

console.error(`harness/${RULE_ID}: scanning…`);

const files = await collectFiles(SCAN_GLOBS, {
  skipDirs: [
    "coverage",
  ],
});
const allViolations: Violation[] = [];

for (const relPath of files) {
  if (isExcludedFile(relPath)) {
    continue;
  }

  let source: string;
  try {
    source = readFileSync(resolve(REPO_ROOT, relPath), "utf8");
  } catch (error) {
    console.error(`${RULE_ID}: cannot read file ${relPath}`, error);
    process.exitCode = 2;
    continue;
  }

  allViolations.push(...detectViolations(relPath, source));
}

if (process.exitCode === 2) {
  process.exit(2);
}

const newViolations = allViolations.filter(
  (violation) =>
    !LEGACY_VIOLATION_KEYS.has(
      `${violation.file}:${violation.line}:${violation.col}`,
    ),
);

if (newViolations.length === 0) {
  console.error(`harness/${RULE_ID}: OK`);
  if (allViolations.length > 0) {
    console.error(
      `harness/${RULE_ID}: ${allViolations.length} legacy violation(s) baselined`,
    );
  }
  process.exit(0);
}

for (const violation of newViolations) {
  console.error(
    `${violation.file}:${violation.line}:${violation.col} ${RULE_ID} — ${violation.message}`,
  );
}

console.error(`\n${RULE_ID}: ${newViolations.length} violation(s) found.`);
process.exit(1);
