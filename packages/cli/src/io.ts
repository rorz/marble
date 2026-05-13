import { readFile } from "node:fs/promises";
import { parseJsonOrUndefined, stringifyPretty } from "@marble/lib/json";
import { formatRpcError } from "@marble/lib/result";

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

    return parseJsonOrUndefined(content) as JsonValue | undefined;
  }

  if (options.arg === undefined) {
    return undefined;
  }

  if (options.arg === "-") {
    return parseJsonOrUndefined(await readStdin()) as JsonValue | undefined;
  }

  return parseJsonOrUndefined(options.arg) as JsonValue | undefined;
}

async function readStdin() {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

export function printJson(value: unknown) {
  process.stdout.write(`${stringifyPretty(value)}\n`);
}

/**
 * Print a structured error envelope to stderr. Delegates to
 * `@marble/lib/result.formatRpcError` so the CLI surfaces the same shape
 * an API consumer would see directly.
 */
export function printError(error: unknown) {
  process.stderr.write(`${formatRpcError(error)}\n`);
}
