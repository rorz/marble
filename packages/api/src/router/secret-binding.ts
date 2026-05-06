import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const secretBindingRouter = {
  listColumns: os.secretBindings.listColumns.handler(({ context, input }) =>
    context.store.secretBindings.listColumns(input),
  ),
  listPrograms: os.secretBindings.listPrograms.handler(({ context, input }) =>
    context.store.secretBindings.listPrograms(input),
  ),
  setColumn: os.secretBindings.setColumn.handler(({ context, input }) =>
    context.store.secretBindings.setColumn(input),
  ),
  setProgram: os.secretBindings.setProgram.handler(({ context, input }) =>
    context.store.secretBindings.setProgram(input),
  ),
} satisfies RouterResourcePart<"secretBindings">;
