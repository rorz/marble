import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const tableRouter = {
  create: os.tables.create.handler(({ context, input }) =>
    context.store.tables.create(input),
  ),
  delete: os.tables.delete.handler(({ context, input }) =>
    context.store.tables.delete(input),
  ),
  get: os.tables.get.handler(({ context, input }) =>
    context.store.tables.get(input),
  ),
  insertRows: os.tables.insertRows.handler(({ context, input }) =>
    context.store.tables.insertRows(input),
  ),
  list: os.tables.list.handler(({ context, input }) =>
    context.store.tables.list(input),
  ),
  update: os.tables.update.handler(({ context, input }) =>
    context.store.tables.update(input),
  ),
} satisfies RouterResourcePart<"tables">;
