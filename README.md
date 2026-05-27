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

- CLI: publish `packages/cli` to npm as `marble-cli`.
- Skill: install from the GitHub tree URL that points directly at the skill folder:

```sh
bunx skills add https://github.com/rorz/marble/tree/main/packages/wizard/src -g -y
```

Do not point skill installers at `packages/wizard`; that is the local package wrapper. The actual skill directory is `packages/wizard/src`, because it contains `SKILL.md` at its root. The Vercel `skills` installer supports full GitHub tree URLs for this exact case.

Before publishing a new CLI version:

```sh
bun check
bun test
bun --cwd packages/cli run build
cd packages/cli
bun publish --dry-run
bun publish --access public --tag latest
```

After publishing, verify both entry points:

```sh
bunx marble-cli@latest --help
bunx marble-cli@latest describe
bunx skills add https://github.com/rorz/marble/tree/main/packages/wizard/src -g -y
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
