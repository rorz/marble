import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema, jsonValueSchema, timestampSchema } from "../base";

const tags = [
  "Program Versions",
] as const;

export const ProgramVersionSchema = z.object({
  ...baseEntitySchema.shape,
  inputSchema: jsonValueSchema,
  outputConfig: jsonValueSchema,
  programId: baseEntitySchema.shape.id,
  publishedAt: timestampSchema.nullable(),
  secretConfig: jsonValueSchema.nullable(),
  version: z.number().int().positive().nullable(),
});

const ProgramVersionWriteSchema = z.object({
  inputSchema: jsonValueSchema.optional(),
  outputConfig: jsonValueSchema.optional(),
  publish: z.boolean().optional(),
  secretConfig: jsonValueSchema.optional(),
  version: z.number().int().positive().optional(),
});

export const programVersionOperations = defineResourceOperations({
  create: {
    input: ProgramVersionWriteSchema.extend({
      inputSchema: jsonValueSchema,
      outputConfig: jsonValueSchema,
      programId: baseEntitySchema.shape.id,
    }),
    output: ProgramVersionSchema,
    route: {
      method: "POST",
      operationId: "programVersions.create",
      path: "/program-versions",
      summary: "Create a program version",
      tags,
    },
  },
  test: {
    input: z.object({
      inputConfig: z.record(z.string(), jsonValueSchema),
      manualInput: z.string().optional(),
      programVersionId: baseEntitySchema.shape.id,
    }),
    output: z.object({
      detail: jsonValueSchema.optional(),
      error: z.string().optional(),
      errorType: z.string().optional(),
      ok: z.boolean(),
      output: jsonValueSchema,
    }),
    route: {
      method: "POST",
      operationId: "programVersions.test",
      path: "/program-versions/{programVersionId}/test",
      summary: "Test a program version",
      tags,
    },
  },
  update: {
    input: z.object({
      id: baseEntitySchema.shape.id,
      values: ProgramVersionWriteSchema,
    }),
    output: ProgramVersionSchema,
    route: {
      method: "PATCH",
      operationId: "programVersions.update",
      path: "/program-versions/{id}",
      summary: "Update a program version",
      tags,
    },
  },
});
