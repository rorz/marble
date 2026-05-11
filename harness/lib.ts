/**
 * harness/lib.ts
 *
 * Shared utilities consumed by the harness scripts. Each script is meant
 * to read as a single coherent check; this module exists only to remove
 * literal duplication that the harness was, ironically, the worst place
 * to allow.
 *
 * Concretely:
 *   - The `parseAlmanac` parser and `NON_RESOURCE_SECTIONS` constant
 *     were copy-pasted between `harness/almanac.ts` and
 *     `harness/handlers.ts`. If the docs add a new non-resource section
 *     header, both files had to learn about it. Bad.
 *   - The `Glob`-walk + skip-dir set was reimplemented across five
 *     scripts with subtly different skip rules.
 *   - `locate` / `locateLine` were defined twice with the same shape.
 *
 * Public surface kept narrow. If a helper has only one caller, it stays
 * private to that caller.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Glob } from "bun";

export const REPO_ROOT: string = resolve(import.meta.dir, "..");

/**
 * Default directory segments to skip when scanning the repo. Excludes
 * generated build output, caches, package mirrors, and Next.js artifacts.
 */
const DEFAULT_SKIP_DIRS: ReadonlySet<string> = new Set([
  ".next",
  ".turbo",
  ".vercel",
  ".wrangler",
  "build",
  "dist",
  "node_modules",
]);

export interface CollectFilesOptions {
  /** Extra dir segments to skip on top of the defaults. */
  readonly skipDirs?: readonly string[];
  /** Replace (rather than extend) the default skip set. */
  readonly skipDirsReplace?: boolean;
}

/**
 * Canonical file walker. Resolves a list of Bun-style glob patterns
 * against the repo root, deduplicates, sorts, and applies skip-segments.
 *
 * Patterns are POSIX-style and relative to repo root, e.g.
 * `"apps/**\/*.{ts,tsx}"`.
 */
export async function collectFiles(
  patterns: readonly string[],
  options: CollectFilesOptions = {},
): Promise<string[]> {
  const skip = new Set<string>(
    options.skipDirsReplace
      ? (options.skipDirs ?? [])
      : [
          ...DEFAULT_SKIP_DIRS,
          ...(options.skipDirs ?? []),
        ],
  );

  const seen = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    for await (const file of glob.scan({
      absolute: false,
      cwd: REPO_ROOT,
    })) {
      if (file.split("/").some((seg) => skip.has(seg))) continue;
      seen.add(file);
    }
  }
  return [
    ...seen,
  ].sort();
}

/**
 * 1-indexed { line, col } for a byte offset in `source`.
 */
export function locate(
  source: string,
  index: number,
): {
  col: number;
  line: number;
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

/**
 * Line-only shorthand. Equivalent to `locate(source, index).line` but
 * shaves a few cycles by skipping the column calculation.
 */
export function locateLine(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source.charCodeAt(i) === 10) line++;
  }
  return line;
}

/**
 * The full line of text containing `index`, with no trailing newline.
 */
export function lineAt(source: string, index: number): string {
  let start = index;
  while (start > 0 && source.charCodeAt(start - 1) !== 10) start--;
  let end = index;
  while (end < source.length && source.charCodeAt(end) !== 10) end++;
  return source.slice(start, end);
}

/**
 * The line immediately above `index` (used to detect a previous-line
 * `// harness-ignore` opt-out). Returns "" if `index` is on line 1.
 */
export function prevLine(source: string, index: number): string {
  let start = index;
  while (start > 0 && source.charCodeAt(start - 1) !== 10) start--;
  if (start === 0) return "";
  const prevEnd = start - 1;
  let prevStart = prevEnd;
  while (prevStart > 0 && source.charCodeAt(prevStart - 1) !== 10) prevStart--;
  return source.slice(prevStart, prevEnd);
}

/**
 * Does the given line contain a `// harness-ignore: <ruleId>` directive
 * that mentions this rule? Accepts comma-separated rule lists; trailing
 * justification prose after the id list is ignored.
 */
export function hasIgnore(line: string, ruleId: string): boolean {
  const m = /harness-ignore:\s*([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*)/i.exec(line);
  if (!m) return false;
  return m[1]
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(ruleId);
}

/**
 * Almanac sections that look like `## name` but are NOT resources. Kept
 * here (single source of truth) so a new non-resource section only needs
 * to be added in one place.
 */
export const NON_RESOURCE_SECTIONS: ReadonlySet<string> = new Set<string>([
  "Review Rule For Agents",
  "Action And RPC Rules",
  "Internal worker runtime",
]);

export interface AlmanacResourceEntry {
  allowed: Set<string>;
  name: string;
}

export interface ParsedAlmanac {
  resources: Map<string, AlmanacResourceEntry>;
  /** Sections that look like resources but have no `Allowed operations:` block. */
  unknownSections: string[];
}

/**
 * Parse the data interface almanac (markdown) into a typed map.
 *
 * Each `## <resource>` section is expected to contain an
 * `Allowed operations:` paragraph followed by a bulleted list of backtick-
 * quoted operation names. Sections in `NON_RESOURCE_SECTIONS` are skipped
 * by design. Sections that look like a resource but have no allow-list
 * are returned via `unknownSections` for the caller to decide what to do.
 */
export function parseAlmanac(source: string): ParsedAlmanac {
  const resources = new Map<string, AlmanacResourceEntry>();
  const unknownSections: string[] = [];

  const headers: Array<{
    bodyStart: number;
    title: string;
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

/**
 * Read the almanac from its canonical path.
 */
export function readAlmanac(): string {
  return readFileSync(
    resolve(REPO_ROOT, "docs/internal/data-interface-definitions.md"),
    "utf8",
  );
}
