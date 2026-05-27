import { parseProgramConfigFromFiles } from "@marble/contracts";
import { safeStringify } from "@marble/lib/json";
import {
  isPlainRecord,
  readBoolean,
  readRecordArray,
  readString,
} from "@marble/lib/object";
import {
  findUserInputVersion,
  isPublishedVersion,
  sortPublishedVersionsDesc,
  versionNumber,
} from "./user-input-program";

const MAX_RESULT_PREVIEW = 2000;

type SummarizeToolResultInput = {
  operationId: string;
  result: unknown;
};
type ProgramFileSummary = {
  content: string;
  filename: string;
};

const summarizeGenericResult = (result: unknown): string => {
  const pretty = safeStringify(result);
  if (pretty.length <= MAX_RESULT_PREVIEW) return pretty;
  return `${pretty.slice(0, MAX_RESULT_PREVIEW)}\n... (truncated; full result in tool details)`;
};

const versionAllowsManualInput = (
  version: Record<string, unknown>,
  filesByVersionId: Map<string, ProgramFileSummary[]>,
): boolean => {
  const id = readString(version, "id");

  if (!id) {
    return false;
  }

  try {
    return (
      parseProgramConfigFromFiles(filesByVersionId.get(id) ?? []).outputConfig
        .flags.allowManualInput === true
    );
  } catch (error) {
    void error;
    return false;
  }
};

const describeVersion = (
  version: Record<string, unknown>,
  filesByVersionId: Map<string, ProgramFileSummary[]>,
): string => {
  const id = readString(version, "id") ?? "unknown";
  const label =
    versionNumber(version) > 0 ? `v${versionNumber(version)}` : "draft";
  const published = isPublishedVersion(version) ? "published" : "draft";
  const manual = versionAllowsManualInput(version, filesByVersionId)
    ? ", manualInput"
    : "";
  return `${label}:${id} (${published}${manual})`;
};

const groupProgramFilesByVersionId = (
  files: Record<string, unknown>[],
): Map<string, ProgramFileSummary[]> => {
  const filesByVersionId = new Map<string, ProgramFileSummary[]>();

  for (const file of files) {
    const versionId = readString(file, "versionId");
    const filename = readString(file, "filename");
    const content = readString(file, "content");

    if (!versionId || !filename || content === null) {
      continue;
    }

    filesByVersionId.set(versionId, [
      ...(filesByVersionId.get(versionId) ?? []),
      {
        content,
        filename,
      },
    ]);
  }

  return filesByVersionId;
};

const summarizeProgramVersions = (
  versions: Record<string, unknown>[],
  filesByVersionId: Map<string, ProgramFileSummary[]>,
  programId: string,
): string => {
  const relevantVersions = versions.filter(
    (version) => readString(version, "programId") === programId,
  );
  if (relevantVersions.length === 0) return "no versions";

  return relevantVersions
    .sort(sortPublishedVersionsDesc)
    .map((version) => describeVersion(version, filesByVersionId))
    .join(", ");
};

const summarizeProgramEditorResult = (result: unknown): string | null => {
  if (!isPlainRecord(result)) return null;

  const programs = readRecordArray(result, "programs");
  const versions = readRecordArray(result, "programVersions");
  const files = readRecordArray(result, "programFiles");
  const filesByVersionId = groupProgramFilesByVersionId(files);
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
        filesByVersionId,
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
