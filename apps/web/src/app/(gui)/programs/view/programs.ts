import type {
  FullProgram,
  ProgramVersionWithFiles,
  PublishedProgramVersionWithFiles,
} from "./types";

export function countLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function comparePrograms(left: FullProgram, right: FullProgram) {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() ||
    left.name.localeCompare(right.name)
  );
}

export function sortPrograms(programs: FullProgram[]) {
  return [
    ...programs,
  ].sort(comparePrograms);
}

export function sortProgramVersions(
  programVersions: ProgramVersionWithFiles[],
) {
  return [
    ...programVersions,
  ]
    .filter(
      (version): version is PublishedProgramVersionWithFiles =>
        version.publishedAt !== null && version.version !== null,
    )
    .sort((left, right) => (right.version ?? 0) - (left.version ?? 0));
}

export function getLatestPublishedVersion(program: FullProgram | undefined) {
  return sortProgramVersions(program?.programVersions ?? [])[0] ?? null;
}

export function getDraftVersion(program: FullProgram | undefined) {
  if (!program?.programVersions?.length) {
    return null;
  }

  return (
    [
      ...program.programVersions,
    ]
      .filter((version) => version.publishedAt === null)
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      )[0] ?? null
  );
}
