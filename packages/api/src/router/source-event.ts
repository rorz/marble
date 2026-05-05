import type { ApiContext } from "../context";
import { os } from "../server";
import type { RouterResourcePart } from "../types";

async function timeStoreCall<T>(
  context: ApiContext,
  name: string,
  task: () => Promise<T>,
) {
  const startedAt = performance.now();

  try {
    return await task();
  } finally {
    context.recordTiming(name, performance.now() - startedAt);
  }
}

export const sourceEventRouter = {
  create: os.sourceEvents.create.handler(({ context, input }) =>
    timeStoreCall(context, "store_source_events_create", () =>
      context.store.sourceEvents.create(input),
    ),
  ),
  get: os.sourceEvents.get.handler(({ context, input }) =>
    timeStoreCall(context, "store_source_events_get", () =>
      context.store.sourceEvents.get(input),
    ),
  ),
  list: os.sourceEvents.list.handler(({ context, input }) =>
    timeStoreCall(context, "store_source_events_list", () =>
      context.store.sourceEvents.list(input),
    ),
  ),
} satisfies RouterResourcePart<"sourceEvents">;
