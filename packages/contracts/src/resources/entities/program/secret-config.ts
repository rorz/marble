import { z } from "zod";

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

export type ProgramManifestSecretDeclaration = z.infer<
  typeof ProgramSecretDeclarationSchema
>;
export type ProgramSecretConfig = ProgramManifestSecretDeclaration[];

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
      ...(value.description === undefined
        ? {}
        : {
            description: value.description,
          }),
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

const programSecretInterfacePropertySchema = z
  .object({
    description: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
    type: z.literal("string").optional(),
  })
  .passthrough();

const emptyProgramSecretInterface = {
  properties: {},
  required: [],
  type: "object",
} as const;

const programSecretInterfaceSchema = z
  .object({
    properties: z
      .record(z.string(), programSecretInterfacePropertySchema)
      .optional()
      .default({}),
    required: z.array(environmentVariableNameSchema).optional().default([]),
    type: z.literal("object").optional().default("object"),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const propertyNames = new Set(Object.keys(value.properties));
    const seenRequiredNames = new Set<string>();

    for (const envName of propertyNames) {
      const parsedEnvName = environmentVariableNameSchema.safeParse(envName);

      if (!parsedEnvName.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Secret property names must be valid shell identifiers.",
          path: [
            "properties",
            envName,
          ],
        });
      }
    }

    for (const [index, envName] of value.required.entries()) {
      if (seenRequiredNames.has(envName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate required secret '${envName}'.`,
          path: [
            "required",
            index,
          ],
        });
        continue;
      }

      if (!propertyNames.has(envName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Required secret '${envName}' must be declared in secrets.properties.`,
          path: [
            "required",
            index,
          ],
        });
      }

      seenRequiredNames.add(envName);
    }
  })
  .transform((value) => {
    const requiredNames = new Set(value.required);

    return Object.entries(value.properties)
      .sort(([leftEnvName], [rightEnvName]) =>
        leftEnvName.localeCompare(rightEnvName),
      )
      .map(([env, property]) => ({
        ...(property.description === undefined
          ? {}
          : {
              description: property.description,
            }),
        env,
        label: property.title ?? env,
        required: requiredNames.has(env),
      })) satisfies ProgramSecretConfig;
  });

export const ProgramSecretInterfaceConfigSchema = z.preprocess(
  (value) => value ?? emptyProgramSecretInterface,
  programSecretInterfaceSchema,
);

export const parseProgramSecretConfig = (
  input: unknown,
): ProgramSecretConfig => {
  return ProgramSecretConfigSchema.parse(input).map((secret) =>
    ProgramSecretDeclarationSchema.parse(secret),
  );
};
