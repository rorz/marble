<div align="center">
  <img src="/apps/web/public/logo-big.png" width="200" alt="Marble logo" />

  <h1>Marble</h1>

  <p>
    <strong>Fast, reliable, source-available GTM tooling for 👩‍🍳 humans and 🤖 agents alike.</strong>
  </p>
</div>

> [!WARNING]
> Marble is under heavy development and not ready for _prime time_ just yet. The shape of Marble's underlying API storage layer is very likely to change. By all means, if you want to poke around, ask questions, or contribute, you're very welcome to.

### The Secret Sauce 🥫

Marble is a data grid where **every column is a program**, and every cell is the value that program produces when it runs against a row. Programs are just regular `bun` packages of JavaScript or TypeScript, executed in a sandbox at the edge. The same program can be triggered by a UI, a webhook, or an agent.

Because you use Marble with an agent, writing programs is incredibly flexible and cheap. You can use this to your advantage to craft workflows that cover many disparate, arbitrary, and complex workflows.

Think of Marble as Cursor-meets-Clay or Airtable.

## How it works

Marble's tabular workflow should feel as familiar as action-based spreadsheets. You set up a table for a specific outcome (enrich a list, draft an outbound sequence, summarize a stack of sales calls), and each column is a step in that workflow.

Each column points at a versioned program. The program's `marbleconfig.jsonc` defines the input schema and output schema. When a cell needs a value, the executor spins up a Cloudflare Workers Sandbox, runs the program with the row's resolved inputs, validates the output, and writes the result back. Columns can reference other columns, which is how a workflow gets wired together. Realtime updates and inbound source events flow through Supabase.

Everything that can change a cell's value goes through this same pipe, including plain user input. There is no second-class "automation" layer bolted on the side.

## What's in the repo

A Bun + Turborepo monorepo.

| Path | What it is |
|---|---|
| `apps/web` | The Next.js app: grid, program editor, auth, and the REST + RPC surface. |
| `apps/executor` | A Cloudflare Worker that runs each cell's program in a Workers Sandbox. |
| `apps/ingestor` | A Cloudflare Worker that accepts inbound events from external sources. |
| `packages/contracts` | The single source of truth for every resource and operation. |
| `packages/api` | The oRPC + OpenAPI implementation of those contracts. |
| `packages/sdk` | The TypeScript SDK (`@marble/sdk`). |
| `packages/cli` | The `marble` CLI, auto-generated from the contract. |
| `packages/wizard` | The Marble Wizard agent skill. The installable skill root is `packages/wizard/src`. |
| `packages/store` | Typed Supabase access for every resource. |
| `packages/ui` | The shared React design system. |
| `packages/lib`, `packages/keys` | Small internal helpers. |
| `supabase/` | Postgres schema, auth config, and the seed generator. |

## Publishing the CLI and skill

The CLI and the agent skill ship through different channels:

- **CLI** → [npm](https://www.npmjs.com/package/marble-cli), as `marble-cli`.
- **Skill** → the [open agent skills ecosystem](https://skills.sh). It installs straight from this repo, so **pushing `packages/wizard/src` to `main` _is_ the publish** — there is no separate registry or version number.

### Publish the CLI

You must be logged in to npm first (`npm whoami` should print your username; otherwise run `npm login`).

```sh
bun check                            # catalogue sync, types, lint, build
bun test                             # behavioural finale
cd packages/cli && bun run publish   # build → patch bump → publish
```

`bun run publish` rebuilds `dist/cli.js`, bumps the patch version in `packages/cli/package.json` with `--no-git-tag-version` (so it never creates a tag and never needs a clean working tree), then publishes. Commit the bumped `package.json` with your next commit.

Verify the published bundle:

```sh
bunx marble-cli@latest --help
bunx marble-cli@latest describe
```

### Publish the skill

The skill directory is `packages/wizard/src` — its `SKILL.md` sits at that folder's root, which is what the `skills` CLI discovers. Point installers there, **not** at `packages/wizard` (the local package wrapper).

The operation catalogue inside `SKILL.md` is generated from the contract, so re-sync it, prove it's clean, then push:

```sh
bun run --filter @marble/wizard sync:skill   # regenerate the catalogue from marbleCliContract
bun check                                     # the wizard-skill harness fails the build on drift
git add -A && git commit -m "wizard: <what changed>" && git push
```

Once it's on `main`, anyone installs or updates it globally for every detected agent (OpenCode, Claude Code, Codex, Cursor, …):

```sh
# first install
bunx skills add https://github.com/rorz/marble/tree/main/packages/wizard/src -g -y

# refresh after a later push
bunx skills update marble-wizard -g -y
```

To install the **working copy** while developing (syncs the catalogue, then installs the local folder to every detected agent):

```sh
bun run --filter @marble/wizard install:local
```

## Running it locally

There is no clean one-command quickstart, yet. The moving parts that need to be wired together are: a local or hosted Supabase, the executor and ingestor Workers (via `wrangler dev` or deployed), and the Next.js app pointed at both. A real self-host guide will land alongside the first usable release.

Day-to-day inside the repo:

```sh
bun install
bun dev      # everything via Turborepo
bun check    # format, lint, typecheck, build
```

## Contributing

Contributions are welcome under the terms in [`CLA.md`](./CLA.md). The repo is Elastic License 2.0 today and the intention is to re-license is as MIT later, so any contribution needs to be compatible with both. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the short version.

## License

[Elastic License 2.0](./LICENSE).
