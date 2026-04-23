"use server";

import type { Database } from "@marble/supabase";
import { revalidatePath } from "next/cache";
import { requireUser } from "../../../../../lib/auth";
import { callMarbleApi } from "../../../../../lib/marble-api";

type SourceRow = Database["public"]["Tables"]["source"]["Row"];
type DrainRow = Database["public"]["Tables"]["drain"]["Row"];

type DrainMappingInput = {
  columnId: string;
  jsonPath: string;
};

function revalidateProjectIngressPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sources`);
  revalidatePath(`/projects/${projectId}/sources/new`);
  revalidatePath(`/projects/${projectId}/drains/new`);
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

export async function createDrainAction(
  projectId: string,
  input: {
    mappings: DrainMappingInput[];
    name?: string;
    sourceId: string;
    tableId: string;
  },
) {
  await requireUser();

  const drain = await callMarbleApi<DrainRow>(`/projects/${projectId}/drains`, {
    body: input,
    method: "POST",
    requestId: crypto.randomUUID(),
  });

  revalidateProjectIngressPaths(projectId);
  return drain;
}

export async function updateDrainAction(
  projectId: string,
  drainId: string,
  input: {
    mappings?: DrainMappingInput[];
    name?: string;
    sourceId?: string;
    tableId?: string;
  },
) {
  await requireUser();

  const drain = await callMarbleApi<DrainRow>(`/drains/${drainId}`, {
    body: input,
    method: "PATCH",
    requestId: crypto.randomUUID(),
  });

  revalidateProjectIngressPaths(projectId);
  return drain;
}

export async function deleteDrainAction(projectId: string, drainId: string) {
  await requireUser();

  await callMarbleApi(`/drains/${drainId}`, {
    method: "DELETE",
    requestId: crypto.randomUUID(),
  });

  revalidateProjectIngressPaths(projectId);
}
