import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const rowRouter = {
  delete: os.rows.delete.handler(({ context, input }) =>
    context.store.rows.delete(input.id),
  ),
  get: os.rows.get.handler(({ context, input }) =>
    context.store.rows.get(input.id),
  ),
  list: os.rows.list.handler(({ context, input }) =>
    context.store.rows.list(input),
  ),
  update: os.rows.update.handler(({ context, input }) =>
    context.store.rows.update(input.id, input.values),
  ),
} satisfies RouterResourcePart<"rows">;
