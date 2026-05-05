import type { MarbleClient } from "@marble/sdk";
import type { Database } from "@marble/supabase";

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

type ProjectRow = Database["public"]["Tables"]["project"]["Row"];
type SourceRow = Database["public"]["Tables"]["source"]["Row"];
type SourceEventRow = Database["public"]["Tables"]["source_event"]["Row"];
type PipeRow = Database["public"]["Tables"]["pipe"]["Row"];
type TableRow = Database["public"]["Tables"]["table"]["Row"];

export function projectFromDatabaseRow(row: ProjectRow): MarbleProject {
  return {
    createdAt: row.created_at,
    folderPath: row.folder_path,
    id: row.id,
    name: row.name,
    ownerProfileId: row.owner_profile_id,
    updatedAt: row.updated_at,
  };
}

export function tableFromDatabaseRow(row: TableRow): MarbleTable {
  return {
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    updatedAt: row.updated_at,
  };
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

export function sourceFromDatabaseRow(row: SourceRow): MarbleSource {
  return {
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
    payloadSchema: row.payload_schema,
    projectId: row.project_id,
    updatedAt: row.updated_at,
    webhookToken: row.webhook_token,
  };
}

export function sourceEventFromDatabaseRow(
  row: SourceEventRow,
): MarbleSourceEvent {
  return {
    createdAt: row.created_at,
    id: row.id,
    parsedPayload: row.parsed_payload,
    parseError: row.parse_error,
    projectId: row.project_id,
    rawPayload: row.raw_payload,
    sourceId: row.source_id,
  };
}

export function pipeFromDatabaseRow(row: PipeRow): MarblePipe {
  return {
    createdAt: row.created_at,
    id: row.id,
    mappings: row.mappings as MarblePipe["mappings"],
    sourceId: row.source_id,
    tableId: row.table_id,
    updatedAt: row.updated_at,
  };
}
