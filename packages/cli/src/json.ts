import { readFile } from "node:fs/promises";

export type JsonObject = Record<string, unknown>;

export function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

export function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export function requireChanges(value: Record<string, unknown>) {
  if (Object.keys(compactObject(value)).length === 0) {
    throw new Error("Update requires at least one changed value.");
  }
}

export function parseJsonValue(input: string, label = "JSON") {
  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    throw new Error(`${label} must be valid JSON.`, {
      cause: error,
    });
  }
}

export function parseJsonObject(input: string, label = "JSON"): JsonObject {
  const value = parseJsonValue(input, label);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return value as JsonObject;
}

export function parseJsonArray(input: string, label = "JSON") {
  const value = parseJsonValue(input, label);

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array.`);
  }

  return value;
}

export async function readTextFile(path: string) {
  return readFile(path, "utf8");
}

export async function readJsonFile(path: string, label = "JSON file") {
  return parseJsonValue(await readTextFile(path), label);
}

export async function readJsonObjectFile(path: string, label = "JSON file") {
  const value = await readJsonFile(path, label);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must contain a JSON object.`);
  }

  return value as JsonObject;
}

export async function readOptionalJsonObject(options: {
  input?: string;
  inputFile?: string;
  label: string;
}) {
  if (options.input && options.inputFile) {
    throw new Error(`Pass either ${options.label} JSON or --input-file.`);
  }

  if (options.inputFile) {
    return readJsonObjectFile(options.inputFile, options.label);
  }

  if (!options.input) {
    return undefined;
  }

  return parseJsonObject(options.input, options.label);
}

export async function readRequiredJsonObject(options: {
  input?: string;
  inputFile?: string;
  label: string;
}) {
  const value = await readOptionalJsonObject(options);

  if (!value) {
    throw new Error(`${options.label} is required.`);
  }

  return value;
}

export async function readJsonOption(options: {
  file?: string;
  label: string;
  value?: string;
}) {
  if (options.value && options.file) {
    throw new Error(
      `Pass either --${options.label} or --${options.label}-file.`,
    );
  }

  if (options.file) {
    return readJsonFile(options.file, options.label);
  }

  if (options.value === undefined) {
    return undefined;
  }

  return parseJsonValue(options.value, options.label);
}

export function parseBooleanOption(input: string | undefined, label: string) {
  if (input === undefined) {
    return undefined;
  }

  if (input === "true") {
    return true;
  }

  if (input === "false") {
    return false;
  }

  throw new Error(`${label} must be true or false.`);
}

export function parseIntegerOption(input: string | undefined, label: string) {
  if (input === undefined) {
    return undefined;
  }

  const value = Number(input);

  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  return value;
}

export function readEnvValue(name: string) {
  const value = process.env[name];

  if (value === undefined) {
    throw new Error(`Environment variable ${name} is not set.`);
  }

  return value;
}
