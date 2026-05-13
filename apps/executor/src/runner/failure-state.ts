import type {
  JsonValue,
  RunReturnValue as RunReturnValueType,
} from "@marble/contracts";
import type { z } from "zod";

export type MissingSecretConfiguration = {
  bindingSource: "column" | "implicit" | "program";
  description?: string;
  envName: string;
  label: string;
  required: boolean;
};

export const formatZodIssues = (issues: z.ZodIssue[]): string =>
  issues
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("; ");

/**
 * Convert a `z.ZodIssue[]` to `JsonValue` for persistence as run detail.
 *
 * TS rejects a direct `as JsonValue` because `ZodIssue.path` is typed as
 * `PropertyKey[]` (which includes `symbol`) and symbols are not part of
 * `JsonValue`. In practice Zod only produces string/number paths, so a
 * JSON round-trip is the safest no-cast conversion: it eliminates any
 * stray non-JSON values at the same time as it crosses the type
 * boundary. These are error paths, not hot paths.
 */
export const zodIssuesToJson = (issues: z.ZodIssue[]): JsonValue =>
  JSON.parse(JSON.stringify(issues));

export const createFailureState = (
  errorType: string,
  message: string,
  detail?: JsonValue,
): RunReturnValueType => ({
  error: {
    type: errorType,
    ...(detail == null
      ? {}
      : {
          detail,
        }),
  },
  message,
  ok: false,
});

export class MissingSecretConfigurationError extends Error {
  failState: RunReturnValueType;

  constructor(missingSecrets: MissingSecretConfiguration[]) {
    super(
      missingSecrets.length === 1
        ? `Waiting for secret configuration: ${missingSecrets[0].envName}`
        : `Waiting for secret configuration: ${missingSecrets
            .map((secret) => secret.envName)
            .join(", ")}`,
    );
    this.name = "MissingSecretConfigurationError";
    this.failState = createFailureState(
      "MissingSecretConfiguration",
      this.message,
      {
        missingSecrets,
        sentinel: "WAITING_FOR_SECRET_CONFIGURATION",
      } as JsonValue,
    );
  }
}

export const createRuntimeEnvelope = (
  input: JsonValue,
  manualInputValue?: string | null,
): JsonValue => {
  return {
    cell:
      manualInputValue == null
        ? {}
        : {
            manualInputValue,
          },
    input,
    system: {},
  };
};
