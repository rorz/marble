import { toCamelKeys } from "@marble/lib/object";
import type { MarbleClient } from "@marble/sdk";

export type MarbleProject = Awaited<
  ReturnType<MarbleClient["projects"]["get"]>
>;
export type MarbleTable = Awaited<ReturnType<MarbleClient["tables"]["get"]>>;
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

type BroadcastRow = Record<string, unknown>;

export function projectFromBroadcastRow(row: BroadcastRow): MarbleProject {
  return toCamelKeys(row) as MarbleProject;
}

export function tableFromBroadcastRow(row: BroadcastRow): MarbleTable {
  return toCamelKeys(row) as MarbleTable;
}

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

export function sourceFromBroadcastRow(row: BroadcastRow): MarbleSource {
  return toCamelKeys(row) as MarbleSource;
}

export function sourceEventFromBroadcastRow(
  row: BroadcastRow,
): MarbleSourceEvent {
  return toCamelKeys(row) as MarbleSourceEvent;
}

export function pipeFromBroadcastRow(row: BroadcastRow): MarblePipe {
  return toCamelKeys(row) as MarblePipe;
}
