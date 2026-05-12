import type { ProjectSourceWorkspaceData } from "../../../../../../lib/source-data";

export type Source = ProjectSourceWorkspaceData["sources"][number];
export type PipeMappingInput = {
  columnId: string;
  jsonPath: string;
};
export type PipeMappingDraft = PipeMappingInput & {
  draftId: string;
};
export type PipePathCandidate = {
  key: string;
  path: string;
  preview: string;
};
export type ProjectSourceDetailMode = "pipe" | "source";
export type SourceSchemaValidation =
  | {
      ok: true;
      value: unknown;
    }
  | {
      message: string;
      ok: false;
    };
