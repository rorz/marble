import { z } from "zod";
import { defineResourceOperations } from "../../helpers";
import { baseEntitySchema, jsonValueSchema } from "../base";
import { ProgramFileSchema } from "./program-file";
import { ProgramVersionSchema } from "./program-version";

const tags = [
  "Programs",
] as const;

export const ENVIRONMENT_VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const environmentVariableNameSchema = z
  .string()
  .trim()
  .refine(
    (value) => ENVIRONMENT_VARIABLE_NAME_PATTERN.test(value),
    "Environment variable names must be valid shell identifiers.",
  );

export const ProgramSecretDeclarationSchema = z.object({
  description: z.string().trim().min(1).optional(),
  env: environmentVariableNameSchema,
  label: z.string().trim().min(1),
  required: z.boolean(),
});

const programSecretDeclarationInputSchema = z.union([
  environmentVariableNameSchema.transform((env) => ({
    env,
    label: env,
    required: true,
  })),
  z
    .object({
      description: z.string().trim().min(1).optional(),
      env: environmentVariableNameSchema,
      label: z.string().trim().min(1).optional(),
      required: z.boolean().optional(),
    })
    .transform((value) => ({
      description: value.description,
      env: value.env,
      label: value.label ?? value.env,
      required: value.required ?? true,
    })),
]);

export const ProgramSecretConfigSchema = z
  .array(programSecretDeclarationInputSchema)
  .superRefine((secrets, ctx) => {
    const seenEnvNames = new Set<string>();

    for (const [index, secret] of secrets.entries()) {
      const parsedSecret = ProgramSecretDeclarationSchema.safeParse(secret);

      if (!parsedSecret.success) {
        for (const issue of parsedSecret.error.issues) {
          ctx.addIssue({
            ...issue,
            path: [
              index,
              ...issue.path,
            ],
          });
        }
        continue;
      }

      if (seenEnvNames.has(parsedSecret.data.env)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate secret declaration for '${parsedSecret.data.env}'.`,
          path: [
            index,
            "env",
          ],
        });
        continue;
      }

      seenEnvNames.add(parsedSecret.data.env);
    }
  });

const programManifestSchema = z
  .object({
    marble: z
      .object({
        secrets: ProgramSecretConfigSchema.optional(),
      })
      .passthrough()
      .optional(),
    name: z.string().trim().min(1),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const parsedSecrets = ProgramSecretConfigSchema.safeParse(
      value.marble?.secrets ?? [],
    );

    if (parsedSecrets.success) {
      return;
    }

    for (const issue of parsedSecrets.error.issues) {
      ctx.addIssue({
        ...issue,
        path: [
          "marble",
          "secrets",
          ...issue.path,
        ],
      });
    }
  });

export type ProgramManifest = z.infer<typeof programManifestSchema>;
export type ProgramManifestSecretDeclaration = z.infer<
  typeof ProgramSecretDeclarationSchema
>;
export type ProgramSecretConfig = ProgramManifestSecretDeclaration[];

export function parseProgramSecretConfig(input: unknown): ProgramSecretConfig {
  return ProgramSecretConfigSchema.parse(input).map((secret) =>
    ProgramSecretDeclarationSchema.parse(secret),
  );
}

export function parseProgramManifest(input: unknown): ProgramManifest {
  const parsed = programManifestSchema.parse(input);
  return {
    ...parsed,
    ...(parsed.marble === undefined
      ? {}
      : {
          marble: {
            ...parsed.marble,
            ...(parsed.marble.secrets === undefined
              ? {}
              : {
                  secrets: parseProgramSecretConfig(parsed.marble.secrets),
                }),
          },
        }),
  };
}

export function parseProgramManifestFileContent(content: string) {
  return parseProgramManifest(JSON.parse(content) as unknown);
}

export function listProgramSecretDeclarationsFromManifest(input: unknown) {
  return parseProgramManifest(input).marble?.secrets ?? [];
}

export function listProgramSecretDeclarationsFromFiles(
  files: Array<{
    content: string;
    filename: string;
  }>,
) {
  const manifestFile = files.find((file) => file.filename === "package.json");

  if (!manifestFile) {
    return [] as ProgramManifestSecretDeclaration[];
  }

  return listProgramSecretDeclarationsFromManifest(
    JSON.parse(manifestFile.content) as unknown,
  );
}

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
