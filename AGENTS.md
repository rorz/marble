# Code Quality — Non-Negotiable

After **every** edit to source files, you **must** run from the workspace root:

```sh
pnpm check
```

This runs Biome (formatting + linting with auto-fix) followed by TypeScript type-checking across all packages. If anything fails, fix it before moving on. Do not skip this step. Do not consider a task complete until `pnpm check` passes clean.

If you only touched a single package, you may scope the typecheck: `pnpm --filter @marble/<pkg> typecheck` — but always run `pnpm format` (Biome) from the root since the config lives there.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
