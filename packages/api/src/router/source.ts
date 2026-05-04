import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const sourceRouter = {
  create: os.sources.create.handler(({ context, input }) =>
    context.store.sources.create(input),
  ),
  delete: os.sources.delete.handler(({ context, input }) =>
    context.store.sources.delete(input),
  ),
  get: os.sources.get.handler(({ context, input }) =>
    context.store.sources.get(input),
  ),
  list: os.sources.list.handler(({ context, input }) =>
    context.store.sources.list(input),
  ),
  update: os.sources.update.handler(({ context, input }) =>
    context.store.sources.update(input),
  ),
} satisfies RouterResourcePart<"sources">;
