import { stringifyJsonSafe, stringifyPretty } from "@marble/lib/json";
import { isPlainRecord } from "@marble/lib/object";
import type { DispatchTable } from "./index";
import { findUserInputVersion } from "./user-input-program";

type PrepareToolCallInput = {
  dispatch: DispatchTable;
  input: unknown;
  operationId: string;
};

const USER_INPUT_TEMPLATE_FORMATS = new Set([
  "boolean",
  "number",
  "string",
]);

const parseTemplate = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
    // harness-ignore: no-swallowed-errors -- intentional JSON.parse fallback returns the raw string when the value is not JSON
  } catch {
    return value;
  }
};

const stringifyTemplate = (value: unknown): string =>
  typeof value === "string" ? value : stringifyJsonSafe(value);

const isProgramFileInput = (
  file: unknown,
): file is Record<string, unknown> & {
  filename: string;
} => {
  return isPlainRecord(file) && typeof file.filename === "string";
};

const withProgramRuntimeDefaults = (files: unknown[]) => {
  const hasMain = files.some(
    (file) => isProgramFileInput(file) && file.filename === "main.ts",
  );
  const hasPackageManifest = files.some(
    (file) => isProgramFileInput(file) && file.filename === "package.json",
  );
  const normalizedFiles = hasMain
    ? files
    : files.map((file) =>
        isProgramFileInput(file) && file.filename === "index.ts"
          ? {
              ...file,
              filename: "main.ts",
            }
          : file,
      );

  if (hasPackageManifest) {
    return normalizedFiles;
  }

  return [
    {
      content: `${stringifyPretty({
        dependencies: {},
        name: "marble-program",
        type: "module",
      })}\n`,
      filename: "package.json",
      filetype: "Json",
    },
    ...normalizedFiles,
  ];
};

const isUserInputTemplate = (value: unknown): boolean => {
  if (value === undefined) return true;

  const template = parseTemplate(value);
  if (!isPlainRecord(template)) return false;

  const keys = Object.keys(template);
  if (keys.length === 0) return true;
  return (
    keys.length === 1 &&
    typeof template.format === "string" &&
    USER_INPUT_TEMPLATE_FORMATS.has(template.format)
  );
};

const resolveUserInputProgramVersionId = async (
  dispatch: DispatchTable,
): Promise<string | null> => {
  const listForEditor = dispatch.programs?.listForEditor;
  if (!listForEditor) return null;

  const editorData = await listForEditor({});
  return findUserInputVersion(editorData).versionId;
};

const prepareColumnCreateInput = async (
  dispatch: DispatchTable,
  input: unknown,
): Promise<unknown> => {
  if (!isPlainRecord(input)) return input;

  const normalized: Record<string, unknown> = {
    ...input,
    ...(input.inputTemplate === undefined
      ? {}
      : {
          inputTemplate: stringifyTemplate(input.inputTemplate),
        }),
  };

  if (
    typeof normalized.programVersionId === "string" ||
    !isUserInputTemplate(normalized.inputTemplate)
  ) {
    return normalized;
  }

  const userInputVersionId = await resolveUserInputProgramVersionId(dispatch);
  if (!userInputVersionId) return normalized;

  return {
    ...normalized,
    inputTemplate: stringifyTemplate(
      normalized.inputTemplate ?? {
        format: "string",
      },
    ),
    programVersionId: userInputVersionId,
    runCondition: false,
  };
};

const prepareProgramFilesSyncInput = (input: unknown): unknown => {
  if (!isPlainRecord(input) || !Array.isArray(input.files)) return input;

  return {
    ...input,
    files: withProgramRuntimeDefaults(input.files),
  };
};

export const prepareToolCallInput = async ({
  dispatch,
  input,
  operationId,
}: PrepareToolCallInput): Promise<unknown> => {
  if (operationId === "columns.create") {
    return prepareColumnCreateInput(dispatch, input);
  }

  if (operationId === "programFiles.syncForVersion") {
    return prepareProgramFilesSyncInput(input);
  }

  return input;
};
