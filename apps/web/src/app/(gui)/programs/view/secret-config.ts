import {
  ENVIRONMENT_VARIABLE_NAME_PATTERN,
  type ProgramManifestSecretDeclaration,
  type ProgramSecretConfig,
  parseProgramSecretConfig,
} from "@marble/contracts";
import { getErrorMessage } from "@marble/lib/result";
import type {
  EditableProgramSecretDeclaration,
  MissingSecretConfigurationDetail,
  SecretBindingInput,
  SecretRecord,
} from "./types";

export const normalizeStoredProgramSecretConfig = (secretConfig: unknown) => {
  try {
    return parseProgramSecretConfig(secretConfig ?? []);
  } catch {
    return [] satisfies ProgramSecretConfig;
  }
};

export const createEditableProgramSecretDeclarations = (
  secretConfig: unknown,
) => {
  return normalizeStoredProgramSecretConfig(secretConfig).map((secret) => ({
    description: secret.description ?? "",
    env: secret.env,
    id: crypto.randomUUID(),
    label: secret.label,
    required: secret.required,
  })) satisfies EditableProgramSecretDeclaration[];
};

const serializeEditableProgramSecretConfig = (
  secretConfigDraft: EditableProgramSecretDeclaration[],
) => {
  return secretConfigDraft.map((secret) => {
    const envName = secret.env.trim();

    return {
      ...(secret.description.trim().length > 0
        ? {
            description: secret.description.trim(),
          }
        : {}),
      env: envName,
      label: secret.label.trim().length > 0 ? secret.label.trim() : envName,
      required: secret.required,
    };
  });
};

export const getEditableProgramSecretConfigState = (
  secretConfigDraft: EditableProgramSecretDeclaration[],
) => {
  try {
    return {
      declarations: parseProgramSecretConfig(
        serializeEditableProgramSecretConfig(secretConfigDraft),
      ),
      error: null,
    };
  } catch (error) {
    return {
      declarations: [] as ProgramManifestSecretDeclaration[],
      error: getErrorMessage(error),
    };
  }
};

export const getProgramSecretConfigComparisonValue = (
  secretConfig: unknown,
) => {
  return JSON.stringify(normalizeStoredProgramSecretConfig(secretConfig));
};

export const getSuggestedSecretEnvironmentName = (
  secretConfigDraft: EditableProgramSecretDeclaration[],
) => {
  const existingNames = new Set(
    secretConfigDraft.map((secret) => secret.env.trim()).filter(Boolean),
  );

  if (!existingNames.has("API_KEY")) {
    return "API_KEY";
  }

  let suffix = 2;

  while (existingNames.has(`API_KEY_${suffix}`)) {
    suffix += 1;
  }

  return `API_KEY_${suffix}`;
};

export const getSecretDeclarationIssuesById = (
  secretConfigDraft: EditableProgramSecretDeclaration[],
) => {
  const envCounts = new Map<string, number>();

  for (const secret of secretConfigDraft) {
    const envName = secret.env.trim();

    if (!envName) {
      continue;
    }

    envCounts.set(envName, (envCounts.get(envName) ?? 0) + 1);
  }

  return Object.fromEntries(
    secretConfigDraft.map((secret) => {
      const envName = secret.env.trim();
      const label = secret.label.trim();
      let issue: string | null = null;

      if (!envName) {
        issue = "Environment variable is required.";
      } else if (!ENVIRONMENT_VARIABLE_NAME_PATTERN.test(envName)) {
        issue = "Environment variable names must be valid shell identifiers.";
      } else if ((envCounts.get(envName) ?? 0) > 1) {
        issue = `Duplicate secret declaration for '${envName}'.`;
      } else if (!label) {
        issue = "Label is required.";
      }

      return [
        secret.id,
        issue,
      ];
    }),
  ) as Record<string, string | null>;
};

export const secretBindingEntriesToMap = (bindings: SecretBindingInput[]) => {
  return Object.fromEntries(
    bindings.map((binding) => [
      binding.envName,
      binding.secretId,
    ]),
  ) as Record<string, string>;
};

export const secretBindingMapToEntries = (bindings: Record<string, string>) => {
  return Object.entries(bindings)
    .sort(([leftEnvName], [rightEnvName]) =>
      leftEnvName.localeCompare(rightEnvName),
    )
    .map(([envName, secretId]) => ({
      envName,
      secretId,
    })) satisfies SecretBindingInput[];
};

export const getMissingSecretConfigurationDetail = (
  detail: unknown,
): MissingSecretConfigurationDetail | null => {
  if (!detail || typeof detail !== "object") {
    return null;
  }

  const detailRecord = detail as {
    missingSecrets?: unknown;
    sentinel?: unknown;
  };

  if (!Array.isArray(detailRecord.missingSecrets)) {
    return null;
  }

  const missingSecrets = detailRecord.missingSecrets.flatMap((secret) => {
    if (!secret || typeof secret !== "object") {
      return [];
    }

    const secretRecord = secret as Record<string, unknown>;
    const envName = secretRecord.envName;
    const label = secretRecord.label;
    const required = secretRecord.required;
    const bindingSource = secretRecord.bindingSource;

    if (
      typeof envName !== "string" ||
      typeof label !== "string" ||
      typeof required !== "boolean" ||
      (bindingSource !== "column" &&
        bindingSource !== "implicit" &&
        bindingSource !== "program")
    ) {
      return [];
    }

    return [
      {
        bindingSource: bindingSource as "column" | "implicit" | "program",
        ...(typeof secretRecord.description === "string"
          ? {
              description: secretRecord.description,
            }
          : {}),
        envName,
        label,
        required,
      },
    ];
  });

  if (missingSecrets.length === 0) {
    return null;
  }

  return {
    missingSecrets,
    ...(typeof detailRecord.sentinel === "string"
      ? {
          sentinel: detailRecord.sentinel,
        }
      : {}),
  };
};

export const describeProgramSecretResolution = (
  declaration: ProgramManifestSecretDeclaration,
  explicitSecretId: string | undefined,
  secrets: SecretRecord[],
) => {
  const explicitSecret =
    explicitSecretId === undefined
      ? null
      : (secrets.find((secret) => secret.id === explicitSecretId) ?? null);
  const implicitSecret =
    secrets.find((secret) => secret.name === declaration.env) ?? null;

  if (explicitSecretId !== undefined && explicitSecret === null) {
    return {
      badgeLabel: "Missing",
      badgeTone: "warning" as const,
      helperText: "This bound secret no longer exists.",
      implicitSecret,
    };
  }

  if (explicitSecret) {
    return {
      badgeLabel: "Default",
      badgeTone: "info" as const,
      helperText: `Uses ${explicitSecret.name} by default.`,
      implicitSecret,
    };
  }

  if (implicitSecret) {
    return {
      badgeLabel: "Auto",
      badgeTone: "success" as const,
      helperText: `Falls back to matching secret ${implicitSecret.name}.`,
      implicitSecret,
    };
  }

  return {
    badgeLabel: declaration.required ? "Missing" : "Optional",
    badgeTone: declaration.required
      ? ("warning" as const)
      : ("neutral" as const),
    helperText: declaration.required
      ? "Required before this program can run."
      : "Optional secret.",
    implicitSecret,
  };
};
