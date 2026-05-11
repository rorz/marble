# Stack

Our development stack:
- Is a Bun monorepo, using workspaces -- which all runs through Turborepo.
- Uses cataloging (via the `catalog:base` definition in `/package.json`) to define all workspace dependencies.
- Uses Biome for formatting and linting.
- Uses TypeScript for type-checking.
- Uses Vitest for behavioral / integration tests.

> [!IMPORTANT]
>
> After **every** edit to source files, you **must** run from the workspace root:
>
> ```sh
> bun check
> ```

> [!WARNING]
>
> 
> You are STRICTLY FORBIDDEN from leaving behind or ignoring any linter warnings or typecheck errors. If `bun check` surfaces a warning or error, you MUST fix it immediately. Do not proceed or "fake out" on reporting your completion of a task until this is done. The only exception is when you are CERTAIN that your changes could not have possibly caused the `bun check` failure. If you use this exception, you must confirm with the user that you are ignoring the failed check because you have beyond reasonable doubt (threshold == super high) that someone else made those changes.

> [!CAUTION]
>
> # MANDATORY FINALE: `bun test`
>
> **Before reporting any task complete**, you **must** also run from the workspace root:
>
> ```sh
> bun test
> ```
>
> This is the **finale check**. `bun check` validates that the code compiles, formats, lints, and passes the structural harness. `bun test` validates that the code actually *behaves correctly* — it exercises the API surface, store layer, and any other behavioral contract that has a test.
>
> Rules:
>
> 1. Every task ends with `bun test`. There are no exceptions for "I only changed a comment" or "I only touched docs" or "this is trivial." Run it anyway.
> 2. If `bun test` fails, you MUST fix it. Treat a `bun test` failure with the **same** severity as a `bun check` failure. The same exception process (verify-with-the-user-with-extreme-rigor that you didn't cause it) applies and only applies.
> 3. NEVER skip `bun test` because "it's slow" or "Supabase isn't running locally" or "I'd rather let the user catch it." Start Supabase if it isn't running. If the test infrastructure genuinely isn't set up for the area you touched, tell the user explicitly and ask before declaring the task complete.
> 4. `bun test` runs AFTER `bun check`. Order matters — a `bun check` failure is cheaper to fix and shorter to read than a `bun test` failure, so always clear `bun check` first.
> 5. Treat unexplained `bun test` flake the same as a hard failure. If a test fails intermittently, that is a bug in the test or in the code under test — never just "retry it."
> 6. When you add or change a behavior that has a test, your change must include updates to the relevant test. Do not file a PR where production code shifted and the test that exercises it didn't move.

### NEVER
1. Install a package at the root unless you are absolutely sure you know what you're doing.
2. Install a package _without first_ adding it to the catalog (`catalog.base`) in the root package.json
3. Install packages without asking for approval, or install packages that do simple shit you can just write a library file for yourself
4. Report back to me without first running `bun check` AND `bun test` and either getting a clean slate on both, or explicitly applying the exception process above. **A task is not complete until both have passed.**
5. Create "single-use" scripts, packages, or apps.
6. Create superfluous tooling functionality, such as tests for a module that's only just been created.
7. "Deprecate" code paths, functions, or methods unless you are absolutely sure they are being heavily used or are structurally imperative for the entire system to function. Just delete "legacy" code... that's what Git is for.
8. **EXTREME WARNING**: NEVER, EVER run `bun run dangerously-splat` (or any script that resets/destroys the database) without explicitly and separately asking for permission first.
9. **EXTREME WARNING**: NEVER, EVER use `npx` to run scripts or binaries. You must ONLY use `bun`, `bunx`, or invoke binaries like `supabase` directly.
10. Start a dev server unless the user explicitly asks you to. Nor should you volunteer status updates that a dev server "was not started". Only mention dev-server execution when it is imperatively necessary or explicitly requested.
11. Export TypeScript types, interfaces, schema-inferred aliases, or helper aliases unless there is a current concrete consumer or the type is an intentional package/public API surface. Keep module-local types unexported, do not export types speculatively for future use, and delete abandoned exported types immediately.
12. Edit environment files yourself. Never modify `.env`, `.env.local`, `.env.*`, Vercel env files, or other local environment configuration files. If an environment value needs to change, tell the user the exact variable name and value to set, and let the user make the edit.

### ALWAYS
1. Run `bun check` after every checkpoint, and at the very least when you "think" you are ready and done with a task. Then run `bun test` as the mandatory finale — see the **MANDATORY FINALE** block above. Do not report completion until both are green.
2. Use available package scripts. If you see an opportunity to create a new script or package, make sure you always inspect every other package first in order to ensure you are following best practices.
3. Write your best, formatted TypeScript, following functional design patterns where possible.
4. Start with larger files (ideally a single file) first, clearly demarcated and modularized within the file, instead of lots of modular files. This helps your human mentally grapple and contain the changes you are making before deciding how to modularize them.
5. Use the web to research a topic or standard -- even if you think you know it well, such as (but not limited to): database or provider documentation; service best practices; package version numbers.

## Repository Convention Discipline

Before creating a new file, folder, module boundary, or architectural name, inspect the target package's existing shape first. Do not invent structure from generic taste.

1. Run a shallow structure check such as `find <package>/src -maxdepth 2 -type f | sort` before adding files to a package you are changing materially.
2. Do not create a new folder unless the same folder convention already exists in that package, the user explicitly asked for it, or you can point to a project document that requires it for this exact change.
3. Prefer established homes:
   - Generic utilities belong in `packages/lib`.
   - Store/domain persistence belongs in `packages/store/src/resources`.
   - API handlers belong in `packages/api/src/router`.
   - Package-private API resource implementations that make routers too large belong in `packages/api/src/<resource>/actions.ts`, with `packages/api/src/<resource>/index.ts` as the import boundary.
   - Public contracts belong in `packages/contracts/src/resources/entities`.
   - GUI route boundaries belong in `apps/web/**/actions.ts`.
4. Do not create vague buckets named `helpers`, `utils`, `resources`, `loader`, or similar unless the package already uses that exact bucket for the same kind of code.
5. **No dangling contract files.** In `packages/contracts`, do not add root-level sibling modules for a domain concept just because it is shared. Put resource-owned schemas, parsers, manifest helpers, runtime contracts, and resolver helpers in the owning `packages/contracts/src/resources/entities/<resource>.ts` file. Only root `index.ts`, existing package plumbing, and consciously cross-resource primitives may live directly under `packages/contracts/src`; anything else needs an explicit written justification before it is created.
6. If a change creates any new file or folder, explicitly report why that location matches existing convention.

## Package Manifests

1. Keep dependency maps alphabetized. Biome's package JSON sorting is useful for `dependencies`, `devDependencies`, catalog entries, and similar unordered maps.
2. For private workspace packages whose runtime and type entrypoint are the same TypeScript source file, prefer a direct string export:
   ```json
   {
     "exports": {
       ".": "./src/index.ts"
     }
   }
   ```
3. Do not represent that same-source pattern as a conditional export object with `types` and `default`. Conditional export key order is semantic, while Biome sorts JSON object keys alphabetically.
4. Do not add a `./types` subpath as a workaround for typing the root entrypoint. A `./types` export is only appropriate when it is an intentional public subpath, not a fake declaration channel for `"."`.

## Database Workflow

IMPORTANT!! You **must** read [Internal Database Guide](./docs/internal/database-guide.md) before making any database schema, migration, or seed changes.

### Database Rules

1. `supabase/migrations` is expected to converge back to a **single** committed schema file named `supabase/migrations/<timestamp>_squashed_schema.sql`. Do not leave behind a pile of incremental migration files.
2. `supabase migration squash` is not sufficient by itself. The Supabase CLI rewrites the newest migration file by default, keeping whatever stale suffix it already had. You must rename the squashed result to `*_squashed_schema.sql` before you are done.
3. Any change to schema SQL is also a seed compatibility change until proven otherwise. You must audit `supabase/generate-seed.ts` and regenerate `supabase/seed.sql` every time `supabase/migrations/*.sql` changes.
4. Keep schema in the squashed migration and keep development data in `supabase/seed.sql`. Do not work around the single-file migration policy by introducing extra checked-in SQL files for routine schema evolution.
5. Seed SQL should stay data-only and should not rely on incidental `search_path` behavior. Prefer explicit `public.` qualification for application tables.

## Shared UI Discipline

> [!DANGER]
>
> For web UI work, `packages/ui` is the first stop. Do not casually create bespoke components in `apps/web` because it is "faster" or "only for this page". That is how a second design system starts.

### UI Rules

IMPORTANT!! You **must** read [Internal Design Guide](./docs/internal/design-guide.md) before making any UI changes. The "Marble UI System" section in that guide is the authoritative catalog of every primitive, design token, icon policy, and forbidden anti-pattern. Treat it as the contract.

1. Before writing any new UI component, search `packages/ui/src`, inspect `apps/web/src/app/internal/ui/page.tsx`, AND scan the "Marble UI System / Primitive Catalog" section of the design guide. If a primitive matches your pattern, you use it.
2. If the thing you are building is not deeply route-specific, you MUST add or extend the primitive in `packages/ui` first and consume it from `@marble/ui`.
3. Do not create reusable UI wrappers in `apps/web/src/components`. Shared layout chrome, cards, notices, badges, empty states, controls, and similar primitives belong in `packages/ui`.
4. If you catch yourself thinking "I'll abstract it later", stop. Abstract it now. Two uses is already enough evidence here.
5. Every new or materially changed shared UI primitive must be represented in `apps/web/src/app/internal/ui/page.tsx` so there is always a living visual catalog.
6. Only keep JSX local to a route when it is obviously domain-specific and would be nonsense anywhere else. If it reads like a component that could have a generic name, it belongs in `packages/ui`.
7. **Marketing surfaces are an exception.** Components for marketing / landing routes (e.g. `apps/web/src/app/homepage/**`) are domain-specific by definition and MUST NOT be placed in `packages/ui`. They belong in a local `ui/` folder within the route (e.g. `apps/web/src/app/homepage/ui/`). `packages/ui` is for the product's design system — marketing primitives carry branding, copy framing, and tonal choices that do not belong there.
8. **EXTREME UI WARNING:** NEVER add explanatory chrome, ornamental meta cards, or redundant labels that merely narrate what the interface already visually communicates. If a panel is obviously a modal, do not add surrounding status boxes that say "Modal". If a grouped control surface is obviously form controls, do not add decorative dashboard copy that restates that fact. Do not label the roof "roof." Do not label the windows "windows." The UI itself should carry meaning through structure, spacing, and hierarchy.
9. When in doubt on product UI, bias aggressively toward subtraction. Fewer containers, fewer captions, fewer badges, fewer callouts, fewer "status" summaries, fewer "helpful" labels. Only add text or chrome when it changes a decision, clarifies an ambiguous interaction, or is a durable part of the product's information architecture.
10. **Evolve the primitive, not the per-route override.** When two or more consumers of a `@marble/ui` primitive share the same `className` cocktail (e.g. `MarbleCardFooter` repeatedly receiving `mt-auto justify-end border-t pt-4`), the primitive is wrong. Bake the default in or add a variant. Do not normalize the override pattern by leaving it scattered across route code.
11. **Layout snap defaults belong in the primitive.** Footers snap to the bottom and right-align their actions. Cards compose children as flex columns. Pane narrow mode reserves headline breathing room. If you find yourself reaching for `mt-auto`, `justify-end`, `flex flex-col`, or other compositional flex-fixers on a primitive's slot, the primitive owes you that default — implement it there, not in the consumer.
12. **No "almost-X" lookalikes.** Do not assemble `border + bg + rounded` shapes in route code that mimic an existing primitive's surface. If `MarbleCard`, `MarblePane`, `MarbleListRow`, `MarbleAlert`, or another primitive exists, use it. Extend primitives that cannot bend to your need; never duplicate their visual language inline.
13. **Tokens, not literals.** Use the project's color tokens (`taupe-*`, `zinc-*`, `orange-*`, `red-*`, `emerald-*`, `amber-*`, `sky-*`, `cyan-*`, `violet-*`), the Tailwind 4px spacing ramp, the established radii (`rounded-xs`, `rounded-sm`), and the project's named utilities:
    - **Typography:** `text-eyebrow-xs` (10px / 0.18em), `text-eyebrow` (11px / 0.22em), `text-eyebrow-lg` (11px / 0.24em). No more `text-[Xpx] tracking-[X.XXem] uppercase` cocktails.
    - **Inset highlights:** compose Tailwind directly — `inset-shadow-2xs inset-shadow-white/{70|90|45}`. No bespoke `shadow-marble-highlight*` tokens. No `shadow-[inset_0_1px_0_rgba(255,255,255,0.X)]` literals.
    - **Accent stripes:** `shadow-marble-stripe-left`, `shadow-marble-stripe-top`. No more `shadow-[inset_Xpx_X_X_X_#f97316]` literals.
    - **Surfaces:** `bg-workbench-surface`. No more `bg-[linear-gradient(...,#hex,...)]` arbitrary gradients in route code.
    Hex literals, arbitrary `[123px]` values, and bespoke opacities for chrome do not belong in route code. If a token is missing, **extend the token system in `apps/web/src/app/globals.css`** rather than synthesize one inline. Raw hex literals are acceptable only in third-party theme escape hatches (e.g. `themeQuartz.withParams(...)`) with named constants that map to the equivalent Tailwind token — see `GRID_THEME_COLORS` in `apps/web/src/app/(gui)/tables/[id]/view.tsx` for the canonical pattern.
14. **Match the rhythm of neighbors.** Padding, type scale, gap utilities, and border radii must match adjacent components unless the contrast is intentional. A `p-4` card next to a `p-5` card looks like a mistake. A `gap-3` row next to a `gap-2` row is conflict, not contrast.
15. **Catalog behavior, not just chrome.** When a primitive's default *layout behavior* changes (snap-to-bottom, right-aligned actions, breathing-room rhythms, fill-vs-natural sizing), the showcase entry in `apps/web/src/app/internal/ui/page.tsx` must present a real situation that proves the behavior — e.g. a tall card so the snap-to-bottom footer is observable. A compact static example is not enough.

### Forbidden Patterns

These patterns were swept out of the codebase and must not be reintroduced. Every entry below has a primitive replacement that already ships. The full pattern-to-primitive map lives in [Internal Design Guide](./docs/internal/design-guide.md#pattern--primitive-map).

16. **`window.confirm` / `window.alert` / `window.prompt` are forbidden.** Use `MarbleConfirmModal` with a state-driven `MarbleConfirmModalState`. Browser-native confirms are a UX and accessibility regression.
17. **Hand-rolled label + control combos are forbidden.** `<div className="space-y-1.5"><MarbleFieldLabel>X</MarbleFieldLabel><MarbleInput/></div>` is `<MarbleField label="X"><MarbleInput/></MarbleField>`. `MarbleFieldLabel` is reserved for section headers and non-input groups.
18. **Hand-rolled JSON pretty-printers are forbidden.** Any `tokenizeJson` helper or `<pre>{JSON.stringify(...)}</pre>` cocktail is `<MarbleJsonPreview value={...} />`. The primitive owns the tokenizer, border, scroll, font, and tone variants.
19. **Hand-rolled selectable / toggleable tile grids are forbidden.** Icon pickers, library docks, segmented chip controls, and aria-pressed tile buttons are `<MarbleSelectableTile shape="square" | "wide" | "card" active={...}>`.
20. **Hand-rolled labeled value tiles are forbidden.** `<div className="rounded-xs border bg-... px-3 py-2"><label/><value/></div>` is `<MarbleStat framed label value tone />`.
21. **Hand-rolled modal / sheet close buttons are forbidden.** `<button>×</button>`, `<button><svg .../></button>`, and similar cocktails are `<MarbleModalClose />` or `<MarbleSheetClose variant="icon" | "button">`. The unicode `×` glyph is never the answer.
22. **Per-route `border-b` overrides on `MarbleCardHeader` are forbidden.** Use `<MarbleCardHeader divided>`. If you find yourself needing custom divider padding, override via className — but the border-bottom belongs in the primitive.
23. **Per-route bordered icon wrappers in list rows and empty states are forbidden.** `<MarbleListRow icon={<div className="flex size-9 border ...">{icon}</div>}>` is `<MarbleListRow icon={icon} iconTone="neutral" | "orange">`. Same for `<MarbleEmptyState icon iconTone>`.
24. **`<MarbleButton><span className="inline-flex items-center gap-X"><Icon/>label</span></MarbleButton>` is forbidden.** Use `iconLeft={Icon}` / `iconRight={Icon}`. The primitive sizes the icon to match the button size and applies the standard gap.
25. **Hand-rolled trigger-anchored dropdowns are forbidden.** Any `useState(isOpen)` + manual portal + click-outside dropdown that anchors to a trigger button is `<MarbleContextPopover sections={[...]} | items={[...]}>`. Cursor-positioned context menus (e.g. AG Grid cells) may keep their controlled-position logic but **must** reuse the same chrome: `min-w-36 rounded-xs border border-zinc-200 bg-white p-1 shadow-lg shadow-zinc-950/10` with `role="menu"` and the standard item hover treatment.
26. **Hand-rolled `<pre>{token}</pre>` + Copy button cocktails are forbidden.** Use `<MarbleCopyField label value />`.
27. **Hand-rolled embedded command surfaces are forbidden.** When a `MarbleCommandMenu` lives flush inside a host card, use `embedded`. Do not wrap with `<div className="h-X border-y ...">` + `className="rounded-none border-0"` on the menu.
28. **`@heroicons/react` is forbidden.** Phosphor only — `@phosphor-icons/react`, `@phosphor-icons/react/ssr`, or `@phosphor-icons/react/dist/ssr`. Size icons with `size={N}` (px). Apply color with `className="text-color-class"`. `className="h-X w-X"` for icon sizing is forbidden.
29. **Adding `@heroicons/react` (or any second icon library) to the workspace catalog is forbidden.** If you genuinely need an icon that Phosphor lacks, raise it before adding a dependency.

### Keeping the System in Sync

30. **A new primitive or design token requires three same-commit updates:**
    a. The implementation (in `packages/ui/src/...` or `apps/web/src/app/globals.css`).
    b. The showcase at `apps/web/src/app/internal/ui/page.tsx` — every new primitive gets its own demo panel; every new token gets a swatch / text-sample in the `Tokens` section.
    c. The catalog entry in [Internal Design Guide](./docs/internal/design-guide.md) — `Primitive Catalog`, `Design Tokens`, `Pattern → Primitive Map`, or `Anti-Patterns` as appropriate.
    If any of the three is missing, the change is incomplete. The catalog and the showcase are the contract — they may not lag the implementation.
31. **When you migrate a hand-rolled pattern to a primitive, migrate every site in the same change.** Migrating one consumer and leaving five behind guarantees the pattern grows back. If you cannot migrate every site in scope, file an explicit follow-up rather than declaring the work done.

## Turborepo

This monorepo uses Turborepo for pretty much everything. This means that you must:
- Not only _use_ root package and `turbo *` scripts exclusively, but;
- You **must** ALWAYS update, check, and reflect on any changes that are necessary to the various config files in our repo. Bad things happen when the `turbo.json` files throughout the repository aren't kept in constant symbiosis with the rest of the repo.

## Data Interface Governance

IMPORTANT!! You **must** read [Data Interface Definitions](./docs/internal/data-interface-definitions.md) before adding, removing, renaming, or exposing any data operation in `packages/contracts`, `packages/api`, `packages/sdk`, `packages/cli`, or `packages/store`.

### Interface Rules

1. The data interface almanac is the semantic source of truth for allowed public data operations. Absence is intentional. Do not infer generic CRUD just because a table exists.
2. A public API operation, SDK method, CLI command, or store resource method may only exist if that resource and operation are listed in the almanac. Do not maintain separate surface matrices unless a resource explicitly needs an exception.
3. If an operation is not listed, stop. Either do not add it, or update the almanac in the same change with a short rationale explaining why the operation belongs on that resource.
4. Prefer named product actions over generic methods when the behavior has domain meaning. For example, `cells.setManualValue()` is preferable to `cells.update()`.
5. Do not expose child-resource lifecycle methods when lifecycle is owned by a parent action. For example, do not add `cells.create()` or `cells.delete()` unless the almanac explicitly allows it; cell materialization and deletion should normally happen through row, column, or table flows.
6. Any agent changing data interfaces must explicitly report which resource, operation, and surfaces changed, and whether the operation was already present in the almanac.

## Introducing A New Resource Type

If you add or reshape a top-level resource, you are not done when the migration and one route compile. You must audit the entire resource surface before reporting completion.

### Required Checklist
1. Search the repo first.
   Run a repo-wide search for the old ownership model, route segment, resource name, landing page, and any nested-resource assumptions. Do not assume the only affected code is in `packages/api`.
2. Update the database model fully.
   Update the squashed schema migration, fix or replace RLS policies, update indexes, and regenerate any generated database types. Do not leave incremental migration history checked in when you are done.
3. Update seeds and reset flow.
   Update `supabase/generate-seed.ts`, regenerate `supabase/seed.sql`, and treat that regeneration as mandatory after every schema SQL change even if you expect no diff. If the schema changed enough to require a clean local reset, explicitly ask for permission before running `bun run dangerously-splat`.
4. Update resource registries.
   Audit `packages/core/src/api-resources.ts`, `packages/api/src/index.ts`, and `packages/api/src/data.ts` so the new resource is actually first-class everywhere IDs, labels, and route mounting are derived.
5. Update API authorization explicitly.
   The web app forwards through the API using a service-role client. That means every mounted resource must perform its own access checks. Do not rely on RLS alone for forwarded web requests. Audit collection and item handlers for list/get/create/update/delete, including nested routes.
6. Update ownership helpers instead of copying logic.
   If a new resource changes how ownership works, centralize the new ownership and accessibility rules in the resource's package-private API module, such as `packages/api/src/<resource>/actions.ts`, and update existing resources to use them.
7. Confirm CLI parity (no edits required by default).
   `packages/cli` auto-generates its entire surface from `marbleContract`. Once the contract changes, the CLI catalogue, help, and `marble describe` output update automatically. You only edit `packages/cli/src` when the change is structural — for example, adding a new top-level filesystem helper or changing JSON input/output plumbing — never to "add a command for the new resource".
8. Update the web app entry points and navigation.
   Audit auth redirects, proxy allowlists, landing pages, top-level navigation, server actions, and any “empty state” or “create first X” flows so the new resource is actually the primary UI concept where intended.
9. Audit references, execution, and eventing.
   If the new resource changes relationships or ownership boundaries, audit dependency loaders, reference pickers, execution/runtime lookup code, event feeds, and realtime refresh paths.
10. Audit helper flows and internal tools.
    Check test pages, setup helpers, scratch-resource creation flows, and any operational scripts or skills that create related resources.
11. Run `bun check` after every edit and finish clean.
    Never batch up broken work. If `bun check` fails, stop and fix the issue immediately.

### Minimum Files To Inspect For Resource Work
- `docs/internal/database-guide.md`
- `supabase/migrations/*`
- `supabase/generate-seed.ts`
- `supabase/seed.sql`
- `supabase/src/types.ts`
- `packages/core/src/api-resources.ts`
- `packages/api/src/index.ts`
- `packages/api/src/data.ts`
- `packages/api/src/router/*`
- `packages/api/src/<resource>/*`
- `packages/cli/src/root.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/lib/supabase/proxy.ts`
- `apps/web/src/app/(web)/*`
- `apps/executor/src/*`

### Explicit Warning
- If you introduce a new resource type and do not audit access checks, nested routes, CLI ergonomics, event surfaces, references, and seeds, you have not finished the task.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide before writing any code. In this Bun workspace, Next is available through the web package at `apps/web/node_modules/next/dist/docs/`; do not assume it is hoisted to root `node_modules/next`. If that path is missing, dependencies are not installed for the web workspace yet, so stop and ask the user to run `bun install`. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


## Database quirks

- Supabase `postgres_changes` realtime listeners must ensure the tables they are set to listen to are established and set up for realtime PUBLICATION in the database schema otherwise they, or any linked `.on()` calls will silently fail!
