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
          detail: detail as unknown as JsonValue,
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
      } as unknown as JsonValue,
    );
  }
}

export function createRuntimeEnvelope(
  input: JsonValue,
  manualInputValue?: string | null,
): JsonValue {
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
}
