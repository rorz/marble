#!/usr/bin/env bun

/**
 * harness/patterns.ts
 *
 * Mechanizes the prose anti-patterns prescribed in AGENTS.md and the design
 * guide. Each match exits the process non-zero so `bun check` fails fast.
 *
 * Inline opt-out (same line as the match, or the line immediately above):
 *
 *   // harness-ignore: <rule-id>            (trailing on the match line)
 *   // harness-ignore: <rule-id, other-id>  (previous-line, multi-rule)
 *
 * Stable rule ids ensure opt-outs survive renames. Opt-outs should be rare
 * and accompanied by a written justification on the same line or the line
 * above.
 *
 * Adding a new rule:
 *   1. Append a Rule object to RULES below.
 *   2. Use a stable kebab-case id so opt-outs do not break later.
 *   3. Cite the AGENTS.md / design-guide rule in `link` so failures point at
 *      the source-of-truth, not at this file.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Glob } from "bun";

const REPO_ROOT = resolve(import.meta.dir, "..");

interface Rule {
  /** File-scope predicate. The full repo-relative path is passed. */
  applies: (relPath: string) => boolean;
  /** Stable id used for opt-outs and grouping. Never rename. */
  id: string;
  /** Pointer to the prose rule, shown in error output. */
  link?: string;
  /** Must include the `g` flag. Matched against full file source. */
  pattern: RegExp;
  /** One-sentence remediation hint shown when the rule fails. */
  reason: string;
}

const isTsLike = (p: string): boolean => /\.(ts|tsx|mts|cts)$/.test(p);

/**
 * Any UI surface — product GUI, marketing routes, shared UI primitives.
 * Used for rules that apply universally to UI code.
 */
const isUiSurface = (p: string): boolean =>
  isTsLike(p) && (p.startsWith("apps/web/") || p.startsWith("packages/ui/"));

/**
 * Product UI surfaces only — excludes marketing routes which carry their
 * own visual language and intentionally bypass the product design system
 * (see AGENTS.md UI rule 7).
 */
const isProductUi = (p: string): boolean =>
  isUiSurface(p) && !p.startsWith("apps/web/src/app/homepage/");

const isPackageJson = (p: string): boolean =>
  p === "package.json" || p.endsWith("/package.json");

const isGlobalsCss = (p: string): boolean =>
  p === "apps/web/src/app/globals.css";

const RULES: readonly Rule[] = [
  {
    applies: isTsLike,
    id: "no-window-confirm",
    link: "AGENTS.md UI rule 16",
    pattern: /\bwindow\.(confirm|alert|prompt)\s*\(/g,
    reason:
      "Use MarbleConfirmModal with MarbleConfirmModalState. Browser-native confirms are a UX + a11y regression.",
  },
  {
    applies: isTsLike,
    id: "no-heroicons-import",
    link: "AGENTS.md UI rule 28",
    pattern: /from\s+["']@heroicons\/react/g,
    reason:
      "Phosphor only \u2014 @phosphor-icons/react. Size icons with size={N}; never className h-X w-X.",
  },
  {
    applies: isUiSurface,
    id: "no-json-stringify-in-pre",
    link: "AGENTS.md UI rule 18",
    pattern: /<pre[\s\S]{0,60}?\{\s*JSON\.stringify/g,
    reason:
      "Use <MarbleJsonPreview value={...} />. Hand-rolled JSON pretty-printers are forbidden.",
  },
  {
    applies: isUiSurface,
    id: "no-tokenize-json-helper",
    link: "AGENTS.md UI rule 18",
    pattern: /\btokenizeJson\b/g,
    reason:
      "Use <MarbleJsonPreview value={...} />. Hand-rolled JSON tokenizers are forbidden.",
  },
  {
    applies: isUiSurface,
    id: "no-unicode-close-glyph",
    link: "AGENTS.md UI rule 21",
    pattern: /<button\b[^>]*>\s*(?:×|✕|✖|✗|&times;|&#215;|&#x00d7;)\s*</gi,
    reason:
      "Use <MarbleModalClose /> or <MarbleSheetClose />. The unicode \u00d7 glyph is never the answer.",
  },
  {
    applies: isProductUi,
    id: "no-inline-shadow-token",
    link: "AGENTS.md UI rule 13",
    pattern: /shadow-\[inset_/g,
    reason:
      "Compose Tailwind primitives: `inset-shadow-2xs inset-shadow-{color}/{alpha}` for inset highlights, `inset-ring-N inset-ring-{color}/{alpha}` for inset rings. Stripes (shadow-marble-stripe-left/top) are the only retained bespoke tokens.",
  },
  {
    applies: isProductUi,
    id: "no-inline-gradient",
    link: "AGENTS.md UI rule 13",
    pattern: /bg-\[linear-gradient/g,
    reason:
      "Use bg-workbench-surface or extend tokens in apps/web/src/app/globals.css.",
  },
  {
    applies: isProductUi,
    id: "no-text-tracking-cocktail",
    link: "AGENTS.md UI rule 13",
    pattern: /text-\[\d+px\][^"'`]{0,80}tracking-\[/g,
    reason:
      "Use text-eyebrow / text-eyebrow-lg / text-eyebrow-xs instead of text-[Xpx] tracking-[X.XXem] cocktails.",
  },
  {
    applies: isPackageJson,
    id: "no-npx-in-scripts",
    link: "AGENTS.md rule 9 (NEVER)",
    pattern: /"[\w:-]+"\s*:\s*"[^"]*\bnpx\b[^"]*"/g,
    reason:
      "Use bun, bunx, or invoke binaries directly (e.g. `supabase`). Never npx.",
  },
  {
    applies: isGlobalsCss,
    id: "no-bespoke-shadow-token",
    link: "design-guide.md Token Naming Discipline",
    // Match any `--shadow-marble-*` token definition EXCEPT the retained
    // stripe-left / stripe-top, which are the sole survivors of the
    // no-named-tokens rule (no Tailwind primitive for one-sided inset bars).
    pattern: /^\s*--shadow-marble-(?!stripe-(?:left|top)\b)[a-z0-9-]+\s*:/gm,
    reason:
      "Compose Tailwind primitives at the consumer site (e.g. `inset-shadow-2xs inset-shadow-white/70`). The only retained `--shadow-marble-*` tokens are stripe-left and stripe-top — see design-guide.md.",
  },
  {
    applies: isGlobalsCss,
    id: "no-bespoke-bg-utility",
    link: "design-guide.md Token Naming Discipline",
    // Match any `@utility bg-*` declaration EXCEPT the retained
    // bg-workbench-surface (product identity canvas).
    pattern: /@utility\s+bg-(?!workbench-surface\b)[a-z0-9-]+/g,
    reason:
      "Compose Tailwind gradient utilities at the consumer site (`bg-linear-to-b from-X to-Y` with alpha modifiers). The only retained `@utility bg-*` is `bg-workbench-surface`.",
  },
  {
    applies: isGlobalsCss,
    id: "no-raw-hex-in-shadow-token",
    link: "design-guide.md Token Naming Discipline",
    // Catch raw hex / rgba inside shadow token definitions specifically.
    // Broader hex/rgba in keyframes and marketing @utility blocks is
    // grandfathered for now and tracked separately.
    pattern:
      /^\s*--shadow-[a-z0-9-]+\s*:[^;]*(?:#[0-9a-fA-F]{3,8}\b|\brgba?\()/gm,
    reason:
      "Shadow tokens must use Tailwind palette refs (`var(--color-*)`) or `--alpha(var(--color-*) / N%)`. Raw hex / rgba is forbidden.",
  },
];

interface Finding {
  col: number;
  excerpt: string;
  line: number;
  relPath: string;
  rule: Rule;
}

function locate(
  source: string,
  index: number,
): {
  line: number;
  col: number;
} {
  let line = 1;
  let lastNl = -1;
  for (let i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lastNl = i;
    }
  }
  return {
    col: index - lastNl,
    line,
  };
}

function lineAt(source: string, index: number): string {
  let start = index;
  while (start > 0 && source.charCodeAt(start - 1) !== 10) start--;
  let end = index;
  while (end < source.length && source.charCodeAt(end) !== 10) end++;
  return source.slice(start, end);
}

function prevLine(source: string, index: number): string {
  let start = index;
  while (start > 0 && source.charCodeAt(start - 1) !== 10) start--;
  if (start === 0) return "";
  // start points at the newline preceding the current line; walk back one line.
  const prevEnd = start - 1;
  let prevStart = prevEnd;
  while (prevStart > 0 && source.charCodeAt(prevStart - 1) !== 10) prevStart--;
  return source.slice(prevStart, prevEnd);
}

function hasIgnore(line: string, ruleId: string): boolean {
  // Capture a comma-separated list of kebab-case rule ids. Stops at the first
  // non-id character, so trailing ` -- justification` text is ignored.
  const m = /harness-ignore:\s*([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*)/i.exec(line);
  if (!m) return false;
  return m[1]
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(ruleId);
}

const SKIP_DIR_SEGMENTS = new Set([
  ".next",
  ".turbo",
  "build",
  "dist",
  "node_modules",
]);

function isSkipped(relPath: string): boolean {
  return relPath.split("/").some((seg) => SKIP_DIR_SEGMENTS.has(seg));
}

const SCAN_GLOBS: readonly string[] = [
  "apps/**/*.{ts,tsx,mts,cts,json,css}",
  "packages/**/*.{ts,tsx,mts,cts,json,css}",
  "supabase/**/*.{ts,tsx,mts,cts,json}",
  "harness/**/*.{ts,tsx,mts,cts,json}",
  "package.json",
];

async function collectFiles(): Promise<string[]> {
  const seen = new Set<string>();
  for (const pattern of SCAN_GLOBS) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({
      absolute: false,
      cwd: REPO_ROOT,
    })) {
      if (!isSkipped(file)) seen.add(file);
    }
  }
  return [
    ...seen,
  ].sort();
}

async function scan(): Promise<Finding[]> {
  const files = await collectFiles();
  const findings: Finding[] = [];

  for (const relPath of files) {
    const applicable = RULES.filter((r) => r.applies(relPath));
    if (applicable.length === 0) continue;

    let source: string;
    try {
      source = readFileSync(resolve(REPO_ROOT, relPath), "utf8");
    } catch {
      continue;
    }

    for (const rule of applicable) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null = rule.pattern.exec(source);
      while (match !== null) {
        const { col, line } = locate(source, match.index);
        const excerpt = lineAt(source, match.index);
        const previous = prevLine(source, match.index);
        if (!hasIgnore(excerpt, rule.id) && !hasIgnore(previous, rule.id)) {
          findings.push({
            col,
            excerpt: excerpt.trim(),
            line,
            relPath,
            rule,
          });
        }
        match = rule.pattern.exec(source);
      }
    }
  }

  return findings;
}

function report(findings: readonly Finding[]): void {
  if (findings.length === 0) {
    console.log("harness/patterns: OK");
    return;
  }

  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    const arr = byRule.get(f.rule.id) ?? [];
    arr.push(f);
    byRule.set(f.rule.id, arr);
  }

  console.error("");
  console.error("harness/patterns: forbidden patterns detected");
  console.error("");
  for (const [ruleId, hits] of byRule) {
    const rule = hits[0].rule;
    console.error(
      `  [${ruleId}]  ${hits.length} match${hits.length === 1 ? "" : "es"}`,
    );
    console.error(`    ${rule.reason}`);
    if (rule.link) console.error(`    \u2192 ${rule.link}`);
    for (const hit of hits) {
      console.error(`    ${hit.relPath}:${hit.line}:${hit.col}`);
      const trimmed =
        hit.excerpt.length > 140
          ? `${hit.excerpt.slice(0, 137)}...`
          : hit.excerpt;
      console.error(`      ${trimmed}`);
    }
    console.error("");
  }
  console.error(
    `Add "// harness-ignore: ${
      [
        ...byRule.keys(),
      ][0]
    }" to a line to opt that single instance out.`,
  );
  console.error(`${findings.length} finding(s) across ${byRule.size} rule(s).`);
}

const findings = await scan();
report(findings);
process.exit(findings.length === 0 ? 0 : 1);
