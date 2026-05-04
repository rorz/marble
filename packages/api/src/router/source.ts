import { os } from "../server";
import type { RouterResourcePart } from "../types";

export const sourceRouter = {
  get: os.sources.get.handler(({ context, input }) =>
    context.store.sources.get(input),
  ),
} satisfies RouterResourcePart<"sources">;
