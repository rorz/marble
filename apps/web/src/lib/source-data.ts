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
type PipeRow = Database["public"]["Tables"]["pipe"]["Row"];

export type ProjectSourceWorkspaceData = {
  pipes: PipeRow[];
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
  const [sourceEventResult, pipeResult, inputColumns] = await Promise.all([
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
          .from("pipe")
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

  if (pipeResult.error) {
    throw pipeResult.error;
  }

  return {
    inputColumns: inputColumns.filter(
      (column) =>
        column.project_id === projectId && column.allow_manual_input === true,
    ),
    pipes: (pipeResult.data ?? []) as PipeRow[],
    project,
    sourceEvents: (sourceEventResult.data ?? []) as SourceEventRow[],
    sources,
    webhookBaseUrl: env.MARBLE_INGESTOR_URL.replace(/\/$/, ""),
  } satisfies ProjectSourceWorkspaceData;
}
