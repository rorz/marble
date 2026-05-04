import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const sourceEventRouter = {
  create: os.sourceEvents.create.handler(({ context, input }) =>
    context.store.sourceEvents.create(input),
  ),
  get: os.sourceEvents.get.handler(({ context, input }) =>
    context.store.sourceEvents.get(input),
  ),
  list: os.sourceEvents.list.handler(({ context, input }) =>
    context.store.sourceEvents.list(input),
  ),
} satisfies RouterResourcePart<"sourceEvents">;
