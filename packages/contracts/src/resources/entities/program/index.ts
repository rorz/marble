import { parseJsonc } from "@marble/lib/json";
import { isPlainRecord } from "@marble/lib/object";
import { z } from "zod";
import { defineResourceOperations } from "../../../orpc";
import { baseEntitySchema, jsonValueSchema } from "../../base";
import { ProgramFileSchema } from "../program-file";
import {
  ProgramInputSchema,
  ProgramOutputConfig,
  ProgramVersionSchema,
} from "../program-version";
import { ProgramSecretInterfaceConfigSchema } from "./secret-config";

export {
  ENVIRONMENT_VARIABLE_NAME_PATTERN,
  type ProgramManifestSecretDeclaration,
  type ProgramSecretConfig,
  ProgramSecretConfigSchema,
  ProgramSecretDeclarationSchema,
  parseProgramSecretConfig,
} from "./secret-config";

const tags = [
  "Programs",
] as const;

export const PROGRAM_CONFIG_FILENAME = "marbleconfig.jsonc";

const programManifestSchema = z
  .object({
    name: z.string().trim().min(1),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (isPlainRecord(value.marble) && "secrets" in value.marble) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Secret declarations belong in marbleconfig.jsonc under secrets.properties.",
        path: [
          "marble",
          "secrets",
        ],
      });
    }
  });

export type ProgramManifest = z.infer<typeof programManifestSchema>;
export const parseProgramManifest = (input: unknown): ProgramManifest => {
  return programManifestSchema.parse(input);
};

export const parseProgramManifestFileContent = (content: string) => {
  return parseProgramManifest(JSON.parse(content) as unknown);
};

export const ProgramConfigSchema = z
  .object({
    inputSchema: ProgramInputSchema,
    outputConfig: ProgramOutputConfig,
    secrets: ProgramSecretInterfaceConfigSchema,
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if ("secretConfig" in value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Secret declarations belong in marbleconfig.jsonc under secrets.properties.",
        path: [
          "secretConfig",
        ],
      });
    }
  });
export type ProgramConfig = z.infer<typeof ProgramConfigSchema>;

export const parseProgramConfig = (input: unknown): ProgramConfig => {
  return ProgramConfigSchema.parse(input);
};

export const parseProgramConfigFileContent = (content: string) => {
  return parseProgramConfig(parseJsonc(content));
};

export const parseProgramConfigFromFiles = (
  files: Array<{
    content: string;
    filename: string;
  }>,
) => {
  const configFile = files.find(
    (file) => file.filename === PROGRAM_CONFIG_FILENAME,
  );

  if (!configFile) {
    throw new Error(`Program files must include ${PROGRAM_CONFIG_FILENAME}.`);
  }

  return parseProgramConfigFileContent(configFile.content);
};

export const listProgramSecretDeclarationsFromFiles = (
  files: Array<{
    content: string;
    filename: string;
  }>,
) => {
  return parseProgramConfigFromFiles(files).secrets;
};

const ProgramSchema = z.object({
  ...baseEntitySchema.shape,
  firstParty: z.boolean(),
  forkedFromVersionId: baseEntitySchema.shape.id.nullable(),
  name: z.string(),
  ownerProfileId: baseEntitySchema.shape.id,
});

const InitialProgramVersionSchema = z.object({
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
      forkedFromVersionId: ProgramSchema.shape.forkedFromVersionId.optional(),
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
  delete: {
    input: ProgramSchema.pick({
      id: true,
    }),
    output: ProgramSchema,
    route: {
      method: "DELETE",
      operationId: "programs.delete",
      path: "/programs/{id}",
      summary: "Delete a program",
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
