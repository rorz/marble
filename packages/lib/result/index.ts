/**
 * Error normalisation primitives. Zero third-party dependencies.
 *
 * `getErrorMessage` is the lightweight "extract a string from an unknown
 * thrown value" helper. `formatRpcError` is the structured-envelope formatter
 * used by the CLI so errors thrown by oRPC have the same shape an API
 * consumer would see directly. Both centralise patterns that were duplicated
 * across the web app, CLI, and API forwarding code.
 */

import { safeStringify } from "../json";

const DEFAULT_MESSAGE = "Request failed.";

/**
 * Extract a human-readable message from an unknown thrown value. Falls back
 * to `fallback` (default `"Request failed."`) when no message can be read.
 */
export const getErrorMessage = (
  error: unknown,
  fallback: string = DEFAULT_MESSAGE,
): string => {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    const message = (
      error as {
        message?: unknown;
      }
    ).message;

    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
};

/**
 * Format an unknown thrown value as a stable, agent-friendly string.
 *
 * oRPC errors expose `toJSON()` and a stable shape (`code`, `status`,
 * `message`, `data`); we surface that verbatim so consumers can pattern-match
 * on the same fields they would see if they called the API directly. Plain
 * `Error` instances collapse to `message[: cause]`. Everything else is
 * `String(value)`.
 */
export const formatRpcError = (error: unknown): string => {
  if (error && typeof error === "object") {
    const candidate = error as {
      cause?: unknown;
      code?: unknown;
      data?: unknown;
      message?: unknown;
      status?: unknown;
      toJSON?: () => unknown;
    };

    if (typeof candidate.toJSON === "function") {
      try {
        return JSON.stringify(candidate.toJSON(), null, 2);
      } catch {
        // fall through to the other formatters
      }
    }

    if (
      typeof candidate.code === "string" &&
      typeof candidate.message === "string"
    ) {
      return JSON.stringify(
        {
          code: candidate.code,
          data: candidate.data,
          message: candidate.message,
          status: candidate.status,
        },
        null,
        2,
      );
    }

    if (error instanceof Error) {
      const cause = error.cause;
      const causeMessage =
        cause instanceof Error
          ? cause.message
          : cause === undefined
            ? undefined
            : safeStringify(cause);

      return causeMessage ? `${error.message}: ${causeMessage}` : error.message;
    }
  }

  return String(error);
};
