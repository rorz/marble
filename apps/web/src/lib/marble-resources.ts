import type { MarbleClient } from "@marble/sdk";

type MarbleProject = Awaited<ReturnType<MarbleClient["projects"]["get"]>>;
type MarbleTable = Awaited<ReturnType<MarbleClient["tables"]["get"]>>;
export type MarbleColumn = Awaited<
  ReturnType<MarbleClient["columns"]["list"]>
>[number];
export type MarbleSource = Awaited<ReturnType<MarbleClient["sources"]["get"]>>;
export type MarbleSourceEvent = Awaited<
  ReturnType<MarbleClient["sourceEvents"]["get"]>
>;
export type MarblePipe = Awaited<ReturnType<MarbleClient["pipes"]["get"]>>;

export type ProjectTable = MarbleTable & {
  projectFolderPath: string[];
  projectName: string;
};

export type ProjectInfo = MarbleProject & {
  tableCount: number;
  tables: ProjectTable[];
};

export type ProjectInputColumn = {
  allowManualInput: boolean;
  id: string;
  label: string;
  name: string;
  projectId: string;
  projectName: string;
  tableId: string;
  tableName: string;
};

export function projectTableFromSdkTable(
  table: MarbleTable,
  project: Pick<MarbleProject, "folderPath" | "name">,
): ProjectTable {
  return {
    ...table,
    projectFolderPath: project.folderPath,
    projectName: project.name,
  };
}
