import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const programRouter = {
  create: os.programs.create.handler(({ context, input }) =>
    context.store.programs.create(input),
  ),
  listForEditor: os.programs.listForEditor.handler(({ context }) =>
    context.store.programs.listForEditor(),
  ),
  update: os.programs.update.handler(({ context, input }) =>
    context.store.programs.update(input),
  ),
} satisfies RouterResourcePart<"programs">;
