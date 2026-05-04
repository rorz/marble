import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const pipeRouter = {
  create: os.pipes.create.handler(({ context, input }) =>
    context.store.pipes.create(input),
  ),
  delete: os.pipes.delete.handler(({ context, input }) =>
    context.store.pipes.delete(input),
  ),
  get: os.pipes.get.handler(({ context, input }) =>
    context.store.pipes.get(input),
  ),
  list: os.pipes.list.handler(({ context, input }) =>
    context.store.pipes.list(input),
  ),
  update: os.pipes.update.handler(({ context, input }) =>
    context.store.pipes.update(input),
  ),
} satisfies RouterResourcePart<"pipes">;
