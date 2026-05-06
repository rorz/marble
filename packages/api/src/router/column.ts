import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const columnRouter = {
  create: os.columns.create.handler(({ context, input }) =>
    context.store.columns.create(input),
  ),
  delete: os.columns.delete.handler(({ context, input }) =>
    context.store.columns.delete(input.id),
  ),
  get: os.columns.get.handler(({ context, input }) =>
    context.store.columns.get(input.id),
  ),
  list: os.columns.list.handler(({ context, input }) =>
    context.store.columns.list(input),
  ),
  listReferenceable: os.columns.listReferenceable.handler(({ context }) =>
    context.store.columns.listReferenceable(),
  ),
  update: os.columns.update.handler(({ context, input }) =>
    context.store.columns.update(input.id, input.values),
  ),
} satisfies RouterResourcePart<"columns">;
