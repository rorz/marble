import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const cellRouter = {
  get: os.cells.get.handler(({ context, input }) =>
    context.store.cells.get(input),
  ),
  list: os.cells.list.handler(({ context, input }) =>
    context.store.cells.list(input),
  ),
  run: os.cells.run.handler(({ context, input }) =>
    context.store.cells.run(input),
  ),
  setManualValue: os.cells.setManualValue.handler(({ context, input }) =>
    context.store.cells.setManualValue(input),
  ),
} satisfies RouterResourcePart<"cells">;
