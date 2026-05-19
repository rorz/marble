import { withTiming } from "@marble/lib/timing";
import type { ApiContext } from "../../context";
import { os } from "../../server";
import type { RouterResourcePart } from "../../types";

const timeStoreCall = async <T>(
  context: ApiContext,
  name: string,
  task: () => Promise<T>,
) => {
  return withTiming(
    (timingName, durationMs) => context.recordTiming(timingName, durationMs),
    name,
    task,
  );
};

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
