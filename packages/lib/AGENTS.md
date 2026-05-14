# Lib Package Rules

`@marble/lib` is the monorepo's primitive vault. It is the **first port of call** for any pure, framework-agnostic helper that more than one consumer might want — or that one consumer would inline in a way another consumer is about to copy. Modular DRY is the project's stance: when you catch yourself reaching for `error instanceof Error ? error.message : String(error)`, `replace(/\/$/, "")`, `.trim() || "Untitled X"`, `JSON.stringify(value, null, 2)`, `[...rows].sort((a, b) => a.name.localeCompare(b.name))`, or `performance.now()` + `Math.round`, **stop and check this package first**.

The current surface is `array`, `assert`, `compare`, `crypto`, `json`, `object`, `result`, `string`, `timing`. Each subpath is a separate `exports` entry — import from `@marble/lib/<sub>` directly, never via a re-export layer in another package.

## Rules

1. **Pure, isomorphic, framework-agnostic.** No React. No Next. No Supabase. No `@marble/*` workspace imports. The only runtime dependency is `nanoid`, and adding another requires explicit user approval — pitch the reuse case first.
2. **One subpath per concept; one `<sub>/index.ts` per subpath.** No new top-level files at the package root. To add a primitive that belongs to an existing concept (e.g. a new array helper), extend `array/index.ts`. To introduce a new concept, create `<sub>/index.ts` AND register it in `package.json` `exports` AND ship a colocated `<sub>/index.test.ts`.
3. **Colocated tests are mandatory.** Every primitive added or changed must have behavioural coverage in the matching `<sub>/index.test.ts`. Bun runs these via the root `bun test`. A primitive without a test is half a primitive.
4. **350 LoC ceiling applies per file.** If `<sub>/index.ts` is closing in, the concept has outgrown a single file — fold to `<sub>/` with named sibling modules and an `index.ts` orchestrator that re-exports the public surface. Do not pollute the package root with siblings.
5. **No speculative exports.** Per the root NEVER-11 rule, exporting a primitive is a promise that something already consumes it. Add the primitive when the first concrete consumer migrates to it, not because it might be useful one day. Delete abandoned exports immediately.
6. **Arrow functions only.** Per the root NEVER-14 rule, everything authored here is `const x = () => {}`. The single exception currently shipped is `assert/index.ts`, which requires the TypeScript `function` form for `asserts` to propagate across modules — it carries the `harness-ignore: enforce-arrow-function` opt-out with the justification baked in. Any new exemption needs the same explicit comment.
7. **Forward-reference rule applies.** Per the root NEVER-15 rule, every value binding must be declared above its first use. Read top-to-bottom; no jumping ahead.
8. **kebab-case filenames; no `helpers.ts` / `utils.ts` / `misc.ts`.** Each subpath is a named noun (`timing`, `result`, `crypto`). Don't introduce generic buckets here — this entire package is already the generic bucket.
9. **Naming, not bucketing.** Primitives should read as verbs or named transforms (`getErrorMessage`, `trimTrailingSlash`, `composeCompare`, `normalizeDisplayLabel`), not `formatString`/`doThing`. The name is the contract — if you can't name the primitive without restating its body, the primitive is wrong.
10. **Same-source `exports`.** This package ships TypeScript source directly via the `"./sub": "./sub/index.ts"` form per the root "Package Manifests" rules. Do not introduce build outputs, conditional `types`/`default` keys, or `./types` subpaths.
11. **`bun check` and `bun test` are non-negotiable.** Per the root MANDATORY FINALE block, every change here must end with both running clean. Lib lives at the bottom of the dependency graph — a broken primitive cascades everywhere.

## When to lift code into here

If two or more consumers in `apps/**` or `packages/**` are about to write the same logic, lift it. If a primitive in `<sub>/index.ts` already covers 90% of what a consumer needs, extend the primitive — do not branch a near-duplicate in the consumer. The cost of a one-line PR adding a parameter is far smaller than the cost of two sites drifting apart over six months.

## When NOT to lift code into here

- Code that depends on a workspace package (`@marble/store`, `@marble/contracts`, `@marble/ui`, etc.) — that belongs in the consuming package or its nearest cohesive home.
- Code that depends on a framework (React hooks, Next route helpers, Supabase clients) — same.
- Domain logic that only makes sense in the context of a specific resource — that belongs in `packages/store/src/resources/entities/<resource>.ts` or the equivalent owning module.
- One-off transforms with a single consumer that aren't obviously primitive — keep them local until a second consumer materialises, then lift.
