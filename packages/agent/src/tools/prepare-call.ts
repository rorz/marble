import { stringifyJsonSafe } from "@marble/lib/json";
import { findUserInputVersion } from "./user-input";

type DispatchTable = Record<
  string,
  Record<string, (input: unknown) => Promise<unknown>>
>;

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseTemplate = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
};

const stringifyTemplate = (value: unknown): string =>
  typeof value === "string" ? value : stringifyJsonSafe(value);

const isUserInputTemplate = (value: unknown): boolean => {
  if (value === undefined) return true;

  const template = parseTemplate(value);
  if (!isRecord(template)) return false;

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
  if (!isRecord(input)) return input;

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

export const prepareToolCallInput = async ({
  dispatch,
  input,
  operationId,
}: PrepareToolCallInput): Promise<unknown> => {
  if (operationId === "columns.create") {
    return prepareColumnCreateInput(dispatch, input);
  }

  return input;
};
