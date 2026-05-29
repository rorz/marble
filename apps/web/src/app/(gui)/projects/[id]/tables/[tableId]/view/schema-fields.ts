import type {
  ProgramSecretDeclarationsByProgramId,
  ReferenceableColumn,
  SchemaField,
  SecretBindingInput,
  SecretRecord,
} from "./types";

const COLUMN_ID_TOKEN_PATTERN =
  /^col\.([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})((?:(?:\.|\[).*?)?)$/i;
const COLUMN_VALUE_REF_PATTERN =
  /^\$\.columns\.([a-f0-9-]+)\.value((?:(?:\.|\[).*?)?)$/i;
const COLUMN_SHORTHAND_INTERPOLATION_PATTERN =
  /\{\{\s*col\.([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})((?:(?:\.|\[).*?)?)\s*\}\}/gi;

export const buildFieldsFromSchema = (
  schema: Record<string, unknown>,
): SchemaField[] => {
  const props = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const req = new Set((schema.required as string[] | undefined) ?? []);
  return Object.entries(props).map(([key, def]) => ({
    defaultValue: def.default as string | undefined,
    enumValues: def.enum as string[] | undefined,
    key,
    required: req.has(key),
    title: (def.title as string) ?? key,
    type: (def.type as string) ?? "string",
  }));
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

export const describeColumnSecretResolution = (
  declaration: ProgramSecretDeclarationsByProgramId[string][number],
  options: {
    overrideSecretId?: string;
    programDefaultSecretId?: string;
    secrets: SecretRecord[];
  },
) => {
  const overrideSecret =
    options.overrideSecretId === undefined
      ? null
      : (options.secrets.find(
          (secret) => secret.id === options.overrideSecretId,
        ) ?? null);
  const programDefaultSecret =
    options.programDefaultSecretId === undefined
      ? null
      : (options.secrets.find(
          (secret) => secret.id === options.programDefaultSecretId,
        ) ?? null);

  if (options.overrideSecretId !== undefined && overrideSecret === null) {
    return {
      badgeLabel: "Missing",
      badgeTone: "warning" as const,
      helperText: "This override points at a secret that no longer exists.",
      inheritedLabel: "No inherited secret available",
    };
  }

  if (overrideSecret) {
    return {
      badgeLabel: "Override",
      badgeTone: "info" as const,
      helperText: `Overrides the default with ${overrideSecret.name}.`,
      inheritedLabel: "Use inherited default",
    };
  }

  if (
    options.programDefaultSecretId !== undefined &&
    programDefaultSecret === null
  ) {
    return {
      badgeLabel: "Missing",
      badgeTone: "warning" as const,
      helperText: "The inherited program default no longer exists.",
      inheritedLabel: "Program default is missing",
    };
  }

  if (programDefaultSecret) {
    return {
      badgeLabel: "Program",
      badgeTone: "neutral" as const,
      helperText: `Inherits the program default ${programDefaultSecret.name}.`,
      inheritedLabel: `Use program default (${programDefaultSecret.name})`,
    };
  }

  return {
    badgeLabel: declaration.required ? "Missing" : "Optional",
    badgeTone: declaration.required
      ? ("warning" as const)
      : ("neutral" as const),
    helperText: declaration.required
      ? "Required before this column can run."
      : "Optional secret.",
    inheritedLabel: "No inherited secret available",
  };
};

export const coerceFieldValue = (
  field: SchemaField,
  raw: string,
): unknown | undefined => {
  const trimmed = raw.trim();
  if (trimmed === "" && !field.required) return undefined;

  switch (field.type) {
    case "object":
      if (trimmed === "") return {};
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        void error;
        return {};
      }
    case "number":
    case "integer":
      return Number(trimmed) || 0;
    case "boolean":
      return trimmed === "true";
    case "array":
      if (trimmed === "") return [];
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        void error;
        return [];
      }
    default:
      return raw;
  }
};

export const resolveReferenceColumnToken = (
  token: string,
  referenceColumns: ReferenceableColumn[],
  currentTableId?: string,
) => {
  const trimmedToken = token.trim();
  const idMatch = trimmedToken.match(COLUMN_ID_TOKEN_PATTERN);
  if (idMatch) {
    const column =
      referenceColumns.find((candidate) => candidate.id === idMatch[1]) ?? null;

    return column
      ? {
          column,
          restPath: idMatch[2] ?? "",
        }
      : null;
  }

  const sortedColumns = [
    ...referenceColumns,
  ].sort(
    (left, right) =>
      right.label.length - left.label.length ||
      right.name.length - left.name.length,
  );

  for (const column of sortedColumns) {
    const aliases = [
      column.label,
      ...(column.tableId === currentTableId
        ? [
            column.name,
          ]
        : []),
    ];

    for (const alias of aliases) {
      if (
        trimmedToken === alias ||
        trimmedToken.startsWith(`${alias}.`) ||
        trimmedToken.startsWith(`${alias}[`)
      ) {
        return {
          column,
          restPath: trimmedToken.slice(alias.length),
        };
      }
    }
  }

  return null;
};

export const parseTemplateToFieldValues = (
  templateJson: string,
  fields: SchemaField[],
  referenceColumns: ReferenceableColumn[],
): Record<
  string,
  {
    mode: "static" | "column";
    path?: string;
    value: string;
  }
> => {
  let template: Record<string, unknown> = {};
  try {
    template = JSON.parse(templateJson);
  } catch (error) {
    void error;
    template = {};
  }

  const result: Record<
    string,
    {
      mode: "static" | "column";
      path?: string;
      value: string;
    }
  > = {};

  for (const field of fields) {
    const dynamicKey = `${field.key}.$`;
    if (dynamicKey in template) {
      const ref = template[dynamicKey];
      const match =
        typeof ref === "string" ? ref.match(COLUMN_VALUE_REF_PATTERN) : null;
      if (match) {
        result[field.key] = {
          mode: "column",
          path: match[2] || undefined,
          value: match[1],
        };
        continue;
      }
      const shorthandMatch =
        typeof ref === "string" ? ref.match(COLUMN_ID_TOKEN_PATTERN) : null;
      if (shorthandMatch) {
        result[field.key] = {
          mode: "column",
          path: shorthandMatch[2] || undefined,
          value: shorthandMatch[1],
        };
        continue;
      }
    }
    if (field.key in template) {
      const val = template[field.key];
      let strVal = typeof val === "string" ? val : JSON.stringify(val);

      // Reverse interpolation tags: {{$.columns.<id>.value.foo}} -> {{Column Name.foo}}
      strVal = strVal.replace(
        /\{\{\$\.columns\.([a-f0-9-]+)\.value([^}]*)\}\}/g,
        (match, id, restPath) => {
          const col = referenceColumns.find((candidate) => candidate.id === id);
          if (col) return `{{${col.label}${restPath}}}`;
          return match;
        },
      );
      strVal = strVal.replace(
        COLUMN_SHORTHAND_INTERPOLATION_PATTERN,
        (match, id, restPath) => {
          const col = referenceColumns.find((candidate) => candidate.id === id);
          if (col) return `{{${col.label}${restPath}}}`;
          return match;
        },
      );

      result[field.key] = {
        mode: "static",
        value: strVal,
      };
    } else {
      result[field.key] = {
        mode: "static",
        value: field.defaultValue ?? field.enumValues?.[0] ?? "",
      };
    }
  }

  return result;
};
