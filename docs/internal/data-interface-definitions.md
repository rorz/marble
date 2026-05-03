# Data Interface Definitions

This document is the canonical almanac for Marble data operations.

Absence is meaningful. If an operation is not listed here, it is not allowed as a public API operation, SDK method, CLI command, or store resource method unless this document is updated in the same change with a clear rationale.

These definitions are reviewed semantically by agents and humans. They are not yet a generated manifest or compiler-enforced schema. Treat them as interface law anyway.

By default, a listed operation is allowed across the API, SDK, CLI, and store surfaces as those surfaces are implemented. Do not maintain per-surface checklists here unless a resource truly needs an exception.

## Review Rule For Agents

Before changing data interfaces, read this document and answer these questions in your final response:

- Which resource changed?
- Which operation changed?
- Which surfaces expose it: API, SDK, CLI, Store?
- Was the operation already present here?
- If newly added, why does it belong on this resource?
- Why is this not better represented as a parent-resource action?

## Action And RPC Rules

Marble exposes product actions, not raw table access. Use REST-shaped CRUD only when CRUD is genuinely the product interface.

Rules:

- Prefer parent-owned actions when an operation changes a parent-owned aggregate. Row insertion belongs at `tables.insertRows`, not `rows.create`, because the table owns row order and cell materialization.
- Prefer object inputs for every public operation. Do not add positional signatures such as `tables.insertRows(quantity, idx)`. Use `{ id, idx, quantity }`.
- The contract shape is the public operation. The API handler should mostly map contract input to store action. The store owns persistence semantics.
- Handles may provide ergonomic sugar, but they should not become the canonical contract. A table handle may call `table.insertRows({ idx, quantity })`; internally it should inject the table ID into the canonical `{ id, idx, quantity }` input.
- Use named actions when behavior has domain meaning. Prefer `cells.setManualValue()` over `cells.update()`.
- For OpenAPI-compatible HTTP routes, prefer readable static subpaths over generic buckets. Use `GET /projects/most-recent`, not `GET /projects/actions/get-most-recent-project`.
- Do not invent route namespaces to avoid impossible ID collisions. If a resource ID is UUID-shaped, a static segment such as `most-recent` cannot collide with a valid ID; rely on route specificity and input validation.
- Use camelCase for TypeScript operation names and kebab-case for HTTP path segments. For example, `projects.getMostRecentProject()` maps to `GET /projects/most-recent`.
- For multi-row, multi-cell, or ordered operations, strongly consider a Postgres RPC implementation behind the store. The public oRPC operation and the database RPC may share intent, but they are different layers.

## projects

Projects are top-level user-owned workspaces.

Allowed operations:

- `create` - Create a project for the current profile.
- `list` - List projects for the current profile. Exact-name filtering is allowed.
- `get` - Read one project by ID within the current profile boundary.
- `getMostRecentProject` - Example read-only RPC action returning the newest project for the current profile, or null when no project exists.
- `update` - Rename a project or update its folder path.
- `delete` - Delete a project boundary.

## tables

Tables belong to projects and own rows, columns, and cell materialization.

Allowed operations:

- `create` - Create a table within a project.
- `list` - List tables by project.
- `get` - Read one table.
- `update` - Rename a table.
- `delete` - Delete a table and its owned grid data.
- `insertRows` - Insert one or more rows at a row index and materialize cells for each existing column.

`tables.insertRows` rules:

- Canonical input is `{ id, idx, quantity }`, where `id` is the table ID.
- `idx` is required and must be non-negative.
- `quantity` is required and must be positive.
- Existing rows with `idx >= input.idx` must shift by `quantity`.
- The operation must materialize cells for all existing columns on the table.
- The operation must not leave partial rows if row shifting or cell materialization fails.
- The operation returns aggregate counts, not inserted row and cell payloads.
- The durable implementation should use an atomic Postgres RPC.

## rows

Rows belong to tables. Row lifecycle owns cell materialization/deletion for that row, but user-facing row insertion should usually be exposed through table-owned actions.

Allowed operations:

- `list` - List rows by table.
- `get` - Read one row.
- `update` - Reindex a row.
- `delete` - Delete a row and its cells.

Prefer `tables.insertRows` over `rows.create` for public row insertion. Add `rows.create` only if there is a clear use case for creating a row outside the table aggregate action.

## columns

Columns belong to tables. Column lifecycle owns cell materialization/deletion for that column.

Allowed operations:

- `create` - Create a column and materialize cells for existing rows.
- `list` - List columns by table.
- `get` - Read one column.
- `update` - Update column configuration.
- `delete` - Delete a column and its cells.

## cells

Cells are materialized intersections of rows and columns. They should usually not own their own lifecycle.

Allowed operations:

- `get` - Read one cell.
- `list` - List cells by row, column, or both.
- `setManualValue` - Set or clear user-authored manual input. Prefer this over generic update.
- `run` - Execute a cell through an injected runtime action.

Explicitly disallowed unless this document changes:

- `cells.create()` - cells should be materialized by row, column, or table actions.
- `cells.delete()` - cells should be deleted by row, column, or table lifecycle actions.
- `cells.update()` - use named actions such as `setManualValue`.
