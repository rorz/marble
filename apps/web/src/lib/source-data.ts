import "server-only";
import { dedupeById } from "@marble/lib/array";
import {
  type MarbleColumn,
  type MarblePipe,
  type MarbleSource,
  type MarbleSourceEvent,
  type ProjectInfo,
  type ProjectInputColumn,
  type ProjectTable,
  projectTableFromSdkTable,
} from "./marble-resources";
import { createServerMarbleSdkForProject } from "./marble-sdk-server";
import { getMarbleIngestorBaseUrl } from "./server-config";

export type ProjectSourceWorkspaceData = {
  inputColumns: ProjectInputColumn[];
  pipes: MarblePipe[];
  project: ProjectInfo;
  sourceEvents: MarbleSourceEvent[];
  sources: MarbleSource[];
  webhookBaseUrl: string;
};

const outputConfigAllowsManualInput = (outputConfig: unknown) => {
  if (!outputConfig || typeof outputConfig !== "object") {
    return false;
  }

  const flags = (
    outputConfig as {
      flags?: {
        allowManualInput?: boolean;
      };
    }
  ).flags;

  return flags?.allowManualInput === true;
};

const toProjectInputColumn = (
  column: MarbleColumn,
  table: ProjectTable,
): ProjectInputColumn => {
  return {
    allowManualInput: true,
    id: column.id,
    label: `${table.projectName} / ${table.name} / ${column.name}`,
    name: column.name,
    projectId: table.projectId,
    projectName: table.projectName,
    tableId: table.id,
    tableName: table.name,
  };
};

export const getProjectSourceWorkspaceData = async (projectId: string) => {
  const resolved = await createServerMarbleSdkForProject(projectId);

  if (!resolved) {
    return null;
  }

  const { project, sdk } = resolved;
  const [tables, sources, sourceEvents, programEditorData] = await Promise.all([
    sdk.tables.list({
      projectId,
    }),
    sdk.sources.list({
      projectId,
    }),
    sdk.sourceEvents.list({
      limit: 120,
      projectId,
    }),
    sdk.programs.listForEditor({}),
  ]);
  const projectTables = tables.map((table) =>
    projectTableFromSdkTable(table, project),
  );
  const tableById = new Map(
    projectTables.map((table) => [
      table.id,
      table,
    ]),
  );
  const programVersionAllowsManualInputById = new Map(
    programEditorData.programVersions.map((version) => [
      version.id,
      outputConfigAllowsManualInput(version.outputConfig),
    ]),
  );
  const tableColumns = await Promise.all(
    projectTables.map((table) =>
      sdk.columns.list({
        tableId: table.id,
      }),
    ),
  );
  const sourcePipes = await Promise.all(
    sources.map((source) =>
      sdk.pipes.list({
        sourceId: source.id,
      }),
    ),
  );

  return {
    inputColumns: tableColumns.flat().flatMap((column) => {
      const table = tableById.get(column.tableId);
      const allowsManualInput =
        programVersionAllowsManualInputById.get(column.programVersionId) ===
        true;

      return table && allowsManualInput
        ? [
            toProjectInputColumn(column, table),
          ]
        : [];
    }),
    pipes: dedupeById(sourcePipes.flat()),
    project: {
      ...project,
      tableCount: tables.length,
      tables: projectTables,
    },
    sourceEvents,
    sources,
    webhookBaseUrl: getMarbleIngestorBaseUrl(),
  } satisfies ProjectSourceWorkspaceData;
};
