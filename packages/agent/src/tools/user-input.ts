const USER_INPUT_PROGRAM_NAME = "User Input";

type UserInputVersionLookup = {
  programId: null | string;
  versionId: null | string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readString = (
  record: Record<string, unknown>,
  key: string,
): string | null => {
  const value = record[key];
  return typeof value === "string" ? value : null;
};

const readNumber = (
  record: Record<string, unknown>,
  key: string,
): number | null => {
  const value = record[key];
  return typeof value === "number" ? value : null;
};

export const readBoolean = (
  record: Record<string, unknown>,
  key: string,
): boolean | null => {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
};

export const readRecord = (
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null => {
  const value = record[key];
  return isRecord(value) ? value : null;
};

export const readRecordArray = (
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown>[] => {
  const value = record[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
};

export const isPublishedVersion = (version: Record<string, unknown>): boolean =>
  readString(version, "publishedAt") !== null;

export const versionNumber = (version: Record<string, unknown>): number =>
  readNumber(version, "version") ?? 0;

export const sortPublishedVersionsDesc = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): number => {
  const leftVersion = versionNumber(left);
  const rightVersion = versionNumber(right);
  if (leftVersion !== rightVersion) return rightVersion - leftVersion;
  return (readString(right, "publishedAt") ?? "").localeCompare(
    readString(left, "publishedAt") ?? "",
  );
};

const latestPublishedVersionForProgram = (
  versions: Record<string, unknown>[],
  programId: string,
): Record<string, unknown> | null =>
  versions
    .filter(
      (version) =>
        readString(version, "programId") === programId &&
        isPublishedVersion(version),
    )
    .sort(sortPublishedVersionsDesc)[0] ?? null;

export const findUserInputVersion = (
  programEditorData: unknown,
): UserInputVersionLookup => {
  if (!isRecord(programEditorData)) {
    return {
      programId: null,
      versionId: null,
    };
  }

  const programs = readRecordArray(programEditorData, "programs");
  const versions = readRecordArray(programEditorData, "programVersions");
  const userInputProgram = programs.find(
    (program) =>
      readBoolean(program, "firstParty") === true &&
      readString(program, "name")?.trim() === USER_INPUT_PROGRAM_NAME,
  );

  if (!userInputProgram) {
    return {
      programId: null,
      versionId: null,
    };
  }

  const programId = readString(userInputProgram, "id");
  const userInputVersion = programId
    ? latestPublishedVersionForProgram(versions, programId)
    : null;

  return {
    programId,
    versionId: userInputVersion ? readString(userInputVersion, "id") : null,
  };
};
