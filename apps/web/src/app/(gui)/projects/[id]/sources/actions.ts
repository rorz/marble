"use server";

import type { Database } from "@marble/supabase";
import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/env";
import { requireUser } from "../../../../../lib/auth";
import { callMarbleApi } from "../../../../../lib/marble-api";

type SourceRow = Database["public"]["Tables"]["source"]["Row"];
type SourceEventRow = Database["public"]["Tables"]["source_event"]["Row"];
type PipeRow = Database["public"]["Tables"]["pipe"]["Row"];

type PipeMappingInput = {
  columnId: string;
  jsonPath: string;
};

function revalidateProjectIngressPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/sources`);
}

const SOURCE_SCHEMA_INFERENCE_MODEL = "google/gemini-3.1-flash-lite-preview";

const inferredSourceSchemaResultSchema = z.object({
  jsonSchema: z
    .string()
    .min(2)
    .describe(
      "A JSON string containing exactly one valid JSON Schema object for the selected webhook event payload.",
    ),
});

function normalizeInferredSourceSchema(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Inferred schema was not valid JSON: ${error.message}`
        : "Inferred schema was not valid JSON.",
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Inferred schema must be a JSON schema object.");
  }

  try {
    z.fromJSONSchema(parsed as z.core.JSONSchema.Schema);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Inferred schema could not be compiled: ${error.message}`
        : "Inferred schema could not be compiled.",
    );
  }

  return parsed;
}

export async function createSourceAction(
  projectId: string,
  input: {
    name?: string;
    payloadSchema?: unknown;
  } = {},
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

export async function inferSourceSchemaFromEventAction(
  projectId: string,
  sourceEventId: string,
) {
  await requireUser();

  if (!env.AI_GATEWAY_API_KEY) {
    throw new Error("AI_GATEWAY_API_KEY is required to infer source schemas.");
  }

  const sourceEvent = await callMarbleApi<SourceEventRow>(
    `/source-events/${sourceEventId}`,
    {
      method: "GET",
      requestId: crypto.randomUUID(),
    },
  );

  if (sourceEvent.project_id !== projectId) {
    throw new Error("Selected event does not belong to this project.");
  }

  const { object } = await generateObject({
    model: SOURCE_SCHEMA_INFERENCE_MODEL,
    prompt: [
      "Infer a practical JSON Schema for validating webhook payloads.",
      "Use the selected event payload as the only example.",
      "Return a schema that accepts payloads with the same shape while avoiding overfitting to literal example values.",
      "Use root type object for object payloads.",
      "Include properties and required keys present in the sample.",
      "Use simple JSON Schema keywords only: type, properties, required, items, enum, additionalProperties, description.",
      "Set additionalProperties to true unless the sample clearly represents a closed object.",
      'For nullable values, use a type array such as ["string", "null"].',
      "Do not include markdown.",
      "",
      "Selected event payload:",
      JSON.stringify(sourceEvent.raw_payload, null, 2),
    ].join("\n"),
    schema: inferredSourceSchemaResultSchema,
  });

  return normalizeInferredSourceSchema(object.jsonSchema);
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
    mappings?: PipeMappingInput[];
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
