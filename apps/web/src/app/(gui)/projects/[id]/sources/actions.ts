"use server";

import type { Database } from "@marble/supabase";
import { revalidatePath } from "next/cache";
import { requireUser } from "../../../../../lib/auth";
import { callMarbleApi } from "../../../../../lib/marble-api";

type SourceRow = Database["public"]["Tables"]["source"]["Row"];
type PipeRow = Database["public"]["Tables"]["pipe"]["Row"];

type PipeMappingInput = {
  columnId: string;
  jsonPath: string;
};

function revalidateProjectIngressPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sources`);
  revalidatePath(`/projects/${projectId}/sources/new`);
  revalidatePath(`/projects/${projectId}/pipes/new`);
}

export async function createSourceAction(
  projectId: string,
  input: {
    name?: string;
    payloadSchema: unknown;
  },
) {
  await requireUser();

  const source = await callMarbleApi<SourceRow>(
    `/projects/${projectId}/sources`,
    {
      body: input,
      method: "POST",
      requestId: crypto.randomUUID(),
    },
  );

  revalidateProjectIngressPaths(projectId);
  return source;
}

export async function updateSourceAction(
  projectId: string,
  sourceId: string,
  input: {
    name?: string;
    payloadSchema?: unknown;
  },
) {
  await requireUser();

  const source = await callMarbleApi<SourceRow>(`/sources/${sourceId}`, {
    body: input,
    method: "PATCH",
    requestId: crypto.randomUUID(),
  });

  revalidateProjectIngressPaths(projectId);
  return source;
}

export async function deleteSourceAction(projectId: string, sourceId: string) {
  await requireUser();

  await callMarbleApi(`/sources/${sourceId}`, {
    method: "DELETE",
    requestId: crypto.randomUUID(),
  });

  revalidateProjectIngressPaths(projectId);
}

export async function createPipeAction(
  projectId: string,
  input: {
    mappings: PipeMappingInput[];
    sourceId: string;
    tableId: string;
  },
) {
  await requireUser();

  const pipe = await callMarbleApi<PipeRow>(`/projects/${projectId}/pipes`, {
    body: input,
    method: "POST",
    requestId: crypto.randomUUID(),
  });

  revalidateProjectIngressPaths(projectId);
  return pipe;
}

export async function updatePipeAction(
  projectId: string,
  pipeId: string,
  input: {
    mappings?: PipeMappingInput[];
    sourceId?: string;
    tableId?: string;
  },
) {
  await requireUser();

  const pipe = await callMarbleApi<PipeRow>(`/pipes/${pipeId}`, {
    body: input,
    method: "PATCH",
    requestId: crypto.randomUUID(),
  });

  revalidateProjectIngressPaths(projectId);
  return pipe;
}

export async function deletePipeAction(projectId: string, pipeId: string) {
  await requireUser();

  await callMarbleApi(`/pipes/${pipeId}`, {
    method: "DELETE",
    requestId: crypto.randomUUID(),
  });

  revalidateProjectIngressPaths(projectId);
}
