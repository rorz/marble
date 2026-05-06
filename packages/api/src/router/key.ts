import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const keyRouter = {
  create: os.keys.create.handler(({ context, input }) =>
    context.store.keys.create(input),
  ),
  list: os.keys.list.handler(({ context, input }) =>
    context.store.keys.list(input),
  ),
  revoke: os.keys.revoke.handler(({ context, input }) =>
    context.store.keys.revoke(input.id),
  ),
} satisfies RouterResourcePart<"keys">;
