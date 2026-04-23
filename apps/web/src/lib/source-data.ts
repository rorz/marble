import "server-only";
import type { Database } from "@marble/supabase";
import { env } from "@/env";
import {
  getOwnedProjectForUser,
  listReferenceableColumnsForUser,
  type ReferenceableColumn,
} from "./project-data";
import { createServiceRoleClient } from "./supabase/service-role";

type SourceRow = Database["public"]["Tables"]["source"]["Row"];
type SourceEventRow = Database["public"]["Tables"]["source_event"]["Row"];
type DrainRow = Database["public"]["Tables"]["drain"]["Row"];

export type ProjectSourceWorkspaceData = {
  drains: DrainRow[];
  inputColumns: ReferenceableColumn[];
  project: NonNullable<Awaited<ReturnType<typeof getOwnedProjectForUser>>>;
  sourceEvents: SourceEventRow[];
  sources: SourceRow[];
  webhookBaseUrl: string;
};

function db() {
  return createServiceRoleClient();
}

export async function getProjectSourceWorkspaceData(
  userId: string,
  projectId: string,
) {
  const project = await getOwnedProjectForUser(userId, projectId);

  if (!project) {
    return null;
  }

  const supabase = db();
  const { data: sourceData, error: sourceError } = await supabase
    .from("source")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", {
      ascending: false,
    });

  if (sourceError) {
    throw sourceError;
  }

  const sources = (sourceData ?? []) as SourceRow[];
  const sourceIds = sources.map((source) => source.id);
  const [sourceEventResult, drainResult, inputColumns] = await Promise.all([
    supabase
      .from("source_event")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", {
        ascending: false,
      })
      .limit(120),
    sourceIds.length === 0
      ? Promise.resolve({
          data: [],
          error: null,
        })
      : supabase
          .from("drain")
          .select("*")
          .in("source_id", sourceIds)
          .order("created_at", {
            ascending: false,
          }),
    listReferenceableColumnsForUser(userId),
  ]);

  if (sourceEventResult.error) {
    throw sourceEventResult.error;
  }

  if (drainResult.error) {
    throw drainResult.error;
  }

  return {
    drains: (drainResult.data ?? []) as DrainRow[],
    inputColumns: inputColumns.filter(
      (column) =>
        column.project_id === projectId && column.allow_manual_input === true,
    ),
    project,
    sourceEvents: (sourceEventResult.data ?? []) as SourceEventRow[],
    sources,
    webhookBaseUrl: env.MARBLE_INGESTOR_URL.replace(/\/$/, ""),
  } satisfies ProjectSourceWorkspaceData;
}
