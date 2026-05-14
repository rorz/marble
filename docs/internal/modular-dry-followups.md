# Modular DRY Follow-Ups

A focused backlog of opportunities to migrate inline cocktails to `@marble/lib` primitives, plus the naming-rule violations spotted during the first lib-adoption sweep.

Anchors:

- Project stance and the lib-first directive: [`AGENTS.md`](../../AGENTS.md) → "Repository Convention Discipline".
- Lib package rules and primitive catalog: [`packages/lib/AGENTS.md`](../../packages/lib/AGENTS.md).

Each pass below is sized to be a single, mechanical commit. If you take one, take all of its sites — partial migrations grow the surface area to keep track of, not shrink it.

## Status

| Pass | Sites | Status |
|---|---|---|
| 1. `getErrorMessage` adoption | 22+ | Pending |
| 2. `stringifyPretty` adoption | 13 | Pending |
| 3. `api-route-forwarding` timing fold | 8 inlines + helper | Pending |
| 4. API timing fold | 6 sites (2 files) | Pending |
| 5. Multi-criteria sorts → `composeCompare` | 1 strong + scan | Pending |
| 6. Drop `realtime-crud` re-export indirection | 1 file + N consumers | Pending |
| 7. Rename `packages/contracts/src/helpers.ts` | 1 file | Pending |
| 8. Rename `apps/web/src/app/(gui)/profiles/shared.ts` | 1 file | Pending |

The first sweep (the one this doc was filed from) completed: 9 sites migrated, both `bun check` and `bun test` green.

---

## Pass 1 — `getErrorMessage` adoption

**Primitive**: `getErrorMessage` from [`@marble/lib/result`](../../packages/lib/result/index.ts).

**Cocktail to replace** (22+ sites):

```ts
error instanceof Error ? error.message : String(error)
// or with a custom fallback:
error instanceof Error ? error.message : "Payload schema must be JSON."
```

**Recipe**:

```ts
import { getErrorMessage } from "@marble/lib/result";

// default fallback ("Request failed.")
getErrorMessage(error)

// explicit fallback
getErrorMessage(error, "Payload schema must be JSON.")
```

**Hot zones**:

- [`apps/web/src/app/(gui)/programs/view/index.tsx`](../../apps/web/src/app/%28gui%29/programs/view/index.tsx) — lines 685, 924, 979, 1250, 1532, 1587, 1608 (7 sites)
- [`apps/web/src/app/(gui)/projects/[id]/sources/view/index.tsx`](../../apps/web/src/app/%28gui%29/projects/%5Bid%5D/sources/view/index.tsx) — lines 581, 616, 640, 681, 738, 776 (6 sites)
- [`apps/web/src/app/(gui)/secrets/view/index.tsx`](../../apps/web/src/app/%28gui%29/secrets/view/index.tsx) — lines 159, 197

**Outlying sites**:

- [`apps/executor/src/index.ts`](../../apps/executor/src/index.ts) — lines 153, 183, 210
- [`apps/ingestor/src/producer.ts`](../../apps/ingestor/src/producer.ts) — line 66
- [`apps/web/src/app/(gui)/programs/view/manifest.ts`](../../apps/web/src/app/%28gui%29/programs/view/manifest.ts) — line 23
- [`apps/web/src/app/(gui)/programs/view/secret-config.ts`](../../apps/web/src/app/%28gui%29/programs/view/secret-config.ts) — line 66
- [`packages/api/src/index.ts`](../../packages/api/src/index.ts) — line 50
- [`apps/web/src/app/(gui)/projects/[id]/sources/view/validators.ts`](../../apps/web/src/app/%28gui%29/projects/%5Bid%5D/sources/view/validators.ts) — line 23 (uses `"Payload schema must be JSON."` fallback — feeds straight into `getErrorMessage(error, fallback)`)

**Risk**: very low. Behavior preserved for `Error` and string cases; lib also handles `{ message }` objects, which is a strict improvement.

---

## Pass 2 — `stringifyPretty` adoption

**Primitive**: `stringifyPretty` from [`@marble/lib/json`](../../packages/lib/json/index.ts).

**Cocktail to replace** (13 sites):

```ts
JSON.stringify(value, null, 2)
```

**Recipe**:

```ts
import { stringifyPretty } from "@marble/lib/json";

stringifyPretty(value)
```

**Sites**:

- [`packages/ui/src/components/json-preview.tsx`](../../packages/ui/src/components/json-preview.tsx) — line 62 (the `MarbleJsonPreview` primitive itself — highest leverage, do this one)
- [`apps/web/src/app/(gui)/programs/view/index.tsx`](../../apps/web/src/app/%28gui%29/programs/view/index.tsx) — lines 339, 342, 550, 551, 969, 970, 2971
- [`apps/web/src/app/(gui)/projects/[id]/sources/actions.ts`](../../apps/web/src/app/%28gui%29/projects/%5Bid%5D/sources/actions.ts) — line 83
- [`apps/web/src/app/(gui)/projects/[id]/sources/view/validators.ts`](../../apps/web/src/app/%28gui%29/projects/%5Bid%5D/sources/view/validators.ts) — line 10
- [`apps/web/src/app/testing/db-perf-2/view.tsx`](../../apps/web/src/app/testing/db-perf-2/view.tsx) — line 225
- [`apps/web/src/app/(gui)/projects/[id]/tables/[tableId]/view/sidebar.tsx`](../../apps/web/src/app/%28gui%29/projects/%5Bid%5D/tables/%5BtableId%5D/view/sidebar.tsx) — line 130

**Risk**: zero. Pure mechanical substitution.

---

## Pass 3 — `api-route-forwarding` timing fold

**Primitives**: `measure`, `withTiming`, `formatServerTimingEntry` from [`@marble/lib/timing`](../../packages/lib/timing/index.ts).

**Context**: [`apps/web/src/lib/api-route-forwarding.ts`](../../apps/web/src/lib/api-route-forwarding.ts) already imports `formatServerTimingEntry` (line 67) but still inlines `performance.now()` eight times (lines 61, 67, 84, 117, 146, 161, 167, 231). This is a partial migration — finish it.

**Recipe**:

For one-shot timed regions:

```ts
import { measure } from "@marble/lib/timing";

const { result, durationMs } = await measure(() => doThing());
```

For recording into a shared `Record<string, number>` (Server-Timing header style):

```ts
import { withTiming } from "@marble/lib/timing";

const timings: Record<string, number> = {};
const result = await withTiming(timings, "forward.fetch", () => fetchUpstream());
// timings["forward.fetch"] is now an unrounded float ms
```

**Risk**: low, but read the helper signatures carefully — `measure` rounds, `withTiming` keeps a float, `formatServerTimingEntry` rounds. The current inlines round in some places and not in others; preserve whatever the consuming `Server-Timing` header expects.

---

## Pass 4 — API timing fold

**Primitives**: same as Pass 3.

**Sites**:

- [`packages/api/src/index.ts`](../../packages/api/src/index.ts) — lines 187, 190, 193, 199, 230, 235, 238, 243 (four `performance.now()` cocktails in two handler paths)
- [`packages/api/src/router/entities/source-event.ts`](../../packages/api/src/router/entities/source-event.ts) — lines 10, 15 (`context.recordTiming(name, performance.now() - startedAt)`)

`recordTiming` already implies the rounding policy of the context; check whether it expects a float (use `withTiming`) or a rounded integer (use `measure`).

**Risk**: low.

---

## Pass 5 — Multi-criteria sorts → `composeCompare`

**Primitives**: `composeCompare`, `byString` from [`@marble/lib/compare`](../../packages/lib/compare/index.ts).

**Scope**: there are 20+ `.localeCompare(` callsites across the repo. Most are single-criterion sorts and are fine inline. Don't touch those. The win is the **multi-criteria** ones.

**Strong candidate**:

[`apps/web/src/app/(gui)/change-radar/batches.ts`](../../apps/web/src/app/%28gui%29/change-radar/batches.ts) — line 149:

```ts
// before
list.sort((left, right) =>
  right.total - left.total ||
  left.label.localeCompare(right.label),
);

// after
import { composeCompare, byString } from "@marble/lib/compare";

list.sort(
  composeCompare(
    (left, right) => right.total - left.total,
    byString((entry) => entry.label),
  ),
);
```

If a numeric-descending comparator helper (`byNumberDesc`) is ever added to lib, fold the inline lambda into it. Don't add it speculatively — wait for a second consumer (NEVER-11).

**Broader scan**: ripgrep for `.localeCompare(` and check whether each callsite has a `||` chain. Migrate the chained ones, leave the rest.

**Risk**: low if you preserve the comparator order.

---

## Pass 6 — Drop `realtime-crud` re-export indirection

**File**: [`apps/web/src/lib/realtime-crud.ts`](../../apps/web/src/lib/realtime-crud.ts) — line 15:

```ts
export { getErrorMessage } from "@marble/lib/result";
```

**Action**: delete the re-export. Update every consumer that imports `getErrorMessage` via `@/lib/realtime-crud` to import directly from `@marble/lib/result` instead. Known offender: [`apps/web/src/app/(gui)/gui-shell/index.tsx`](../../apps/web/src/app/%28gui%29/gui-shell/index.tsx) line 70 (last verified).

**Risk**: zero. Pure import-path rewrite. Run `bun check` after to catch any stragglers.

---

## Pass 7 — Rename `packages/contracts/src/helpers.ts`

**File**: [`packages/contracts/src/helpers.ts`](../../packages/contracts/src/helpers.ts) (45 LoC).

**Violation**: double — root NEVER rule "No generic buckets" (`helpers.ts` is forbidden) AND `AGENTS.md` Repository Convention Discipline rule "No dangling contract files".

**Contents**: ORPC contract builders — `defineResourceOperations`, `createORPCOperation`, `assignORPCOperation`, `createORPCResourceContract`. These are an intentional cross-resource primitive, so they may live directly under `packages/contracts/src/` per the "consciously cross-resource primitives" exception — but they cannot live in a file called `helpers.ts`.

**Action**: rename to [`packages/contracts/src/orpc.ts`](../../packages/contracts/src/). Update every import. Verify with `bun check`.

**Risk**: zero. Mechanical rename + import rewrite.

---

## Pass 8 — Rename `apps/web/src/app/(gui)/profiles/shared.ts`

**File**: [`apps/web/src/app/(gui)/profiles/shared.ts`](../../apps/web/src/app/%28gui%29/profiles/shared.ts) (13 LoC).

**Violation**: root NEVER rule "No generic buckets". `shared.ts` is a generic bucket name.

**Contents**: three TypeScript type aliases (`ProfileRecord`, `ProfileKeyRecord`, `ManagedProfileRecord`). These are module-local types — the canonical filename is `types.ts`.

**Action**: rename to [`apps/web/src/app/(gui)/profiles/types.ts`](../../apps/web/src/app/%28gui%29/profiles/). Update every import. Verify with `bun check`.

**Risk**: zero.

---

## Intentional non-migrations

Do **not** migrate these. They look like duplicates but the semantics differ in a load-bearing way.

### Raw `btoa(JSON.stringify(...))`

Sites:

- [`apps/executor/src/runner/sandbox-execution.ts`](../../apps/executor/src/runner/sandbox-execution.ts) — lines 93, 111
- [`packages/api/src/context/actor.ts`](../../packages/api/src/context/actor.ts) — line 124

These use raw base64 (non-URL-safe, retains padding). [`@marble/lib/crypto.toBase64Url`](../../packages/lib/crypto/index.ts) produces URL-safe base64 with stripped padding — that is a different output for the same input. Substituting would silently corrupt whatever consumes these strings.

### Domain-specific `try { JSON.parse }` blocks

The executor parses subprocess stdout/stderr ([`apps/executor/src/runner/index.ts:92-110, 163`](../../apps/executor/src/runner/index.ts)), the harness reads `package.json` ([`harness/catalog.ts:112`](../../harness/catalog.ts)), the seed reader reads files ([`supabase/generate-seed/index.ts:59`](../../supabase/generate-seed/index.ts)), and the source validators ([`projects/[id]/sources/view/validators.ts:18-19`](../../apps/web/src/app/%28gui%29/projects/%5Bid%5D/sources/view/validators.ts)) all wrap `JSON.parse` in bespoke handlers with surrounding domain context. `parseJsonOrUndefined` exists for the simple case — these are not it.

### Perf-bench `performance.now()` inlines

[`apps/web/src/app/testing/db-perf/view.tsx`](../../apps/web/src/app/testing/db-perf/view.tsx) and [`apps/web/src/app/testing/db-perf-2/view.tsx`](../../apps/web/src/app/testing/db-perf-2/view.tsx) intentionally take raw measurements. Folding them into `measure()` would round, which changes what the bench reports.

### Single-criterion `.localeCompare(...)` callbacks

Not worth migrating. The cocktail is short, locally readable, and adding an import to replace `(a, b) => a.name.localeCompare(b.name)` with `byString((entry) => entry.name)` is a wash.

---

## How to run a pass

For any pass above:

1. Make the migration.
2. From the workspace root, run `bun check`. Fix anything it flags before moving on.
3. From the workspace root, run `bun test`. Treat any failure as a blocker per the `[!CAUTION]` block in [`AGENTS.md`](../../AGENTS.md).
4. Strike the row from the Status table above (or move it out of this doc entirely) in the same commit.

When this file's Status table is empty, delete the file.
