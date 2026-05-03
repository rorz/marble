import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const tableRouter = {
  get: os.tables.get.handler(({ context, input }) =>
    context.store.tables.get(input),
  ),
  list: os.tables.list.handler(({ context, input }) =>
    context.store.tables.list(input),
  ),
} satisfies RouterResourcePart<"tables">;
