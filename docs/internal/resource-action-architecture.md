# Resource Action Architecture Spec

Status: live roadmap  
Audience: API, database, CLI, and GUI architecture work

This document is the architectural spine for Marble's data layer. It describes the target shape, calls out what is already in place, and points at the dated plans that drive the remaining migration. Keep it honest — when a phase lands, mark it ✅ here in the same commit.

## Current Status

| Pillar | State |
|---|---|
| Broadcast as the application realtime primitive | ✅ All product code uses private Supabase Broadcast channels. `postgres_changes` survives only in the `/testing/db-perf*` benches that informed the decision. The `harness/realtime.ts` rail keeps listener ↔ publication coupling mechanical. |
| `packages/api` as the only data gateway | ✅ Web, CLI, executor, and ingestor route through the API surface for application data. Workers retain direct `@marble/store` access for the documented internal-runtime methods only (`keys.authenticateToken`, `sources.authorizeWebhook`, `sourceEvents.ingestWebhook`, `programRuns.*`). |
| CLI rails as contract pass-through | ✅ Every CLI command is derived from `marbleContract` in `packages/cli/src/root.ts`. `program-dir` is the sole non-pass-through helper. |
| `<resource>/actions.ts` nested layout | 🟡 Adopted for `column` as proof. `harness/handlers.ts` understands both layouts. Other resources stay flat until they grow validation/business-logic bodies. |
| Validation-layer API tests | ✅ 17 resources × ~5 tests each; throwing-Proxy store in `_setup.ts` ensures any leak past oRPC validation fails loudly. No Supabase required. |
| Integration tests | ❌ `createIntegrationContext()` scaffolded in `_setup.ts` but unwired. Highest-leverage next test bet: `tables.insertRows` end-to-end. |
| DB-owned event recording (transactional) | ❌ `packages/store/src/db.ts:writeEventRecord` is still application-side. Migration plan: `.opencode/plans/2026-05-12-events-in-db-rollout.md`. |
| Resource registry helper (`defineResource`) | ❌ Contracts and store still co-evolve manually. Tracked in `.opencode/plans/2026-05-12-resource-registry.md`. |
| Change-radar/spotlight as `@marble/ui` primitive | ❌ Still 3,062 LOC of route-local logic. Tracked in `.opencode/plans/2026-05-12-change-feed-primitive.md`. |
| God-file splits (`programs/view.tsx`, `tables/[id]/view.tsx`) | 🟡 Tables view moved to canonical URL + `grid-theme.ts` seam extracted. Full split tracked in `.opencode/plans/2026-05-12-view-splits.md`. |

This document sketches the target architecture for Marble's data layer. The goal is not to build a prettier ORM. The goal is to make every resource operation composable, injectable, auditable, realtime-aware, and boring to route through every client surface.

## Problem Statement

Marble currently has three related problems:

1. Data access is split between `packages/api`, web server helpers, browser realtime subscriptions, CLI flows, executor flows, and direct Supabase calls.
2. Event records are written opportunistically by application helpers, so any mutation path that bypasses those helpers can create an incomplete audit trail.
3. Client-side consumption is too nebulous. Views subscribe directly to low-level Postgres changes and each surface invents its own merge, filter, batching, and invalidation behavior.

The target architecture must collapse these into one set of explicit resource/action contracts.

## Core Direction

1. Use Broadcast instead of Postgres Changes for application realtime.
2. Move event creation into Postgres-owned mutation flows so mutations, event records, and broadcast messages are transactionally coupled.
3. Make `packages/api` the only Marble data gateway for web, CLI, executor, internal tools, and future agents.
4. Use RPC for domain actions and projections where database atomicity or shape control matters.
5. Keep browser Supabase usage limited to auth/session and Realtime transport.
6. Replace ad hoc client subscriptions with typed projection hydration plus scoped broadcast patch streams.

## Non-Goals

1. Do not build a general-purpose ORM.
2. Do not wrap every trivial select in RPC just for uniformity.
3. Do not route high-volume table working sets through a single global user channel.
4. Do not introduce deep class inheritance for resource behavior.
5. Do not let route handlers, server actions, or GUI components reach around the API package for application data.

## Class Model

Classes are appropriate here as composition containers and request-scoped service namespaces. They should not become an inheritance hierarchy of special cases.

Use classes for:

1. Request-scoped dependency containers.
2. Resource modules.
3. Stable service wrappers such as database, event, realtime, and transaction helpers.

Use plain functions and data objects for:

1. Access checks.
2. Action bodies.
3. Projection logic.
4. Broadcast topic derivation.
5. Event redaction and diff shaping.

The desired class shape is shallow:

```ts
type ResourceDeps = {
  actor: ActorContext;
  db: MarbleDb;
  events: EventService;
  realtime: RealtimeService;
  requestId: string;
  tx: TransactionRunner;
};

abstract class Resource<Name extends ResourceName> {
  constructor(protected readonly deps: ResourceDeps) {}

  abstract readonly access: ResourceAccessPolicy<Name>;
  abstract readonly broadcasts: ResourceBroadcastPolicy<Name>;
  abstract readonly events: ResourceEventPolicy<Name>;
  abstract readonly name: Name;
  abstract readonly table: DbTableName;
}
```

Concrete resources should compose policy objects and action functions:

```ts
class TableResource extends Resource<"tables"> {
  readonly access = tableAccessPolicy;
  readonly broadcasts = tableBroadcastPolicy;
  readonly events = tableEventPolicy;
  readonly name = "tables";
  readonly table = "table";

  create = createTable;
  delete = deleteTableCascade;
  get = getTable;
  list = listTables;
  patch = patchTable;
}
```

Avoid inheritance stacks like `TableResource extends ProjectOwnedResource extends EventfulResource extends CrudResource`. If behavior is shared, make it a small policy, helper, action decorator, or projection helper.

## Request Container

Every API entrypoint should construct one request container. The container resolves actor context, request id, database access, transaction helpers, event helpers, and realtime helpers once.

```ts
class MarbleRequest {
  readonly cells = new CellResource(this.deps);
  readonly columns = new ColumnResource(this.deps);
  readonly projects = new ProjectResource(this.deps);
  readonly rows = new RowResource(this.deps);
  readonly tables = new TableResource(this.deps);

  constructor(private readonly deps: ResourceDeps) {}
}
```

Transport code should mostly become adaptation:

1. Parse request.
2. Resolve actor.
3. Build `MarbleRequest`.
4. Invoke a resource query/action.
5. Serialize the result.

The same request container should be usable from Hono routes, CLI commands, server actions, executor integrations, and tests.

## Resource Registry

The resource registry should become the canonical source of resource shape.

```ts
const resources = defineResources({
  cells: CellResource,
  columns: ColumnResource,
  events: EventResource,
  projects: ProjectResource,
  rows: RowResource,
  tables: TableResource,
});
```

The registry should drive:

1. API route mounting.
2. CLI raw resource commands.
3. Human-friendly CLI command support.
4. Resource labels and route segments.
5. Supported operations.
6. Documentation metadata.
7. Event resource names.
8. Broadcast policy discovery.
9. Projection participation.

This replaces scattered mappings that drift apart.

## Action Model

CRUD is an implementation detail. The public unit of behavior should be an action.

```ts
type ResourceAction<Input, Output> = {
  input: ZodSchema<Input>;
  run(deps: ResourceDeps, input: Input): Promise<Output>;
};
```

Examples:

1. `projects.create`
2. `tables.create`
3. `tables.deleteCascade`
4. `rows.createIndexed`
5. `columns.createIndexed`
6. `cells.patchState`
7. `programRuns.execute`
8. `sources.ingestEvent`
9. `resourceMap.forUser`

REST-shaped CRUD routes can still exist, but they should be thin transport aliases over actions.

## Database RPC Policy

Use RPC when the operation needs one or more of:

1. Transactional mutation plus event insertion.
2. Transactional mutation plus broadcast insertion.
3. Race-free index allocation.
4. Cascade mutation with a durable event story.
5. A stable projection shape that should not be reconstructed in every client.
6. Security-sensitive logic that should stay near the database.

Avoid RPC when it merely renames a simple, already-safe read without adding authorization, projection shape, transactionality, or domain semantics.

All mutation RPCs should receive explicit actor metadata:

```sql
actor_key_id uuid,
actor_profile_id uuid,
actor_source text,
actor_user_id uuid,
request_id text
```

If the operation can be executed by an API key or system actor, the function contract must make that explicit rather than inferring it from ambient session state.

## Event Model

Event records should be attached to actions inside Postgres. A successful mutation should not be able to commit without its corresponding event record unless the action explicitly declares itself eventless.

Each event should capture:

1. `request_id`
2. actor user/profile/key identity where applicable
3. actor source
4. resource name
5. entity id
6. operation
7. before state
8. after state
9. normalized diff
10. redacted sensitive fields

Event redaction policy belongs to the resource definition. Event writing belongs to the database mutation path.

## Broadcast Model

Broadcast should become the only application realtime primitive. Postgres Changes can remain for experiments or temporary migrations, but product surfaces should consume Broadcast.

Use private channels and central Realtime authorization policy. Channel names and payload shapes must be declared by resource broadcast policies rather than hand-built in route views.

Recommended topic classes:

1. `user:{user_id}:resources` for shell resource map patches.
2. `profile:{profile_id}:events` for owned activity feed updates.
3. `project:{project_id}:resources` for project-scoped child resource changes where useful.
4. `table:{table_id}:shape` for table, row, and column structure.
5. `table:{table_id}:cells` for high-volume cell state changes.
6. `source:{source_id}:events` for source ingestion updates.
7. `run:{run_id}:state` for execution state where direct run tracking is useful.

The global user resource channel should carry navigation/resource-index changes only. It should not carry high-volume cell churn.

## Projection Model

Some reads are not resource lists. They are projections and should be first-class.

Examples:

1. GUI sidebar resource map.
2. Command palette resource index.
3. Initial table grid payload.
4. Event feed page.
5. Change radar batches.
6. Source event timeline.

Projection APIs should return stable, typed shapes and companion broadcast patch contracts.

```ts
class ResourceMapProjection {
  constructor(private readonly deps: ResourceDeps) {}

  forUser(userId: string): Promise<ResourceMap> {
    return this.deps.db.rpc("resource_map_for_user", { user_id: userId });
  }
}
```

## Client Consumption Model

The GUI shell should hydrate a projection and then subscribe to broadcast patches. React Context should expose selectors into a store, not one giant mutable object that rerenders the app on every patch.

Recommended shape:

1. Server loads an initial projection through `packages/api`.
2. Shell creates a normalized external store.
3. Shell subscribes to the relevant Broadcast channels.
4. Broadcast payloads are validated and applied as patches.
5. Components use selector hooks against the store.
6. Route-local heavy state can subscribe to scoped channels.

The data flow should be:

```txt
API projection -> normalized client store -> selector hooks
DB action -> event row -> broadcast patch -> client store patch
```

## Supabase Boundaries

Allowed outside `packages/api`:

1. Auth/session reads.
2. Realtime channel subscription setup.
3. Storage calls if a future file/resource design explicitly allows it.

Disallowed outside `packages/api`:

1. Application table reads.
2. Application table writes.
3. Domain RPC calls.
4. Direct mutation-side event writes.
5. Direct mutation-side broadcast writes.

Any exception should be documented at the callsite and should have a planned removal path.

## Migration Plan Seed

1. Define the shared resource registry and request container without changing behavior.
2. Move existing `ApiResources`, resource mounts, and CLI metadata to derive from the registry.
3. Create `MarbleDb` as a narrow gateway around Supabase.
4. Move one low-risk resource to the new resource class/action shape.
5. Define the event envelope and resource event policies.
6. Create database helpers for mutation-owned event insertion and broadcast insertion.
7. Migrate the GUI sidebar/resource map to API projection plus `user:{user_id}:resources` Broadcast.
8. Replace the current sidebar Postgres Changes subscription.
9. Migrate table structure realtime to `table:{table_id}:shape` Broadcast.
10. Migrate cell state realtime to `table:{table_id}:cells` Broadcast.
11. Replace app-side event writes for migrated actions.
12. Add repo checks that flag direct application Supabase reads/writes outside approved boundaries.
13. Migrate remaining resources and projections incrementally.
14. Remove product Postgres Changes subscriptions.

## Acceptance Criteria

The architecture is working when:

1. Every data operation used by web, CLI, executor, and internal tools goes through `packages/api`.
2. Every mutation is represented as a named action.
3. Event records are written transactionally by database-owned mutation paths.
4. Broadcast payloads are typed, topic-scoped, and declared by resource policy.
5. The GUI shell has one resource-map projection and one user resource broadcast subscription.
6. Hot route state uses scoped channels rather than the global user resource bus.
7. Direct application Supabase data calls outside `packages/api` are either gone or mechanically blocked.
8. Adding a resource means adding one resource module and the registry does the boring propagation work.

## Open Questions

1. Should mutation RPCs return full resource rows, event envelopes, or action-specific DTOs?
2. Should event insertion and broadcast insertion be one shared database helper or two explicit helper calls per RPC?
3. How much of access control should live in SQL functions versus TypeScript resource policies?
4. Should generated database types include RPC return payload contracts, or should `packages/api` own DTO schemas independently?
5. What is the first migration slice: sidebar resource map, table shape, or cell state?

## References

1. Supabase Broadcast guide: https://supabase.com/docs/guides/realtime/broadcast
2. Supabase database change subscriptions: https://supabase.com/docs/guides/realtime/subscribing-to-database-changes
3. Supabase Realtime authorization: https://supabase.com/docs/guides/realtime/authorization
4. Supabase RPC reference: https://supabase.com/docs/reference/javascript/rpc
5. Supabase database functions guide: https://supabase.com/docs/guides/database/functions
