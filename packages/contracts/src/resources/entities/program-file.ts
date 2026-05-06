import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema } from "../base";

const tags = [
  "Program Files",
] as const;

export const ProgramFileSchema = z.object({
  ...baseEntitySchema.shape,
  content: z.string(),
  filename: z.string(),
  filetype: z.enum([
    "Json",
    "Markdown",
    "TypeScript",
  ]),
  ownerProfileId: baseEntitySchema.shape.id,
  versionId: baseEntitySchema.shape.id,
});

const ProgramFileWriteSchema = ProgramFileSchema.pick({
  content: true,
  filename: true,
  filetype: true,
});

export const programFileOperations = defineResourceOperations({
  create: {
    input: ProgramFileWriteSchema.extend({
      versionId: ProgramFileSchema.shape.versionId,
    }),
    output: ProgramFileSchema,
    route: {
      method: "POST",
      operationId: "programFiles.create",
      path: "/program-files",
      summary: "Create a program file",
      tags,
    },
  },
  delete: {
    input: ProgramFileSchema.pick({
      id: true,
    }),
    output: ProgramFileSchema,
    route: {
      method: "DELETE",
      operationId: "programFiles.delete",
      path: "/program-files/{id}",
      summary: "Delete a program file",
      tags,
    },
  },
  get: {
    input: ProgramFileSchema.pick({
      id: true,
    }),
    output: ProgramFileSchema,
    route: {
      method: "GET",
      operationId: "programFiles.get",
      path: "/program-files/{id}",
      summary: "Get a program file",
      tags,
    },
  },
  list: {
    input: z
      .object({
        versionId: ProgramFileSchema.shape.versionId.optional(),
        versionIds: z.array(ProgramFileSchema.shape.versionId).optional(),
      })
      .optional(),
    output: z.array(ProgramFileSchema),
    route: {
      method: "GET",
      operationId: "programFiles.list",
      path: "/program-files",
      summary: "List program files",
      tags,
    },
  },
  syncForVersion: {
    input: z.object({
      files: z.array(ProgramFileWriteSchema),
      versionId: ProgramFileSchema.shape.versionId,
    }),
    output: z.array(ProgramFileSchema),
    route: {
      method: "POST",
      operationId: "programFiles.syncForVersion",
      path: "/program-files/sync",
      summary: "Sync files for a program version",
      tags,
    },
  },
  update: {
    input: ProgramFileSchema.pick({
      id: true,
    }).extend({
      values: ProgramFileWriteSchema.partial(),
    }),
    output: ProgramFileSchema,
    route: {
      method: "PATCH",
      operationId: "programFiles.update",
      path: "/program-files/{id}",
      summary: "Update a program file",
      tags,
    },
  },
});
