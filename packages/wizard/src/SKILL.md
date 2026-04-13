---
name: marble-wizard
description: Create and manage Marble resources for your human. Make programs, tables, columns, rows, cells, and program runs through the Marble CLI. Use this skill for any and all operational Marble work.
---

# Marble Wizard

Use the Marble CLI for Marble operator work. This skill is for provisioning and wiring remote Marble objects, not for editing the Marble codebase itself.

### Special notice for developers of the Marble codebase

> [!WARNING]
> Ordinarily, this skill is called from arbitrary directories. If you are running this **within the Marble codebase,** pay special attention to:
>
> 1. **NOT** modifying the Marble codebase via this skill unless the prompt clearly asks for code changes.
> 2. **ONLY** running Marble CLI commands and programs against the intended Marble environment. Creating a remote program with the CLI is not the same thing as editing seeded program definitions in the repo.

## Auth And Environment

- The CLI reads `.env` from the current working directory.
- `MARBLE_API_URL` defaults to `https://marble.kenobi.tech/api`.
- `MARBLE_API_KEY` is optional, but protected environments may require it.
- Prefer `bunx marble-cli@latest ...` unless `marble` is already installed or linked in the shell.
- Marble program runs receive provider credentials on `system.providers`.

## Marble Model

- `table`: container for workflow rows and columns.
- `program`: reusable remote JavaScript unit.
- `program_version`: immutable snapshot of a program's files and schemas.
- `column`: table step backed by a program version and an `inputTemplate`.
- `row`: record in a table.
- `cell`: one row-column execution state plus optional manual input.
- `program_run`: stored run record targeting a cell.

## Exact CLI Shape

The CLI has two layers:

- Preferred human-facing commands: singular resources with positional args and flags.
- Raw escape hatch commands: plural resource names with JSON payloads.

Prefer the singular commands unless you explicitly need the raw API-shaped interface.

### Human-facing command shape

```sh
bunx marble-cli@latest <singular-resource> <verb> [args...] [flags...]
```

Examples:

```sh
bunx marble-cli@latest table create "Apollo Email Enrichment"
bunx marble-cli@latest column create "Person Name" --table <tableId> --program <programId> --output-schema '{"type":"string"}'
bunx marble-cli@latest row create --table <tableId> --count 3
bunx marble-cli@latest cell set <cellId> "Ada Lovelace"
bunx marble-cli@latest program test /tmp/marble-programs/reverse-string --manual-input "hello" --input '{"mode":"uppercase"}'
```

### Raw command shape

The raw mode is still positional JSON:

```sh
bunx marble-cli@latest <plural-resource> <verb> [args...]
```

Use help at every level:

```sh
bunx marble-cli@latest --help
bunx marble-cli@latest program --help
bunx marble-cli@latest programs --help
bunx marble-cli@latest column create --help
```

Important rules:

- There are no nested `tables <id> columns add` commands in the CLI.
- Prefer singular commands such as `table create`, `column create`, `row create`, `cell set`, and `program test`.
- Use plural resource commands when you need direct raw JSON control.
- `list` takes one optional JSON object of flat scalar query params. It becomes query-string parameters.
- `create` takes one JSON object payload.
- `update` takes `<id>` plus one JSON object payload.
- `delete` takes `<id>`.
- Quote JSON with single quotes so it stays a single shell argument.
- Use camelCase keys in examples. The API also accepts snake_case and kebab-case equivalents, but camelCase is the house style in the code.

## Resource Commands

Human-facing commands:

- `table`: `create`, `list`, `get`, `update`, `delete`
- `column`: `create`, `list`, `get`, `update`, `delete`
- `row`: `create`, `list`, `get`, `update`, `delete`
- `cell`: `list`, `get`, `set`, `update`
- `program`: `list`, `get`, `delete`, `upsert`, `test`

Raw plural commands:

- `profiles`: `list`, `get`, `create`, `update`
- `events`: `list`, `get`
- `tables`: `list`, `get`, `create`, `update`, `delete`
- `columns`: `list`, `get`, `create`, `update`, `delete`
- `column-dependencies`: `list`, `get`
- `rows`: `list`, `get`, `create`, `update`, `delete`
- `cells`: `list`, `get`, `update`
- `programs`: `list`, `get`, `create`, `update`, `delete`, `upsert`, `test`
- `program-versions`: `list`, `get`, `create`, `update`, `delete`
- `program-files`: `list`, `get`, `create`, `update`, `delete`
- `program-runs`: `list`, `get`, `create`, `update`, `delete`

Raw snake-case resources also get camelCase aliases:

- `column-dependencies` or `columnDependencies`
- `program-versions` or `programVersions`
- `program-files` or `programFiles`
- `program-runs` or `programRuns`

## Human-Facing Command Shapes

### Table

```sh
bunx marble-cli@latest table create "Apollo Email Enrichment"
bunx marble-cli@latest table list
bunx marble-cli@latest table get <tableId>
bunx marble-cli@latest table update <tableId> --name "Apollo Email Enrichment v2"
bunx marble-cli@latest table delete <tableId>
```

### Column

```sh
bunx marble-cli@latest column create "Person Name" --table <tableId> --program <programId> --output-schema '{"type":"string"}'
bunx marble-cli@latest column list --table <tableId>
bunx marble-cli@latest column get <columnId>
bunx marble-cli@latest column update <columnId> --name "Full Name"
bunx marble-cli@latest column delete <columnId>
```

### Row

```sh
bunx marble-cli@latest row create --table <tableId>
bunx marble-cli@latest row create --table <tableId> --count 3
bunx marble-cli@latest row list --table <tableId>
bunx marble-cli@latest row update <rowId> --idx 4
bunx marble-cli@latest row delete <rowId>
```

### Cell

```sh
bunx marble-cli@latest cell list --table <tableId>
bunx marble-cli@latest cell get <cellId>
bunx marble-cli@latest cell set <cellId> "Ada Lovelace"
bunx marble-cli@latest cell update <cellId> --clear-manual-input
bunx marble-cli@latest cell update <cellId> --state '{"ok":true,"value":"ada@example.com"}'
```

### Program

```sh
bunx marble-cli@latest program list
bunx marble-cli@latest program get <programId>
bunx marble-cli@latest program upsert /tmp/marble-programs/reverse-string
bunx marble-cli@latest program test /tmp/marble-programs/reverse-string --manual-input "hello" --input '{"mode":"uppercase"}'
bunx marble-cli@latest program delete <programId>
```

## Raw CRUD Command Shapes

### List

```sh
bunx marble-cli@latest tables list
bunx marble-cli@latest columns list '{"tableId":"<tableId>"}'
bunx marble-cli@latest cells list '{"rowId":"<rowId>"}'
bunx marble-cli@latest program-versions list '{"programId":"<programId>"}'
```

Use flat scalar filters only. Good:

```json
{"tableId":"<uuid>","programVersionId":"<uuid>"}
```

Do not pass nested objects or arrays to `list`. The CLI serializes filters into query params.

### Get

```sh
bunx marble-cli@latest tables get <tableId>
bunx marble-cli@latest columns get <columnId>
```

### Create

```sh
bunx marble-cli@latest tables create '{"name":"Apollo Email Enrichment"}'
bunx marble-cli@latest rows create '{"tableId":"<tableId>","count":3}'
```

### Update

```sh
bunx marble-cli@latest tables update <tableId> '{"name":"Apollo Email Enrichment v2"}'
bunx marble-cli@latest cells update <cellId> '{"manualInput":"Ada Lovelace"}'
```

### Delete

```sh
bunx marble-cli@latest rows delete <rowId>
bunx marble-cli@latest programs delete <programId>
```

## Payload Shapes That Matter

Use these exact shapes when wiring workflows, especially when falling back to raw plural commands:

### Table payload

```json
{
  "name": "Apollo Email Enrichment",
  "ownerProfileId": "<optional-profile-id>"
}
```

### Column payload

```json
{
  "tableId": "<table-id>",
  "name": "Enriched Email",
  "programId": "<program-id>",
  "programVersionId": "<optional-version-id>",
  "inputTemplate": "{\"personName.$\":\"$.columns.<personColumnId>.value\"}",
  "outputSchema": {
    "type": "string"
  }
}
```

Critical details:

- Pass **either** `programId` or `programVersionId`. `programId` resolves to the latest version. `programVersionId` pins a specific version.
- `inputTemplate` is a **string containing JSON**, not a nested object.
- `outputSchema` is actual JSON, not a string.
- If `inputTemplate` is omitted, it defaults to `"{}"`.
- If `outputSchema` is omitted, Marble copies the base schema from the resolved program version.
- `idx` is optional. Omit it to append the column at the end. Only send it when you need a specific position.

### Row payload

```json
{
  "tableId": "<table-id>",
  "count": 1
}
```

If `count > 1`, do not send `idx`. For a single row, omit `idx` unless you need to place it at a specific index.

### Cell update payload

```json
{
  "manualInput": "Ada Lovelace"
}
```

Or:

```json
{
  "state": {
    "ok": true,
    "value": "ada@example.com"
  }
}
```

### Program run payload

```json
{
  "targetCellId": "<cell-id>",
  "programId": "<program-id>",
  "programVersionId": "<optional-version-id>",
  "input": {
    "example": true
  },
  "output": {
    "ok": true,
    "value": "example"
  }
}
```

### Program file payload

```json
{
  "versionId": "<program-version-id>",
  "filename": "README.md",
  "filetype": "Markdown",
  "content": "# Notes"
}
```

## Program Directory Contract

`programs upsert` and `programs test` expect a local directory. These files are required:

- `main.ts`
- `package.json`
- `input-schema.json`
- `output-config.json`

All non-dot files in the directory are uploaded. Filetype inference is:

- `.json` -> `Json`
- `.md` -> `Markdown`
- everything else -> `TypeScript`

### `main.ts`

- Export a default function or async function.
- Signature: `({ system, cell, input }) => ...`
- `cell.manualInputValue` is the raw manual cell value when manual input is enabled.
- Return a value that matches `output-config.json.schema`.

Example:

```ts
export default async function ({ system, cell, input }) {
  const apiKey = system?.providers?.APOLLO_IO?.apiKey;
  const raw = cell.manualInputValue ?? "";

  if (apiKey && input.mode === "uppercase") {
    return raw.toUpperCase();
  }

  return raw;
}
```

### `package.json`

- `package.json.name` is the program identity used by `programs upsert`.
- If a program with the same name already exists, `upsert` creates a new version on that program.
- If the name is new, `upsert` creates a new program plus its initial version.

Example:

```json
{
  "name": "Example Program"
}
```

### `input-schema.json`

- This must be a JSON object compatible with Marble's current JSON-schema subset.
- `{}` is allowed for programs that only read `cell.manualInputValue`.

Example:

```json
{
  "type": "object",
  "properties": {
    "mode": {
      "type": "string"
    }
  }
}
```

### `output-config.json`

- This must match the current `ProgramOutputConfig` shape.
- `schema` is required.
- `flags.allowManualInput` and `flags.allowInference` are optional.
- `overloads` is optional.

Example:

```json
{
  "flags": {
    "allowManualInput": true
  },
  "schema": {
    "type": "string"
  }
}
```

## Programs Upsert And Test

Use `program upsert` when you want to publish a directory as the newest version of a program:

```sh
bunx marble-cli@latest program upsert /tmp/marble-programs/reverse-string
```

Use `program test` when you want to upsert first and then hit `/test` for the newly created version:

```sh
bunx marble-cli@latest program test /tmp/marble-programs/reverse-string --input '{"mode":"uppercase"}'
```

If you pass `--input`, Marble turns it into:

```json
{
  "system": {
    "providers": {}
  },
  "cell": {},
  "input": {
    "mode": "uppercase"
  }
}
```

If you need to control `cell.manualInputValue`, use `--manual-input`:

```sh
bunx marble-cli@latest program test /tmp/marble-programs/reverse-string --manual-input "hello" --input '{"mode":"uppercase"}'
```

If you need full control, use `--full-input`:

```sh
bunx marble-cli@latest program test /tmp/marble-programs/reverse-string --full-input '{"system":{"providers":{}},"cell":{"manualInputValue":"hello"},"input":{"mode":"uppercase"}}'
```

The raw plural form still exists:

```sh
bunx marble-cli@latest programs test /tmp/marble-programs/reverse-string '{"system":{"providers":{}},"cell":{"manualInputValue":"hello"},"input":{"mode":"uppercase"}}'
```

`program test` is not a local dry run. It always upserts first, so repeated tests create repeated remote versions.

## Input Template Syntax

`inputTemplate` is stored as a JSON string on the column. Inside that JSON string, use the current resolver syntax.

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

With the human-facing `column create` command, pass real JSON and let the CLI stringify it for transport:

```sh
bunx marble-cli@latest column create "Enriched Email" --table <tableId> --program <programId> --input-template '{"personName.$":"$.columns.<personColumnId>.value","companyName.$":"$.columns.<companyColumnId>.value"}' --output-schema '{"type":"string"}'
```

When you fall back to raw plural commands, escape it because `inputTemplate` itself must be a string:

```sh
bunx marble-cli@latest columns create '{"tableId":"<tableId>","name":"Enriched Email","programId":"<programId>","inputTemplate":"{\"personName.$\":\"$.columns.<personColumnId>.value\",\"companyName.$\":\"$.columns.<companyColumnId>.value\"}","outputSchema":{"type":"string"}}'
```

## Standard Workflow

### Build Or Update A Program

1. Create a temp directory under `/tmp/marble-programs`.
2. Write `main.ts`, `package.json`, `input-schema.json`, and `output-config.json`.
3. Run `program test` with `--input`, `--manual-input`, or `--full-input`.
4. Fix any schema or runtime issue until the test succeeds.
5. Record the returned program and version IDs.

Example:

```sh
bunx marble-cli@latest program test /tmp/marble-programs/reverse-string --manual-input "hello" --input '{"mode":"uppercase"}'
```

### Wire A Program Into A Table

1. Create or identify the table.
2. Upsert the programs you want to use.
3. Create input columns with `column create`.
4. List columns to capture their IDs.
5. Create downstream columns with `--input-template`.
6. Create starter rows with `row create`.
7. Update cells with manual input as needed.

Example:

```sh
bunx marble-cli@latest table create "Apollo Email Enrichment"
bunx marble-cli@latest program upsert /tmp/marble-programs/user-input
bunx marble-cli@latest program upsert /tmp/marble-programs/apollo-email
bunx marble-cli@latest program list
bunx marble-cli@latest column create "Person Name" --table <tableId> --program <userInputProgramId> --output-schema '{"type":"string"}'
bunx marble-cli@latest column create "Company Name" --table <tableId> --program <userInputProgramId> --output-schema '{"type":"string"}'
bunx marble-cli@latest column list --table <tableId>
bunx marble-cli@latest column create "Enriched Email" --table <tableId> --program <apolloProgramId> --input-template '{"personName.$":"$.columns.<personColumnId>.value","companyName.$":"$.columns.<companyColumnId>.value"}' --output-schema '{"type":"string"}'
bunx marble-cli@latest row create --table <tableId>
bunx marble-cli@latest cell list --table <tableId>
bunx marble-cli@latest cell set <personCellId> "Ada"
bunx marble-cli@latest cell set <companyCellId> "Analytical Engines"
```

## General Approach

When asked to create a table or workflow, break the task into composable steps.

### Do

- Use a column for each workflow step.
- Combine columnar results into a final synthesis column when needed.
- Use manual-input columns for simple user-provided values.
- Prefer object-shaped program input once a function has more than a handful of inputs.

### Don't

- Invent CLI subcommands that do not exist, or forget that raw plural commands are still available when you need them.
- Build one monolithic program when several columns would be clearer.
- Assume provider credentials exist unless Marble or the user explicitly provides them.
- Confuse provisioning remote Marble objects with editing the Marble repo.

## Troubleshooting

- If CLI requests fail, inspect `.env` for `MARBLE_API_URL` and `MARBLE_API_KEY`.
- If `list` filters do not work, make sure the filter object is flat and scalar-only.
- If `column create` or `column update` fails, check whether `--input-template` and `--output-schema` are valid JSON.
- If raw `columns create` or `columns update` fails, check whether `inputTemplate` was passed as a string and `outputSchema` as real JSON.
- If the CLI prints `Invalid request`, read the structured `Details:` block. Marble now returns the underlying validation issues instead of just the top-line error.
- If `row create` fails with `idx cannot be used when count is greater than 1`, drop `--idx` or set `--count` back to `1`.
- If `program test` fails, fix the runtime code, `input-schema.json`, or `output-config.json`, then rerun it.
- If a dependent column is blank, confirm the `inputTemplate` references the correct column IDs.
- If the repo becomes dirty during CLI-only work, move temp artifacts to `/tmp` and clean up anything you created in the workspace.
