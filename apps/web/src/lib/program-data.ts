import type { MarbleClient } from "@marble/sdk";

type ProgramEditorData = Awaited<
  ReturnType<MarbleClient["programs"]["listForEditor"]>
>;
type ProgramRecord = ProgramEditorData["programs"][number];
type ProgramVersionRecord = ProgramEditorData["programVersions"][number];
type ProgramFileRecord = ProgramEditorData["programFiles"][number];

export type FullProgram = ProgramRecord & {
  programVersions: Array<
    ProgramVersionRecord & {
      programFiles: ProgramFileRecord[];
    }
  >;
};

export type EditableProgramFile = Pick<
  ProgramFileRecord,
  "content" | "filename" | "filetype"
>;

export function hydrateEditorPrograms(data: ProgramEditorData): FullProgram[] {
  const filesByVersionId = new Map<string, ProgramFileRecord[]>();

  for (const file of data.programFiles) {
    const files = filesByVersionId.get(file.versionId) ?? [];
    files.push(file);
    filesByVersionId.set(file.versionId, files);
  }

  const versionsByProgramId = new Map<string, FullProgram["programVersions"]>();

  for (const version of data.programVersions) {
    const versions = versionsByProgramId.get(version.programId) ?? [];
    versions.push({
      ...version,
      programFiles: filesByVersionId.get(version.id) ?? [],
    });
    versionsByProgramId.set(version.programId, versions);
  }

  return data.programs.map((program) => ({
    ...program,
    programVersions: versionsByProgramId.get(program.id) ?? [],
  }));
}
