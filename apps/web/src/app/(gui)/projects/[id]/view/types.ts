import type {
  DeleteMutation,
  UpsertMutation,
} from "../../../../../lib/realtime/broadcast-mutations";
import { createBroadcastMutationGuard } from "../../../../../lib/realtime/broadcast-mutations";
import {
  compareByUpdatedAtCamelDesc,
  sortRows,
} from "../../../../../lib/realtime-crud";
import type { ProjectSourceWorkspaceData } from "../../../../../lib/source-data";

export type ProjectInfo = ProjectSourceWorkspaceData;
export type ProjectState = ProjectInfo["project"];
type BroadcastRow = Record<string, unknown>;
export type ProjectMutation =
  | DeleteMutation<"pipe:delete", BroadcastRow>
  | DeleteMutation<"project:delete", BroadcastRow>
  | DeleteMutation<"source:delete", BroadcastRow>
  | DeleteMutation<"table:delete", BroadcastRow>
  | UpsertMutation<"pipe:upsert", BroadcastRow>
  | UpsertMutation<"project:upsert", BroadcastRow>
  | UpsertMutation<"source:upsert", BroadcastRow>
  | UpsertMutation<"table:upsert", BroadcastRow>;

export const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const buildSectionHeading = (label: string, count: number): string => {
  return count > 0 ? `${label} (${count})` : label;
};

export const sortTables = (
  tables: ProjectState["tables"],
): ProjectState["tables"] => {
  return sortRows(tables, compareByUpdatedAtCamelDesc);
};

const projectMutationTypes = {
  "pipe:delete": true,
  "pipe:upsert": true,
  "project:delete": true,
  "project:upsert": true,
  "source:delete": true,
  "source:upsert": true,
  "table:delete": true,
  "table:upsert": true,
} as const satisfies Record<ProjectMutation["type"], true>;

export const isProjectMutation =
  createBroadcastMutationGuard<ProjectMutation>(projectMutationTypes);
