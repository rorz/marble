import { groupBy } from "@marble/lib/array";
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
  const filesByVersionId = groupBy(data.programFiles, (file) => file.versionId);
  const versionsByProgramId = groupBy(
    data.programVersions.map((version) => ({
      ...version,
      programFiles: filesByVersionId.get(version.id) ?? [],
    })),
    (version) => version.programId,
  );

  return data.programs.map((program) => ({
    ...program,
    programVersions: versionsByProgramId.get(program.id) ?? [],
  }));
}
