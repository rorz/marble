"use server";

import { generateObject } from "ai";
import { z } from "zod";
import { requireUser } from "../../../../../lib/auth";
import { createServerMarbleSdkForProject } from "../../../../../lib/marble-sdk-server";

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

export async function inferSourceSchemaFromEventAction(
  projectId: string,
  sourceEventId: string,
) {
  await requireUser();

  const resolved = await createServerMarbleSdkForProject(projectId);

  if (!resolved) {
    throw new Error("Project not found.");
  }

  const sourceEvent = await resolved.sdk.sourceEvents.get({
    id: sourceEventId,
  });

  if (sourceEvent.projectId !== projectId) {
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
      JSON.stringify(sourceEvent.rawPayload, null, 2),
    ].join("\n"),
    schema: inferredSourceSchemaResultSchema,
  });

  return normalizeInferredSourceSchema(object.jsonSchema);
}
