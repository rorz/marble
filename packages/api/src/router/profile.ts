import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const profileRouter = {
  create: os.profiles.create.handler(({ context, input }) =>
    context.store.profiles.create(input),
  ),
  delete: os.profiles.delete.handler(({ context, input }) =>
    context.store.profiles.delete(input.id),
  ),
  get: os.profiles.get.handler(({ context, input }) =>
    context.store.profiles.get(input.id),
  ),
  list: os.profiles.list.handler(({ context, input }) =>
    context.store.profiles.list(input),
  ),
  update: os.profiles.update.handler(({ context, input }) =>
    context.store.profiles.update(input.id, input.values),
  ),
} satisfies RouterResourcePart<"profiles">;
