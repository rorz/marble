#!/usr/bin/env bun

/**
 * harness/showcase.ts
 *
 * Asserts every visual primitive exported from `@marble/ui` is represented
 * in the internal UI catalog at `apps/web/src/app/internal/ui/page.tsx`.
 *
 * The rule lives in design-guide.md as "every new or materially changed
 * shared UI primitive must appear in the showcase." Currently enforced by
 * social convention; this rail makes it mechanical.
 *
 * Heuristic for "visual primitive":
 *   - Named value exports (not `type` exports) from `packages/ui/src/index.ts`
 *   - Whose name starts with `Marble`
 *
 * Non-visual exports (`cx`, `marbleToast`, hooks) are intentionally exempt.
 * They're part of the API surface but have no visual swatch to render.
 *
 * Membership check: a substring search for the export name in the showcase
 * source. An import + JSX use both count. Missing primitives are reported
 * grouped by source file so the design author knows where to look.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..");
const UI_INDEX = "packages/ui/src/index.ts";
const SHOWCASE = "apps/web/src/app/internal/ui/page.tsx";

interface PrimitiveExport {
  name: string;
  sourceModule: string;
}

/**
 * Parse the @marble/ui barrel. Each export block looks like:
 *
 *   export {
 *     MarbleFoo,
 *     type MarbleFooProps,
 *     MarbleFooBar,
 *   } from "./components/foo";
 *
 * Value exports (no leading `type `) whose name starts with `Marble` are
 * primitives. Everything else (type exports, lowercase exports like `cx`,
 * `marbleToast`) is skipped.
 */
function parseUiExports(source: string): PrimitiveExport[] {
  const result: PrimitiveExport[] = [];
  // Match `export { ... } from "./components/<file>";` blocks.
  const blockRegex =
    /export\s*\{([\s\S]*?)\}\s*from\s*"\.\/components\/([^"]+)"/g;
  let block: RegExpExecArray | null = blockRegex.exec(source);
  while (block !== null) {
    const body = block[1];
    const sourceModule = block[2];
    for (const raw of body.split(",")) {
      const item = raw.trim();
      if (!item) continue;
      if (item.startsWith("type ")) continue;
      // Strip optional aliasing: `Foo as Bar` → use the public name `Bar`.
      const name = (item.split(/\s+as\s+/).at(-1) ?? item).trim();
      if (!name.startsWith("Marble")) continue;
      result.push({
        name,
        sourceModule,
      });
    }
    block = blockRegex.exec(source);
  }
  return result;
}

const uiSource = readFileSync(resolve(REPO_ROOT, UI_INDEX), "utf8");
const showcaseSource = readFileSync(resolve(REPO_ROOT, SHOWCASE), "utf8");

const primitives = parseUiExports(uiSource);
const seen = new Set<string>();
const missing: PrimitiveExport[] = [];

for (const primitive of primitives) {
  if (seen.has(primitive.name)) continue;
  seen.add(primitive.name);
  // Membership check: simple substring. The showcase imports the primitive
  // (matches in the import block) AND/OR uses it as JSX (matches `<Foo`).
  // Either is enough to count as represented.
  if (!showcaseSource.includes(primitive.name)) {
    missing.push(primitive);
  }
}

if (missing.length === 0) {
  console.log(
    `harness/showcase: OK (${primitives.length} primitives represented)`,
  );
  process.exit(0);
}

console.error("");
console.error(
  "harness/showcase: missing primitives in the internal UI catalog",
);
console.error("");

const byModule = new Map<string, PrimitiveExport[]>();
for (const p of missing) {
  const arr = byModule.get(p.sourceModule) ?? [];
  arr.push(p);
  byModule.set(p.sourceModule, arr);
}
for (const [module, items] of byModule) {
  console.error(`  packages/ui/src/components/${module}.tsx`);
  for (const item of items) {
    console.error(`    - ${item.name}`);
  }
}
console.error("");
console.error(
  `Add a DemoPanel for each missing primitive to ${SHOWCASE} (design-guide rule: every primitive must appear in the showcase).`,
);
console.error(
  `${missing.length} primitive(s) missing across ${byModule.size} module(s).`,
);
process.exit(1);
