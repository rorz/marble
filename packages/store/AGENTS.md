# Store Package Rules

Before adding, removing, renaming, or exposing any store resource method, read ../../docs/internal/data-interface-definitions.md.

The store is allowed to contain private helpers, but public resource collection methods are governed by the data interface almanac.

Rules:

1. Do not add generic CRUD methods to a resource just because the database table supports them.
2. Do not expose child-resource lifecycle methods when lifecycle is owned by a parent resource. In particular, do not add `cells.create()`, `cells.delete()`, or `cells.update()` unless the almanac is updated first.
3. Prefer named domain actions over generic updates for meaningful behavior, such as `cells.setManualValue()`.
4. **Every public collection method takes a single `input` object.** Per-entity ops place `id` (or the composite address — e.g. `{ columnId, rowId }`) at the top level alongside the payload. Update ops use `{ id, values }`. There is no positional form. The contract input schema *is* the call signature.
5. If you update the almanac, mention the changed resource, operation, surfaces, and rationale in your final response.
