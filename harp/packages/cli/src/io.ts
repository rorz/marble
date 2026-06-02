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

const parseJsonOrUndefined = (text: string): JsonValue | undefined => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch (error) {
    throw new Error(
      `Invalid JSON input: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }
};

const readStdin = async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

/**
 * Resolve one JSON input value from a positional argument, an `--input-file`,
 * or stdin (`-`). Returns `undefined` when nothing was supplied so the contract
 * Zod schema decides whether the operation accepts empty input.
 */
export const readInput = async (
  options: ReadInputOptions,
): Promise<JsonValue | undefined> => {
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
    return parseJsonOrUndefined(content);
  }
  if (options.arg === undefined) {
    return undefined;
  }
  if (options.arg === "-") {
    return parseJsonOrUndefined(await readStdin());
  }
  return parseJsonOrUndefined(options.arg);
};

export const printJson = (value: unknown) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

export const printError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify(
      {
        error: message,
      },
      null,
      2,
    )}\n`,
  );
};
