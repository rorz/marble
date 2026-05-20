import type { ProjectSourceWorkspaceData } from "../../../../../../lib/source-data";

export type InputColumn = ProjectSourceWorkspaceData["inputColumns"][number];
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
export type PipePathSuggestionOption = {
  label: string;
  value: string;
};
export type TableOption = {
  id: string;
  label: string;
};
