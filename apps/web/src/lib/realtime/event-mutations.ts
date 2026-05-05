import type { Database } from "@marble/supabase";
import {
  createBroadcastMutationGuard,
  type DeleteMutation,
  type UpsertMutation,
} from "./broadcast-mutations";

type EventRow = Database["public"]["Tables"]["event"]["Row"];

type EventMutation =
  | DeleteMutation<"event:delete", EventRow>
  | UpsertMutation<"event:upsert", EventRow>;

const eventMutationTypes = {
  "event:delete": true,
  "event:upsert": true,
} satisfies Record<EventMutation["type"], true>;

export const isEventMutation =
  createBroadcastMutationGuard<EventMutation>(eventMutationTypes);
