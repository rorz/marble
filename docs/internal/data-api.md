# Data API

This is the thin docs shape for the new data layer.

The contract is the source of truth. Generated OpenAPI docs explain what exists; the data interface almanac explains what is allowed to exist.

## Surfaces

- `GET /api/openapi` serves public generated API reference docs.
- `GET /api/openapi/spec.json` serves the public generated OpenAPI spec.
- `/api/rpc/*` is the typed oRPC transport used by the TypeScript SDK.
- `/api/*` also serves the OpenAPI-compatible HTTP surface from the same contract.

## Project Flow

Contracts live in `packages/contracts`. The API implements those contracts in `packages/api`. The SDK and CLI call the same contract surface instead of redeclaring resource methods.

```ts
import { MarbleClient } from "@marble/sdk";

const marble = new MarbleClient({
  driver: {
    apiKey: process.env.MARBLE_API_KEY,
    apiUrl: "https://app.example.com/api",
    type: "api",
  },
});

const project = await marble.projects.create({
  name: "Post-event contacts",
});

const projects = await marble.projects.list({
  name: "Post-event contacts",
});

const freshProject = await marble.projects.get({
  projectId: project.id,
});

const mostRecentProject = await marble.projects.getMostRecentProject();

await marble.projects.update({
  projectId: freshProject.id,
  values: {
    name: "Enriched contacts",
  },
});
```

```sh
marble projects create '{"name":"Post-event contacts"}'
marble projects list '{"name":"Post-event contacts"}'
marble projects get '{"projectId":"<project-id>"}'
marble projects getMostRecentProject
marble projects update '{"projectId":"<project-id>","values":{"name":"Enriched contacts"}}'
marble projects delete '{"projectId":"<project-id>"}'
```

```sh
curl -H "Authorization: Bearer $MARBLE_API_KEY" \
  "https://app.example.com/api/projects?name=Post-event%20contacts"

curl -X POST "https://app.example.com/api/projects" \
  -H "Authorization: Bearer $MARBLE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Post-event contacts"}'

curl -H "Authorization: Bearer $MARBLE_API_KEY" \
  "https://app.example.com/api/projects/most-recent"
```

The same example action is available through the typed RPC transport as
`marble.projects.getMostRecentProject()`.

The CLI is a pure JSON pass-through to the contract. Resource names and
operation names mirror `marbleContract` exactly. The CLI exposes no extra
verbs, flags, or convenience shorthands — its surface is generated from
`@marble/contracts`. See `marble describe` for the catalogue of every
operation, its HTTP route, and its input/output JSON schema.

## HTTP Naming

Prefer clear, static collection subpaths for named collection reads:

- `GET /projects/most-recent`
- `GET /tables/recently-updated`

Do not add generic namespace buckets such as `/actions` just to avoid a hypothetical collision with an ID route. If the ID is shape-constrained, such as a UUID, a static segment like `most-recent` cannot be mistaken for a valid ID. Route specificity and input validation are the guardrails.

Use camelCase for TypeScript operation names and kebab-case for HTTP path segments. For example, `projects.getMostRecentProject()` maps to `GET /projects/most-recent`.

## Adding Operations

Before adding or exposing a data operation, read `docs/internal/data-interface-definitions.md`.

If the operation belongs, declare it once in `packages/contracts`, implement it in `packages/api`, and let SDK, CLI, REST, RPC, and generated docs follow that shape.

The CLI is auto-generated from `marbleContract`. Once an operation lands in
the contract, it is available as `marble <resource> <operation>` and
`marble describe <resource> <operation>` with no extra wiring. If you find
yourself wanting CLI-specific flags, defaults, or convenience commands,
stop. Either the contract is wrong or the affordance belongs in the SDK.
The one and only exception is the filesystem helper `marble program-dir`,
which composes contract calls around local file reads.
