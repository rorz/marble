import { type MarbleContract, marbleContract } from "@marble/contracts";
import type { ApiContext } from "../context";
import { os } from "../server";
import type { RouterResourcePart } from "../types";

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
export function composeResourceRouter<R extends keyof MarbleContract>(
  resource: R,
): RouterResourcePart<R> {
  const procedures = (
    os as unknown as Record<R, Record<string, AnyProcedureBuilder>>
  )[resource];
  const router: Record<string, unknown> = {};

  for (const op of Object.keys(marbleContract[resource])) {
    router[op] = procedures[op].handler(({ context, input }) =>
      (
        context.store as unknown as Record<
          R,
          Record<string, (input?: unknown) => unknown>
        >
      )[resource][op](input),
    );
  }

  return router as RouterResourcePart<R>;
}

type AnyProcedureBuilder = {
  handler: (
    handler: (args: { context: ApiContext; input: unknown }) => unknown,
  ) => unknown;
};
