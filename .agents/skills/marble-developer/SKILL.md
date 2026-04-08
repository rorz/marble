---
name: marble-developer
description: Create and manage Marble resources for your human. Make programs, tables, columns, rows, and cells through the Marble CLI. Use this skill for any and all operational Marble work.
---

# Marble Developer

Use the Marble CLI for Marble operator work. This skill is for provisioning and wiring remote Marble objects.

### Special notice for developers of the Marble codebase

> [!WARNING]
> Ordinarily, this skill is called from arbitrary directories. If you are running this **_within_ the Marble codebase,** i.e. for development of Marble itself, pay special and extra attention to:
>
> 1. **NOT** modifiying the Marble codebase via this skill _unless_ this is clearly specified as part of the prompt.
> 2. **ONLY** running Marble CLI commands and programs within the context of the development Marble workspace (i.e. in the local Supabase database). For example, create programs using the CLI -- don't create programs within the codebase. Some confusion may arise from the fact that there are program definitions in the Marble codebase -- these are mostly use to seed the development database, and are -- again -- unrelated to the usage of this skill.

## Core Rules

- Prefer the local CLI in this repo: `pnpm --filter @marble/cli start -- <command>`.
- Do not use raw SQL.
- Do not add or edit `supabase/seed-fixtures`.
- Do not edit app or package source just to create a Marble program, table, column, or row.
- Do not run `pnpm check`, `pnpm build`, or other repo-wide validation commands for Marble CLI provisioning unless the user explicitly asked for repo code changes too.
- Keep temporary program files out of the repo. Use `/tmp/marble-programs/<program-name>`.
- After finishing a CLI-only task, leave the repo clean apart from any instruction files the user explicitly asked you to change.

## Auth And Environment

- The CLI reads `.env` from the current working directory.
- `MARBLE_API_URL` defaults to `https://marble.kenobi.tech/api`.
- `MARBLE_API_KEY` is optional, but some environments require it.
- Marble program runs receive provider credentials on `system.providers`.
- Apollo is available at `system.providers.APOLLO_IO.apiKey` when configured.

## Marble Model

- `table`: container for workflow rows and columns.
- `program`: reusable remote JavaScript unit.
- `column`: table step backed by a program and an `inputTemplate`.
- `row`: record in a table.
- `cell`: one row-column execution result.

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

## Program Directory Contract

Create exactly these files in a temp directory such as `/tmp/marble-programs/my-program`.

### `index.js`

- Export a default function or async function.
- Signature: `({ system, cell, input }) => ...`
- `input` is validated by `config.json.inputSchema`.
- `cell.manualInputValue` is the raw manual cell value when manual input is enabled.
- Return a value that matches `config.json.outputConfig.schema`.

Example:

```js
export default async function ({ system, cell, input }) {
  const apiKey = system?.providers?.APOLLO_IO?.apiKey;
  const raw = cell.manualInputValue ?? "";

  if (apiKey && input.mode === "uppercase") {
    return raw.toUpperCase();
  }

  return raw;
}
```

### `config.json`

- Define the remote program metadata here.
- `outputConfig.schema` is the source of truth for the column output schema.

Example:

```json
{
  "name": "Example Program",
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

## Input Template Syntax

Use the current JSONPath-based resolver.

Map another column's value:

```json
{
  "personName.$": "$.columns.col_person.value",
  "companyName.$": "$.columns.col_company.value"
}
```

Inline interpolation:

```json
{
  "prompt": "Find an email for {{$.columns.col_person.value}} at {{$.columns.col_company.value}}"
}
```

Manual-input-only columns can use `{}` and read `cell.manualInputValue` directly.

## Standard Workflow

### Build Or Update A Program

1. Create a temp directory under `/tmp/marble-programs`.
2. Write `index.js` and `config.json`.
3. Dry-run it before upserting.
4. Fix any schema or runtime issue until the dry-run succeeds.
5. Upsert it and record the returned program ID.

Example:

```sh
pnpm --filter @marble/cli start -- programs dry-run /tmp/marble-programs/reverse-string '{"system":{},"cell":{"manualInputValue":"hello"},"input":{}}'
pnpm --filter @marble/cli start -- programs upsert /tmp/marble-programs/reverse-string
```

### Wire A Program Into A Table

1. Create or identify the table.
2. Add manual-input columns first if downstream columns depend on them.
3. List columns to capture their IDs.
4. Build the dependent column `inputTemplate` using those column IDs.
5. Add the dependent column with the program ID and output schema.
6. Add a starter row if the user will immediately populate values.

Example:

```sh
pnpm --filter @marble/cli start -- tables create "Apollo Email Enrichment"
pnpm --filter @marble/cli start -- columns add <tableId> "Person Name" <userInputProgramId> '{"format":"string"}' '{"type":"string"}'
pnpm --filter @marble/cli start -- columns list <tableId>
pnpm --filter @marble/cli start -- columns add <tableId> "Enriched Email" <apolloProgramId> '{"personName.$":"$.columns.<personColumnId>.value","companyName.$":"$.columns.<companyColumnId>.value"}' '{"type":"string"}'
pnpm --filter @marble/cli start -- rows add <tableId>
```

## Apollo Notes

- Use `system.providers.APOLLO_IO.apiKey`.
- Fail clearly if the key is missing.
- Prefer returning a simple value that matches the target column schema.
- If the user asked for one enriched field, return that field directly instead of a large object.
- If the user supplies a company name rather than a domain, the program may translate that into Apollo parameters such as `organization_name`.

## Troubleshooting

- If CLI requests fail, inspect `.env` for `MARBLE_API_URL` and `MARBLE_API_KEY`.
- If `programs dry-run` fails, fix the runtime code or output schema before upserting.
- If `columns add` fails, validate that `inputTemplate` is valid JSON text and `outputSchema` is valid JSON.
- If a dependent column is blank, confirm the `inputTemplate` references the correct column IDs.
- If the repo becomes dirty during CLI-only work, move temp artifacts to `/tmp` and clean up anything you created in the workspace.
