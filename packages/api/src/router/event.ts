import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const eventRouter = {
  listForCurrentUser: os.events.listForCurrentUser.handler(
    ({ context, input }) => context.store.events.listForCurrentUser(input),
  ),
  resolveTargets: os.events.resolveTargets.handler(({ context, input }) =>
    context.store.events.resolveTargets(input),
  ),
} satisfies RouterResourcePart<"events">;
