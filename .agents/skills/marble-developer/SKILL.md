# Marble External Agent Skill

This skill provides instructions for external AI Agents (like Cursor, Claude Desktop, or your CLI agent) on how to interact with a user's remote Marble account to create tables, write and test custom programs (columns), and map data.

## Environment Variables

Before running any commands, you MUST have the user configure the following environment variables (or you can pass them inline if the user provides them):
- `MARBLE_API_URL`: The URL of the user's Marble API (e.g. `http://localhost:3084/api` or the production endpoint).
- `MARBLE_API_KEY`: The user's API Key (currently passed down to Supabase).
- `MARBLE_EXECUTOR_URL`: The URL of the Marble executor (e.g. `http://localhost:8787` for local dev or the production URL).

## The Marble Mental Model

- **Table**: Represents a workflow or task against a dataset.
- **Column (Program)**: Represents a single "step" in the workflow. Every column runs a JavaScript program in a Cloudflare Sandbox.
- **Row**: Represents a single record. 
- **Cell**: The intersection of a Row and a Column. A cell's `state` contains the result of the column's program execution for that row context.

## Using the Marble CLI

You should avoid writing raw SQL or HTTP requests. Instead, use the `@marble/cli` tool using `npx` (or from within the Marble monorepo via `pnpm --filter @marble/cli start --`).

```sh
# Example usage with npx (if published) or using the local workspace build
npx @marble/cli <command> [args]
```

### Available Commands

- `programs dry-run <dir> <input>`: Dry-runs a program directory against the remote executor using a stringified JSON input payload.
- `programs upsert <dir>`: Reads `index.js` and `config.json` from `<dir>` and upserts a program to the Marble account.
- `programs list`: Lists all available programs.
- `programs get <id>`: Fetches a program by ID to inspect its config and schemas.
- `tables create <name>`: Creates a new table and returns its ID.
- `tables list`: Lists all tables.
- `tables get <id>`: Get a table and its associated columns and rows.
- `columns add <tableId> <name> <programId> <inputTemplate> <outputSchema>`: Adds a column to a table and maps dependencies based on the JSON `inputTemplate`.
- `columns list <tableId>`: Lists all columns on a table.
- `rows add <tableId>`: Appends a blank row to the table.
- `rows list <tableId>`: Lists all rows on a table.
- `cells get <id>`: Fetches a cell to inspect its execution state.

## Developing a Program

When the user asks you to build a program, create a temporary directory (e.g., `./temp-marble-program/`) and write two files:

1. **`index.js`**: The program logic, exported as an ES Module default function.
2. **`config.json`**: The program metadata.

### Program Execution Context (`index.js`)

The default function receives a single parameter object with three properties:

```javascript
export default async function ({ system, cell, input }) {
  // \`input\` contains the validated data conforming to the program's inputSchema
  // \`cell.manualInputValue\` contains any raw string value manually entered by a user
  
  return {
    someValue: input.someField
  }; // Result MUST conform to the outputConfig schema
}
```

### Program Configuration (`config.json`)

```json
{
  "name": "My Custom Program",
  "inputSchema": {
    "type": "object",
    "properties": {
      "someField": { "type": "string" }
    }
  },
  "outputConfig": {
    "schema": {
      "type": "object",
      "properties": {
        "someValue": { "type": "string" }
      }
    }
  }
}
```

## Agent Workflows

### 1. Building and Testing a Program
1. Create the `index.js` and `config.json` files in a folder.
2. Formulate a test input payload as a JSON string. Example: `'{"system":{},"cell":{},"input":{"someField":"hello"}}'`
3. Run `npx @marble/cli programs dry-run <dir> <input-string>` to verify it works without errors.
4. Once verified, run `npx @marble/cli programs upsert <dir>`. Note the returned `programId`.

### 2. Wiring up a Table
1. Run `npx @marble/cli tables create "My Table"`. Note the `tableId`.
2. Add a column using the `programId` from earlier.
   - You must construct an `inputTemplate` JSON string. This template maps static strings or dynamic dependencies into the program's `inputSchema`.
   - Run `npx @marble/cli columns add <tableId> "My Column" <programId> '<inputTemplate>' '<outputSchema>'`.
3. Add rows using `npx @marble/cli rows add <tableId>`.