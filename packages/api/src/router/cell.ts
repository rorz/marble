import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const cellRouter = {
  get: os.cells.get.handler(({ context, input }) =>
    context.store.cells.get(input.id),
  ),
  list: os.cells.list.handler(({ context, input }) =>
    context.store.cells.list(input),
  ),
  run: os.cells.run.handler(({ context, input }) =>
    context.store.cells.run(input.id, {
      manualInput: input.manualInput,
    }),
  ),
  setManualValue: os.cells.setManualValue.handler(({ context, input }) =>
    context.store.cells.setManualValue(input.id, input.value),
  ),
} satisfies RouterResourcePart<"cells">;
