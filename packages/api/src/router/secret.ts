import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const secretRouter = {
  create: os.secrets.create.handler(({ context, input }) =>
    context.store.secrets.create(input),
  ),
  delete: os.secrets.delete.handler(({ context, input }) =>
    context.store.secrets.delete(input),
  ),
  get: os.secrets.get.handler(({ context, input }) =>
    context.store.secrets.get(input),
  ),
  list: os.secrets.list.handler(({ context, input }) =>
    context.store.secrets.list(input),
  ),
  update: os.secrets.update.handler(({ context, input }) =>
    context.store.secrets.update(input),
  ),
} satisfies RouterResourcePart<"secrets">;
