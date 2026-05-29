import { createBroadcastMutationGuard } from "@/lib/realtime/broadcast-mutations";
import type { TableMutation } from "./types";

export const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const tableMutationTypes = {
  "cell:delete": true,
  "cell:upsert": true,
  "column:delete": true,
  "column:upsert": true,
  "row:delete": true,
  "row:upsert": true,
  "table:delete": true,
  "table:upsert": true,
} satisfies Record<TableMutation["type"], true>;

export const isTableMutation =
  createBroadcastMutationGuard<TableMutation>(tableMutationTypes);
