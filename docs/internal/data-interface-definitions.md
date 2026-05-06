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

## Internal worker runtime

Executor and ingestor workers may use `@marble/store` resource rails with a service-role Supabase client for trusted orchestration that is not expressible as normal public SDK operations. This is an internal workspace-only surface, not a public API, CLI, or user-facing SDK surface. It may resolve plaintext secrets, mutate run/cell state, and materialize webhook data, so it must not be mounted on public contracts or exposed through generic resource CRUD.

Allowed worker operations:

- `keys.authenticateToken` - Resolve a presented API key into the worker auth context.
- `sources.authorizeWebhook` - Verify a source webhook token without returning source data.
- `sourceEvents.ingestWebhook` - Append a source event, materialize mapped table rows/cells, and queue runs for written cells.
- `programRuns.createPendingForCellIds` - Mark cells pending and create program runs for executor scheduling.
- `programRuns.loadMany` - Load full run context required by the executor runtime.
- `programRuns.loadInputContextForRun` - Load persisted cell, row, column, dependency-cell, and input-schema data needed for executor input resolution.
- `programRuns.loadInputContextForCellId` - Load the same persisted input context for a dependent cell candidate before queueing.
- `programRuns.resolveOwnerUserIdForProfile` - Resolve a profile owner for trusted test execution secret lookup.
- `programRuns.resolveEnvironmentVariablesForSecretDeclarations` - Resolve plaintext secret values from already-validated secret declarations.
- `programRuns.persistFailure` - Persist failed run output to the target cell and run.
- `programRuns.persistSuccess` - Persist successful run input/output to the target cell and run.
- `programRuns.setCellState` - Persist a non-run cell state such as an auto-queue validation block.
- `programRuns.listDependentCandidateCellIds` - Find dependent cell candidates after successful upstream runs; executor remains responsible for contract validation.
- `programRuns.loadProgramVersionTestData` - Load files and config required for a program version test run.

These operations stay on store resources because they are orchestration actions spanning multiple resource aggregates. Splitting them into public child-resource CRUD would either expose secret material or force executor/ingestor workers to rebuild database semantics locally.

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

## sources

Sources belong to projects and describe inbound payload shape.

Allowed operations:

- `create` - Create a source within a project.
- `list` - List sources by project.
- `get` - Read one source.
- `update` - Rename a source or update its payload schema.
- `delete` - Delete a source and its owned source events and pipes.

## sourceEvents

Source events belong to sources and projects. Source event creation derives project ownership from the source; callers must not provide `projectId`.

Allowed operations:

- `create` - Append a raw payload event for a source.
- `list` - List source events by project, source, or both.
- `get` - Read one source event.

Source events are append-only through the public data interface. Do not add `update` or `delete` unless there is a product-level retention or replay workflow that needs it.

## pipes

Pipes connect sources to tables within the same project.

Allowed operations:

- `create` - Create a pipe between a source and table in the same project.
- `list` - List pipes by source, table, or both.
- `get` - Read one pipe.
- `update` - Update mappings or move the pipe to another source/table pair in the same project.
- `delete` - Delete a pipe.

## programs

Programs describe executable table-column behavior and include version/configuration context for editor surfaces.

Allowed operations:

- `create` - Create a user-owned program, optionally with an initial draft version.
- `listForEditor` - List first-party programs and programs owned by the current user, including versions and files needed by the program and table-column editors.
- `update` - Rename a user-owned program.

Program lifecycle stays separate from file editing. Do not hide program-file mutations inside program or version array patches.

## programVersions

Program versions own input schema, output config, secret config, publish state, and test execution for a program version.

Allowed operations:

- `create` - Create a draft or published version for a program.
- `update` - Update draft configuration or publish a draft version.
- `test` - Execute a version through an injected runtime action without persisting a cell result.

## programFiles

Program files belong to a program version and hold editable runtime source/configuration content.

Allowed operations:

- `create` - Create a file on an editable draft version.
- `list` - List files for one or more readable versions.
- `get` - Read one file.
- `syncForVersion` - Reconcile the complete file set for an editable draft version.
- `update` - Update filename, filetype, or content on an editable draft version.
- `delete` - Delete a file from an editable draft version.

Program files are a first-class resource because the editor mutates files directly. Keeping them behind top-level program or version patches makes ownership and update intent ambiguous.

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
- `listReferenceable` - List current-user columns that can be used as reference/manual input targets in GUI editors.
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

## secrets

Secrets are user-owned Vault entries. Public reads return metadata only; plaintext values are write-only and must never be returned by SDK, API, CLI, or store metadata operations.

Allowed operations:

- `create` - Create a named secret and store the plaintext value in Vault.
- `list` - List secret metadata for the current user.
- `get` - Read one secret's metadata.
- `update` - Rename a secret or replace its Vault value.
- `delete` - Delete a secret and its Vault value.

## secretBindings

Secret bindings connect declared environment names to user-owned secret metadata for program and column editor surfaces. Binding values never expose plaintext secret values.

Allowed operations:

- `listPrograms` - List program secret bindings for one or more programs.
- `setProgram` - Replace the bindings for a program.
- `listColumns` - List column secret bindings for one or more columns.
- `setColumn` - Replace the bindings for a column.

Program bindings belong here rather than on `programs.update` because they update deployment/runtime configuration, not the program entity or version files. Column bindings belong here rather than `columns.update` for the same reason.

## profiles

Profiles are current-user actor identities used by API keys and profile-scoped resources.

Allowed operations:

- `create` - Create an agent profile for the current user.
- `list` - List current-user profiles, optionally filtered by type.
- `get` - Read one current-user profile.
- `update` - Rename or edit a current-user agent profile.
- `delete` - Delete a current-user agent profile.

Human profile lifecycle is system-owned; user-facing profile deletion must stay restricted to agent profiles unless this document changes.

## keys

Keys are profile-owned API credentials. Public reads return key metadata only; token material is only returned at creation time.

Allowed operations:

- `create` - Create an API key for an owned profile and return the one-time token.
- `list` - List key metadata for current-user profiles, optionally including deleted/revoked keys.
- `revoke` - Revoke a key owned by a current-user profile.

## events

Events are current-user audit/activity feed records used by the GUI event feed and change radar.

Allowed operations:

- `listForCurrentUser` - List the current user's event feed, with filtering needed by GUI feed/radar surfaces.
- `resolveTargets` - Resolve event target IDs to display metadata for rows, columns, and program versions.

Event creation remains internal to resource actions and database triggers. Do not expose generic `events.create`.

## sidebar

Sidebar data is a current-user aggregate read for GUI navigation and command palette bootstrap.

Allowed operations:

- `getData` - Return current-user owner profile IDs, profile summaries, visible projects, programs, tables, sources, and pipes for sidebar rendering.

This aggregate belongs on `sidebar` because it intentionally spans multiple resources for a single GUI bootstrap read; modelling it as child-resource CRUD would make the web app reassemble database joins itself.
