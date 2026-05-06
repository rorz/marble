import {
  createBroadcastMutationGuard,
  type DeleteMutation,
  type UpsertMutation,
} from "./broadcast-mutations";

type EventMutation =
  | DeleteMutation<"event:delete", Record<string, unknown>>
  | UpsertMutation<"event:upsert", Record<string, unknown>>;

const eventMutationTypes = {
  "event:delete": true,
  "event:upsert": true,
} satisfies Record<EventMutation["type"], true>;

export const isEventMutation =
  createBroadcastMutationGuard<EventMutation>(eventMutationTypes);
