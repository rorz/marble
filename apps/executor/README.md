# @marble/executor

The Marble executor worker. Runs program code for cells in sandboxed Cloudflare containers, persists `cell.state` + `program_run.output` for every run, and cascades downstream cells whose `runCondition` is satisfied.

## Endpoints

- `POST /run?run_id=<uuid>` — execute one pending `program_run`.
- `POST /runs` body `{ runIds: uuid[] }` — execute a batch of pending runs. Runs targeting the same column share one sandbox process.
- `POST /test?programVersionId=<uuid>&testKey=<string?>` body `{ input: json }` — ad-hoc execution of a program version without persisting cell state. Used by `programVersions.test`.

## Authentication

Two modes are accepted:

1. Forwarded web-app context — `x-marble-auth-key-id`, `x-marble-auth-profile-id`, `x-marble-auth-user-id` headers set by the web app's API forwarder.
2. API key — `Authorization: Bearer mbl_…` (resolved via `@marble/keys` and `store.keys.authenticateToken`).

## Architecture

- Hono app entry in `src/index.ts`.
- Pure execution logic in `src/runner.ts` — input resolution, secret resolution, sandbox boot, output validation, ready-dependent cell discovery.
- Sandbox entry-file templates in `src/constants.ts` — `EXECUTOR_FILE_CONTENT` (single job) and `BATCH_EXECUTOR_FILE_CONTENT` (jobs array).
- Storage via `@marble/store`'s `programRuns` resource. Cells move through `Queued → Running → Success/Failure` states transactionally with the `program_run` row.

## Development

```sh
bun run dev      # wrangler dev --port 3087 --inspector-port 9231
bun run typegen  # regenerate worker-configuration.d.ts (gitignored)
```

`worker-configuration.d.ts` is not tracked in git — `bun run typegen` (wired through Turborepo and root `bun check`) regenerates it.

## Workers context

See [apps/executor/AGENTS.md](./AGENTS.md) for Cloudflare-specific tooling, limits, and error pointers. Always retrieve current docs from `https://developers.cloudflare.com/workers/` before any Workers, Durable Objects, Containers, or Sandbox SDK task.
