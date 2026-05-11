import { readFile } from "node:fs/promises";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

type ReadInputOptions = {
  arg?: string;
  file?: string;
};

/**
 * Resolve a single JSON input value from one of three places:
 *
 *   - a positional CLI argument (`marble resource op '{"foo":"bar"}'`)
 *   - a file path via `--input-file <path>` (use `-` to mean stdin)
 *   - stdin when the positional argument is the literal string `-`
 *
 * Returns `undefined` when no input was provided so callers can pass that
 * straight through to the SDK; the contract's Zod schema decides whether the
 * operation accepts an empty input.
 */
export async function readInput(
  options: ReadInputOptions,
): Promise<JsonValue | undefined> {
  if (options.arg !== undefined && options.file !== undefined) {
    throw new Error(
      "Pass either a positional JSON input or --input-file, not both.",
    );
  }

  if (options.file !== undefined) {
    const content =
      options.file === "-"
        ? await readStdin()
        : await readFile(options.file, "utf8");

    return parseJson(content);
  }

  if (options.arg === undefined) {
    return undefined;
  }

  if (options.arg === "-") {
    return parseJson(await readStdin());
  }

  return parseJson(options.arg);
}

async function readStdin() {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(input: string) {
  const trimmed = input.trim();

  if (trimmed === "") {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch (cause) {
    throw new Error("Input must be valid JSON.", {
      cause,
    });
  }
}

export function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Print a structured error envelope to stderr.
 *
 * oRPC errors expose `toJSON()` and a stable shape (`code`, `status`,
 * `message`, `data`). We surface that verbatim so agents can pattern-match
 * on the same fields they would see if they called the API directly. For
 * plain `Error` instances we keep the message simple and include `cause`
 * detail when present.
 */
export function printError(error: unknown) {
  process.stderr.write(`${formatError(error)}\n`);
}

function formatError(error: unknown) {
  if (error && typeof error === "object") {
    const candidate = error as {
      cause?: unknown;
      code?: string;
      data?: unknown;
      message?: string;
      status?: number;
      toJSON?: () => unknown;
    };

    if (typeof candidate.toJSON === "function") {
      try {
        return JSON.stringify(candidate.toJSON(), null, 2);
      } catch {
        // fall through to other formatters
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
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
