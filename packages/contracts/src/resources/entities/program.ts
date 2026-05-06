import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema, jsonValueSchema } from "../base";
import { ProgramFileSchema } from "./program-file";
import { ProgramVersionSchema } from "./program-version";

const tags = [
  "Programs",
] as const;

const ProgramSchema = z.object({
  ...baseEntitySchema.shape,
  firstParty: z.boolean(),
  forkedFromVersionId: baseEntitySchema.shape.id.nullable(),
  name: z.string(),
  ownerProfileId: baseEntitySchema.shape.id,
});

const InitialProgramVersionSchema = z.object({
  inputSchema: jsonValueSchema,
  outputConfig: jsonValueSchema,
  publish: z.boolean().optional(),
  secretConfig: jsonValueSchema.optional(),
});

const ProgramEditorDataSchema = z.object({
  programFiles: z.array(ProgramFileSchema),
  programs: z.array(ProgramSchema),
  programVersions: z.array(ProgramVersionSchema),
});

export const programOperations = defineResourceOperations({
  create: {
    input: ProgramSchema.pick({
      name: true,
    }).extend({
      initialVersion: InitialProgramVersionSchema.optional(),
    }),
    output: ProgramSchema.extend({
      initialVersion: ProgramVersionSchema.optional(),
    }),
    route: {
      method: "POST",
      operationId: "programs.create",
      path: "/programs",
      summary: "Create a program",
      tags,
    },
  },
  listForEditor: {
    input: z.object({}),
    output: ProgramEditorDataSchema,
    route: {
      description:
        "Returns first-party programs and programs owned by the current user, including versions and files for editor surfaces.",
      method: "GET",
      operationId: "programs.listForEditor",
      path: "/programs/editor",
      summary: "List programs for editor",
      tags,
    },
  },
  update: {
    input: ProgramSchema.pick({
      id: true,
    }).extend({
      values: ProgramSchema.pick({
        name: true,
      }).partial(),
    }),
    output: ProgramSchema,
    route: {
      method: "PATCH",
      operationId: "programs.update",
      path: "/programs/{id}",
      summary: "Update a program",
      tags,
    },
  },
});
