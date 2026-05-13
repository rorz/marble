import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const profileRouter = {
  get: os.profiles.get.handler(({ context, input }) =>
    context.store.profiles.get(input),
  ),
  list: os.profiles.list.handler(({ context, input }) =>
    context.store.profiles.list(input),
  ),
  update: os.profiles.update.handler(({ context, input }) =>
    context.store.profiles.update(input),
  ),
} satisfies RouterResourcePart<"profiles">;
