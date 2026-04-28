# Stack

Our development stack:
- Is a Bun monorepo, using workspaces -- which all runs through Turborepo.
- Uses cataloging (via the `catalog:base` definition in `/package.json`) to define all workspace dependencies.
- Uses Biome for formatting and linting.
- Uses TypeScript for type-checking.

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

### NEVER
1. Install a package at the root unless you are absolutely sure you know what you're doing.
2. Install a package _without first_ adding it to the catalog (`catalog.base`) in the root package.json
3. Install packages without asking for approval, or install packages that do simple shit you can just write a library file for yourself
4. Report back to me without first running `bun check` and either getting a clean slate or explicitly applying the `bun check` exception above.
5. Create "single-use" scripts, packages, or apps.
6. Create superfluous tooling functionality, such as tests for a module that's only just been created.
7. "Deprecate" code paths, functions, or methods unless you are absolutely sure they are being heavily used or are structurally imperative for the entire system to function. Just delete "legacy" code... that's what Git is for.
8. **EXTREME WARNING**: NEVER, EVER run `bun run dangerously-splat` (or any script that resets/destroys the database) without explicitly and separately asking for permission first.
9. **EXTREME WARNING**: NEVER, EVER use `npx` to run scripts or binaries. You must ONLY use `bun`, `bunx`, or invoke binaries like `supabase` directly.
10. Start a dev server unless the user explicitly asks you to. Nor should you volunteer status updates that a dev server "was not started". Only mention dev-server execution when it is imperatively necessary or explicitly requested.

### ALWAYS
1. Run `bun check` after every checkpoint, and at the very least when you "think" you are ready and done with a task.
2. Use available package scripts. If you see an opportunity to create a new script or package, make sure you always inspect every other package first in order to ensure you are following best practices.
3. Write your best, formatted TypeScript, following functional design patterns where possible.
4. Start with larger files (ideally a single file) first, clearly demarcated and modularized within the file, instead of lots of modular files. This helps your human mentally grapple and contain the changes you are making before deciding how to modularize them.
5. Use the web to research a topic or standard -- even if you think you know it well, such as (but not limited to): database or provider documentation; service best practices; package version numbers.

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

IMPORTANT!! You **must** read [Internal Design Guide](./docs/internal/design-guide.md) before making any UI changes.

1. Before writing any new UI component, search `packages/ui/src` and inspect `apps/web/src/app/internal/ui/page.tsx`.
2. If the thing you are building is not deeply route-specific, you MUST add or extend the primitive in `packages/ui` first and consume it from `@marble/ui`.
3. Do not create reusable UI wrappers in `apps/web/src/components`. Shared layout chrome, cards, notices, badges, empty states, controls, and similar primitives belong in `packages/ui`.
4. If you catch yourself thinking "I'll abstract it later", stop. Abstract it now. Two uses is already enough evidence here.
5. Every new or materially changed shared UI primitive must be represented in `apps/web/src/app/internal/ui/page.tsx` so there is always a living visual catalog.
6. Only keep JSX local to a route when it is obviously domain-specific and would be nonsense anywhere else. If it reads like a component that could have a generic name, it belongs in `packages/ui`.
7. **Marketing surfaces are an exception.** Components for marketing / landing routes (e.g. `apps/web/src/app/homepage/**`) are domain-specific by definition and MUST NOT be placed in `packages/ui`. They belong in a local `ui/` folder within the route (e.g. `apps/web/src/app/homepage/ui/`). `packages/ui` is for the product's design system — marketing primitives carry branding, copy framing, and tonal choices that do not belong there.
8. **EXTREME UI WARNING:** NEVER add explanatory chrome, ornamental meta cards, or redundant labels that merely narrate what the interface already visually communicates. If a panel is obviously a modal, do not add surrounding status boxes that say "Modal". If a grouped control surface is obviously form controls, do not add decorative dashboard copy that restates that fact. Do not label the roof "roof." Do not label the windows "windows." The UI itself should carry meaning through structure, spacing, and hierarchy.
9. When in doubt on product UI, bias aggressively toward subtraction. Fewer containers, fewer captions, fewer badges, fewer callouts, fewer "status" summaries, fewer "helpful" labels. Only add text or chrome when it changes a decision, clarifies an ambiguous interaction, or is a durable part of the product's information architecture.

## Turborepo

This monorepo uses Turborepo for pretty much everything. This means that you must:
- Not only _use_ root package and `turbo *` scripts exclusively, but;
- You **must** ALWAYS update, check, and reflect on any changes that are necessary to the various config files in our repo. Bad things happen when the `turbo.json` files throughout the repository aren't kept in constant symbiosis with the rest of the repo.

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
   If a new resource changes how ownership works, centralize the new ownership and accessibility rules in shared helpers under `packages/api/src/resources/` and update existing resources to use them.
7. Update CLI surfaces.
   Audit both the raw plural resource commands and the ergonomic singular commands in `packages/cli/src/cli.ts`. Remove or replace stale flags and assumptions; do not leave the human-friendly CLI pointing at the old ownership model.
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
- `packages/api/src/resources/*`
- `packages/cli/src/cli.ts`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/lib/supabase/proxy.ts`
- `apps/web/src/app/(web)/*`
- `apps/executor/src/*`

### Explicit Warning
- If you introduce a new resource type and do not audit access checks, nested routes, CLI ergonomics, event surfaces, references, and seeds, you have not finished the task.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


## Database quirks

- Supabase `postgres_changes` realtime listeners must ensure the tables they are set to listen to are established and set up for realtime PUBLICATION in the database schema otherwise they, or any linked `.on()` calls will silently fail!
