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
> You are STRICTLY FORBIDDEN from leaving behind or ignoring any linter warnings or typecheck errors. If `bun check` surfaces a warning or error, you MUST fix it immediately. Do not proceed or "fake out" on reporting your completion of a task until this is done. Fix the error, always.

### NEVER
1. Install a package at the root unless you are absolutely sure you know what you're doing.
2. Install a package _without first_ adding it to the catalog (`catalog.base`) in the root package.json
3. Install packages without asking for approval, or install packages that do simple shit you can just write a library file for yourself
4. Report back to me without first running `bun check` and it showing a clean slate.
5. Create "single-use" scripts, packages, or apps.
6. Create superfluous tooling functionality, such as tests for a module that's only just been created.
7. "Deprecate" code paths, functions, or methods unless you are absolutely sure they are being heavily used or are structurally imperative for the entire system to function. Just delete "legacy" code... that's what Git is for.

### ALWAYS
1. Run `bun check` after every checkpoint, and at the very least when you "think" you are ready and done with a task.
2. Use available package scripts. If you see an opportunity to create a new script or package, make sure you always inspect every other package first in order to ensure you are following best practices.
3. Write your best, formatted TypeScript, following functional design patterns where possible.
4. Start with larger files (ideally a single file) first, clearly demarcated and modularized within the file, instead of lots of modular files. This helps your human mentally grapple and contain the changes you are making before deciding how to modularize them.
5. Use the web to research a topic or standard -- even if you think you know it well, such as (but not limited to): database or provider documentation; service best practices; package version numbers.

## Turborepo

This monorepo uses Turborepo for pretty much everything. This means that you must:
- Not only _use_ root package and `turbo *` scripts exclusively, but;
- You **must** ALWAYS update, check, and reflect on any changes that are necessary to the various config files in our repo. Bad things happen when the `turbo.json` files throughout the repository aren't kept in constant symbiosis with the rest of the repo.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
