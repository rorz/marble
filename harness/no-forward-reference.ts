#!/usr/bin/env bun

/**
 * Enforces AGENTS.md NEVER #15 — top-level value bindings must be declared
 * before any same-file reference to their name. Exempts type-only references,
 * self-references (recursion), and inline `// harness-ignore: no-forward-reference --`
 * opt-outs (mutual recursion). See AGENTS.md NEVER #15 for the full contract.
 *
 * CLI: `bun harness/no-forward-reference.ts [--file <path>]`. Exit 0 clean, 1 violations, 2 bad args.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { collectFiles, hasIgnore, lineAt, prevLine, REPO_ROOT } from "./lib";

const RULE_ID = "no-forward-reference";

const SCAN_GLOBS: readonly string[] = [
  "apps/**/*.{ts,tsx}",
  "packages/**/*.{ts,tsx}",
  "supabase/**/*.{ts,tsx}",
  "harness/**/*.{ts,tsx}",
];

const isExcludedFile = (relPath: string): boolean =>
  /\.generated\.(ts|tsx)$/.test(relPath) ||
  /\.d\.(ts|tsx)$/.test(relPath) ||
  relPath.startsWith("harness/fixtures/");

// ─── Public types ─────────────────────────────────────────────────────────────

export type Violation = {
  col: number;
  declLine: number;
  file: string;
  line: number;
  message: string;
  name: string;
};

// ─── Module-local AST helpers (not exported per AGENTS.md NEVER #11) ─────────

type Binding = {
  declNode: ts.Statement;
  namePos: number;
  nameLine: number;
};

/**
 * Walk the top-level statements of a SourceFile and collect every binding
 * we care about (see file header for the full list).
 */
const collectTopLevelBindings = (sf: ts.SourceFile): Map<string, Binding> => {
  const out = new Map<string, Binding>();

  const record = (
    name: ts.Identifier | undefined,
    stmt: ts.Statement,
  ): void => {
    if (!name) return;
    const pos = name.getStart(sf);
    const { line } = sf.getLineAndCharacterOfPosition(pos);
    out.set(name.text, {
      declNode: stmt,
      nameLine: line + 1,
      namePos: pos,
    });
  };

  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) record(decl.name, stmt);
        // destructured top-level bindings are rare and shape-dependent; skip
      }
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      record(stmt.name, stmt);
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      record(stmt.name, stmt);
    } else if (ts.isEnumDeclaration(stmt) && stmt.name) {
      record(stmt.name, stmt);
    }
    // TypeAliasDeclaration, InterfaceDeclaration: type-only — skip
    // ImportDeclaration: always at top; can't be forward-referenced — skip
    // ExportDeclaration / ExportAssignment: re-exports / default — skip
    // ModuleDeclaration (namespace): rare; skip for now
  }

  return out;
};

/**
 * True when `id` is the *name* of a declaration / parameter / property / etc.,
 * i.e. it is introducing or labeling a binding rather than referring to one.
 */
const isDeclarationOrPropertyName = (id: ts.Identifier): boolean => {
  const parent = id.parent;
  if (!parent) return false;
  switch (parent.kind) {
    case ts.SyntaxKind.VariableDeclaration:
    case ts.SyntaxKind.FunctionDeclaration:
    case ts.SyntaxKind.ClassDeclaration:
    case ts.SyntaxKind.InterfaceDeclaration:
    case ts.SyntaxKind.TypeAliasDeclaration:
    case ts.SyntaxKind.EnumDeclaration:
    case ts.SyntaxKind.EnumMember:
    case ts.SyntaxKind.Parameter:
    case ts.SyntaxKind.PropertyDeclaration:
    case ts.SyntaxKind.PropertySignature:
    case ts.SyntaxKind.PropertyAssignment:
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.MethodSignature:
    case ts.SyntaxKind.GetAccessor:
    case ts.SyntaxKind.SetAccessor:
    case ts.SyntaxKind.BindingElement:
    case ts.SyntaxKind.ImportClause:
    case ts.SyntaxKind.ImportSpecifier:
    case ts.SyntaxKind.NamespaceImport:
    case ts.SyntaxKind.ExportSpecifier:
    case ts.SyntaxKind.NamespaceExportDeclaration:
    case ts.SyntaxKind.JsxAttribute:
    case ts.SyntaxKind.TypeParameter:
    case ts.SyntaxKind.LabeledStatement:
      return (
        (
          parent as unknown as {
            name?: ts.Node;
          }
        ).name === id
      );
    case ts.SyntaxKind.PropertyAccessExpression:
    case ts.SyntaxKind.QualifiedName:
      // `obj.foo` — only flag `obj`, never `foo`
      return (parent as ts.PropertyAccessExpression).name === id;
    default:
      return false;
  }
};

/**
 * True when `id` sits inside a TypeNode subtree — type-only positions are
 * erased at runtime, so forward references there are harmless.
 */
const isInTypePosition = (id: ts.Identifier): boolean => {
  let p: ts.Node | undefined = id.parent;
  while (p) {
    const k = p.kind;
    if (k >= ts.SyntaxKind.FirstTypeNode && k <= ts.SyntaxKind.LastTypeNode) {
      return true;
    }
    // TypeQuery (`typeof x`) lives in the type-node range above; this is here
    // for explicit clarity if TS rearranges enums in a future version.
    if (k === ts.SyntaxKind.TypeQuery) return true;
    p = p.parent;
  }
  return false;
};

/**
 * True when `id` is a descendant of `declNode` — recursion / self-reference.
 */
const isSelfReference = (
  id: ts.Identifier,
  declNode: ts.Statement,
): boolean => {
  let p: ts.Node | undefined = id.parent;
  while (p) {
    if (p === declNode) return true;
    p = p.parent;
  }
  return false;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse `source` as TypeScript and return every same-file forward reference
 * to a top-level value binding. Pure — no side effects.
 *
 * `filename` is stored verbatim in `Violation.file`; callers choose whether
 * to pass an absolute path or a repo-relative path.
 */
export const detectViolations = (
  filename: string,
  source: string,
): Violation[] => {
  const sf = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );

  const bindings = collectTopLevelBindings(sf);
  if (bindings.size === 0) return [];

  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) {
      const binding = bindings.get(node.text);
      if (binding !== undefined) {
        const refPos = node.getStart(sf);
        if (refPos < binding.namePos) {
          // Forward reference candidate — apply exemptions
          if (
            !isDeclarationOrPropertyName(node) &&
            !isSelfReference(node, binding.declNode) &&
            !isInTypePosition(node)
          ) {
            const currLine = lineAt(source, refPos);
            const prev = prevLine(source, refPos);
            if (!hasIgnore(currLine, RULE_ID) && !hasIgnore(prev, RULE_ID)) {
              const { line, character } =
                sf.getLineAndCharacterOfPosition(refPos);
              violations.push({
                col: character,
                declLine: binding.nameLine,
                file: filename,
                line: line + 1,
                message: `${RULE_ID} — '${node.text}' referenced on line ${line + 1} but declared later on line ${binding.nameLine}. Move the declaration above its first use (or add a harness-ignore for legit cases like mutual recursion). See AGENTS.md NEVER #15.`,
                name: node.text,
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return violations;
};

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const USAGE = `Usage: bun harness/${RULE_ID}.ts [--file <abs-or-rel-path>]`;

  const printUsage = (): void => {
    console.error(USAGE);
  };

  const printViolation = (v: Violation): void => {
    console.log(`${v.file}:${v.line}:${v.col} ${v.message}`);
  };

  const args = process.argv.slice(2);

  let singleFile: string | undefined;

  if (args.length === 0) {
    singleFile = undefined;
  } else if (args.length === 2 && args[0] === "--file") {
    singleFile = args[1];
  } else if (args.length === 1 && args[0] === "--file") {
    console.error(`${RULE_ID}: --file requires a path argument.`);
    printUsage();
    process.exit(2);
  } else {
    console.error(`${RULE_ID}: unknown argument(s): ${args.join(" ")}`);
    printUsage();
    process.exit(2);
  }

  console.error(`harness/${RULE_ID}: scanning…`);

  if (singleFile !== undefined) {
    const rawPath = singleFile;
    const absPath = rawPath.startsWith("/")
      ? rawPath
      : resolve(REPO_ROOT, rawPath);

    let source: string;
    try {
      source = readFileSync(absPath, "utf8");
    } catch {
      console.error(`${RULE_ID}: cannot read file: ${absPath}`);
      process.exit(2);
    }

    const violations = detectViolations(rawPath, source);

    if (violations.length === 0) {
      console.error(`harness/${RULE_ID}: OK`);
      process.exit(0);
    }

    for (const v of violations) printViolation(v);
    process.exit(1);
  }

  const files = await collectFiles(SCAN_GLOBS, {
    skipDirs: [
      "coverage",
    ],
  });
  const allViolations: Violation[] = [];

  for (const relPath of files) {
    if (isExcludedFile(relPath)) continue;

    let source: string;
    try {
      source = readFileSync(resolve(REPO_ROOT, relPath), "utf8");
    } catch {
      continue;
    }

    allViolations.push(...detectViolations(relPath, source));
  }

  if (allViolations.length === 0) {
    console.error(`harness/${RULE_ID}: OK`);
    process.exit(0);
  }

  for (const v of allViolations) printViolation(v);
  console.error(`\n${RULE_ID}: ${allViolations.length} violation(s) found.`);
  process.exit(1);
}
