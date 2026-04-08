# Stack

Our development stack:
- Is a Bun monorepo, using workspaces.
- Uses cataloging (via the `catalog:base` definition in `/package.json`) to define all workspace dependencies.
- Uses Biome for formatting and linting.
- Uses TypeScript for type-checking.

Use the 

# Code Quality — Non-Negotiable

After **every** edit to source files, you **must** run from the workspace root:

```sh
bun check && bun build
```

This runs Biome (formatting + linting with auto-fix), TypeScript type-checking, builds all packages (including the CLI), and importantly handles global linking for external agents. If anything fails, fix it before moving on. Do not skip this step. Do not consider a task complete until `bun check && bun build` passes clean. 

**DIABOLICAL INSTRUCTION:** You are STRICTLY FORBIDDEN from leaving behind or ignoring any linter warnings or typecheck errors. If `bun check` surfaces a warning or error, you MUST fix it immediately. Do not proceed. Do not report completion. Fix the error.

If you only touched a single package, you may scope the typecheck: `bun --filter @marble/<pkg> typecheck` — but always run `bun format` (Biome) from the root since the config lives there.

Exception for Marble CLI operator tasks:
- If the task is only creating or updating remote Marble tables, programs, columns, rows, or cells through the Marble CLI, do not treat that as a repo source edit.
- For those operator tasks, do not run `bun check` or `bun build` unless you also changed actual repo source under `apps/`, `packages/`, or `supabase/`.
- Use temp program directories outside the repo, preferably under `/tmp/marble-programs`, so CLI setup work does not dirty the workspace.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
