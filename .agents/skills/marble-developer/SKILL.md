---
name: marble-developer
description: Build, test, and wire Marble programs and tables through the Marble CLI. Use when Codex needs to create or update Marble programs (table columns), dry-run program code, create Marble tables, columns, or rows, inspect cells, or map column inputs in this repository. Do not use raw SQL or seed fixtures for these tasks.
---

# Marble Developer

Use the Marble CLI. Do not solve Marble account tasks with raw SQL, direct database edits, or ad hoc HTTP requests.

## Operating Rules

- Prefer the local CLI in this repo: `pnpm --filter @marble/cli start -- <command>`.
- Use `npx @marble/cli <command>` only when working outside this repo and the published package is the intended interface.
- Do not add records under `supabase/seed-fixtures` to satisfy a user request.
- Do not assume auth is configured. The CLI reads `.env` from the current working directory, uses `MARBLE_API_URL`, and optionally uses `MARBLE_API_KEY`. If a CLI call fails because of auth or connectivity, inspect the local `.env` or ask the user for the missing values.
- `MARBLE_API_URL` defaults to `http://localhost:3084/api` when unset.
- Use a temporary program directory such as `./temp-marble-programs/<slug>` unless the user wants files kept elsewhere.

## Marble Model

- `table`: workflow container for rows and columns.
- `program`: reusable code unit stored remotely.
- `column`: table step backed by a program plus an `inputTemplate`.
- `row`: record within a table.
- `cell`: execution result for one row-column intersection.

## CLI Commands

- `pnpm --filter @marble/cli start -- programs list`
- `pnpm --filter @marble/cli start -- programs get <programId>`
- `pnpm --filter @marble/cli start -- programs dry-run <dir> '<json-input>'`
- `pnpm --filter @marble/cli start -- programs upsert <dir>`
- `pnpm --filter @marble/cli start -- tables list`
- `pnpm --filter @marble/cli start -- tables get <tableId>`
- `pnpm --filter @marble/cli start -- tables create "<name>"`
- `pnpm --filter @marble/cli start -- columns list <tableId>`
- `pnpm --filter @marble/cli start -- columns add <tableId> "<name>" <programId> '<inputTemplate>' '<outputSchema>'`
- `pnpm --filter @marble/cli start -- rows list <tableId>`
- `pnpm --filter @marble/cli start -- rows add <tableId>`
- `pnpm --filter @marble/cli start -- cells get <cellId>`

## Program Files

Create exactly these files in the program directory.

### `index.js`

Export a default async function. It receives `{ system, cell, input }`.

- `input` is validated against `config.json.inputSchema`.
- `cell.manualInputValue` is the raw manual cell input when manual input is enabled.
- `system.providers.APOLLO_IO.apiKey` contains the Apollo API key available to all runs (if configured).
- Return a value that matches `config.json.outputConfig.schema`.

Example:

```js
export default async function ({ system, cell, input }) {
  if (system?.providers?.APOLLO_IO?.apiKey) {
    // You can use the Apollo API key here
  }

  const text = cell.manualInputValue ?? "";
  return text.split("").reverse().join("");
}
```

### `config.json`

Define the remote program metadata.

Example:

```json
{
  "name": "Reverse String",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "outputConfig": {
    "flags": {
      "allowManualInput": true
    },
    "schema": {
      "type": "string"
    }
  }
}
```

Use `outputConfig.schema` as the source of truth for the program output schema.

## Input Templates

`columns add` stores `inputTemplate` as a JSON string. Use it to map row context into program inputs.

Map another column value:

```json
{
  "someField": {
    "$marble_ref": ["columns", "col_123", "value", "someValue"]
  }
}
```

Map manual cell input:

```json
{
  "someField": {
    "$marble_ref": ["cell", "manualInputValue"]
  }
}
```

Keep `inputTemplate` aligned with `inputSchema`. If the program reads only `cell.manualInputValue`, an empty object template such as `{}` is acceptable.

## Workflow

### Build Or Update A Program

1. Create or reuse a temp directory.
2. Write `index.js` and `config.json`.
3. Dry-run before upserting:

```sh
pnpm --filter @marble/cli start -- programs dry-run ./temp-marble-programs/reverse-string '{"system":{},"cell":{"manualInputValue":"hello"},"input":{}}'
```

4. Fix code or schema mismatches until the dry-run succeeds.
5. Upsert the program and record the returned program ID:

```sh
pnpm --filter @marble/cli start -- programs upsert ./temp-marble-programs/reverse-string
```

### Wire A Program Into A Table

1. Create or identify the target table.
2. Derive the output schema from `config.json.outputConfig.schema`.
3. Build the `inputTemplate` JSON string.
4. Add the column with the program ID, input template, and output schema.
5. Add or inspect rows as needed.
6. Inspect cells if execution output or errors need debugging.

Example:

```sh
pnpm --filter @marble/cli start -- tables create "Reverse Demo"
pnpm --filter @marble/cli start -- columns add tbl_123 "Reverse" prog_123 '{}' '"string"'
pnpm --filter @marble/cli start -- rows add tbl_123
```

## Troubleshooting

- If the CLI cannot reach Marble, check `MARBLE_API_URL` and whether the API is running.
- If requests are unauthorized, check `MARBLE_API_KEY`.
- If `columns add` fails, validate that `inputTemplate` is valid JSON text and `outputSchema` is valid JSON.
- If a program dry-run fails, fix `index.js`, `inputSchema`, or `outputConfig.schema` before upserting.
