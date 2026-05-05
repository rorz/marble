import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const columnRouter = {
  list: os.columns.list.handler(({ context, input }) =>
    context.store.columns.list(input),
  ),
} satisfies RouterResourcePart<"columns">;
