import { safeStringify } from "@marble/lib/json";
import {
  findUserInputVersion,
  isPublishedVersion,
  readBoolean,
  readRecord,
  readRecordArray,
  readString,
  sortPublishedVersionsDesc,
  versionNumber,
} from "./user-input";

const MAX_RESULT_PREVIEW = 2000;

type SummarizeToolResultInput = {
  operationId: string;
  result: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const summarizeGenericResult = (result: unknown): string => {
  const pretty = safeStringify(result);
  if (pretty.length <= MAX_RESULT_PREVIEW) return pretty;
  return `${pretty.slice(0, MAX_RESULT_PREVIEW)}\n... (truncated; full result in tool details)`;
};

const versionAllowsManualInput = (
  version: Record<string, unknown>,
): boolean => {
  const outputConfig = readRecord(version, "outputConfig");
  const flags = outputConfig ? readRecord(outputConfig, "flags") : null;
  return flags ? readBoolean(flags, "allowManualInput") === true : false;
};

const describeVersion = (version: Record<string, unknown>): string => {
  const id = readString(version, "id") ?? "unknown";
  const label =
    versionNumber(version) > 0 ? `v${versionNumber(version)}` : "draft";
  const published = isPublishedVersion(version) ? "published" : "draft";
  const manual = versionAllowsManualInput(version) ? ", manualInput" : "";
  return `${label}:${id} (${published}${manual})`;
};

const summarizeProgramVersions = (
  versions: Record<string, unknown>[],
  programId: string,
): string => {
  const relevantVersions = versions.filter(
    (version) => readString(version, "programId") === programId,
  );
  if (relevantVersions.length === 0) return "no versions";

  return relevantVersions
    .sort(sortPublishedVersionsDesc)
    .map(describeVersion)
    .join(", ");
};

const summarizeProgramEditorResult = (result: unknown): string | null => {
  if (!isRecord(result)) return null;

  const programs = readRecordArray(result, "programs");
  const versions = readRecordArray(result, "programVersions");
  const files = readRecordArray(result, "programFiles");
  const userInput = findUserInputVersion(result);
  const lines = [
    `Program editor summary: ${programs.length} programs, ${versions.length} versions, ${files.length} files.`,
  ];

  if (userInput.programId && userInput.versionId) {
    lines.push(
      `First-party User Input: programId=${userInput.programId} versionId=${userInput.versionId}.`,
      `For text input columns: programVersionId=${userInput.versionId}, inputTemplate='{"format":"string"}', runCondition=false.`,
      `For number/boolean input columns, use inputTemplate='{"format":"number"}' or inputTemplate='{"format":"boolean"}'.`,
    );
  } else {
    lines.push("First-party User Input: not found in this result.");
  }

  lines.push("Programs:");
  for (const program of programs) {
    const id = readString(program, "id") ?? "unknown";
    const name = readString(program, "name") ?? "Untitled";
    const firstParty = readBoolean(program, "firstParty") === true;
    lines.push(
      `- ${name}${firstParty ? " [first-party]" : ""} id=${id}; versions=${summarizeProgramVersions(
        versions,
        id,
      )}`,
    );
  }

  if (files.length > 0) {
    lines.push(
      "Program file contents are omitted from this model summary; use marble_program_files_list/get for file details when needed.",
    );
  }

  return lines.join("\n");
};

export const summarizeToolResult = ({
  operationId,
  result,
}: SummarizeToolResultInput): string => {
  if (operationId === "programs.listForEditor") {
    return (
      summarizeProgramEditorResult(result) ?? summarizeGenericResult(result)
    );
  }

  return summarizeGenericResult(result);
};
