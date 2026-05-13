import { type MarbleContract, marbleContract } from "@marble/contracts";
import type { ApiContext } from "../context";
import { os } from "../server";
import type { RouterResourcePart } from "../types";

/**
 * Shape of one entry on the per-resource implementer. The implementer is
 * `implement(marbleContract).$context<ApiContext>()`, and every op on a
 * resource exposes a `.handler(...)` that returns an implemented procedure.
 *
 * We don't try to express the full `ProcedureImplementer<Input, Output, ...>`
 * shape here — the handler input/output schemas are op-specific and the
 * forwarding path treats `input` as opaque on its way to the store.
 */
type ResourceProcedureBuilder = {
  handler: (
    handler: (args: { context: ApiContext; input: unknown }) => unknown,
  ) => unknown;
};

/**
 * Procedure-builder map for a single resource, keyed off the contract so adding,
 * removing, or renaming an op in `marbleContract[R]` is reflected here at the
 * type level. Indexing `procedures[op]` with `op: keyof MarbleContract[R]` is
 * statically checked against the contract.
 */
type ResourceProcedures<R extends keyof MarbleContract> = {
  readonly [Op in keyof MarbleContract[R]]: ResourceProcedureBuilder;
};

/**
 * Callable-method map for the store entry that a given resource forwards into.
 * The `MarbleStore` class is intentionally decoupled from the contract — some
 * ops have no store counterpart and are always shadowed by an override — so
 * the store side is narrowed to a callable record only at the call site, not
 * across the whole store.
 */
type ResourceStoreMethods<R extends keyof MarbleContract> = {
  readonly [Op in keyof MarbleContract[R]]: (input?: unknown) => unknown;
};

/**
 * Auto-mounts a pass-through router for a contract resource.
 *
 * Every operation becomes a handler that forwards `input` straight to
 * `context.store[resource][op](input)`. This is the default shape for
 * resources that don't need router-side validation, normalization, or
 * composition — which is most of them, given the store is object-only.
 *
 * For ops that DO need bespoke logic, spread the auto-router and
 * override the specific entries:
 *
 * ```ts
 * export const programFileRouter = {
 *   ...composeResourceRouter("programFiles"),
 *   syncForVersion: os.programFiles.syncForVersion.handler(...),
 * } satisfies RouterResourcePart<"programFiles">;
 * ```
 *
 * For ops that have no corresponding store method (e.g.
 * `projects.getMostRecentProject`), the auto-generated entry is
 * shadowed by the override and never invoked. The dead pass-through
 * is harmless — the underlying call is only made on a real request,
 * which the override always intercepts first.
 */
export const composeResourceRouter = <R extends keyof MarbleContract>(
  resource: R,
): RouterResourcePart<R> => {
  // `os[resource]` is an oRPC `RouterImplementer & { [Op]: ProcedureImplementer<...> }`
  // intersection that the compiler cannot reduce to a clean op-keyed record for a
  // generic `R`. We narrow it to `ResourceProcedures<R>` so every subsequent index
  // is checked against `keyof MarbleContract[R]` (the contract is the source of
  // truth) — rather than the previous blanket `Record<R, Record<string, ...>>`
  // cast which discarded the op union entirely.
  const procedures = os[resource] as unknown as ResourceProcedures<R>;
  const router: Partial<RouterResourcePart<R>> = {};

  for (const op of Object.keys(marbleContract[resource]) as Array<
    keyof MarbleContract[R] & string
  >) {
    const routerKey = op as keyof RouterResourcePart<R>;
    router[routerKey] = procedures[op].handler(({ context, input }) => {
      // Same story for the store side: narrow only the resource bucket, not the
      // whole `MarbleStore`. The bucket is intentionally op-incomplete, hence
      // the call-site cast rather than a class-level guarantee.
      const storeResource = context.store[
        resource
      ] as unknown as ResourceStoreMethods<R>;
      return storeResource[op](input);
    }) as RouterResourcePart<R>[typeof routerKey];
  }

  return router as RouterResourcePart<R>;
};
