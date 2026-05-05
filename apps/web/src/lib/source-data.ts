import "server-only";
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

function dedupePipes(pipes: MarblePipe[]) {
  return Array.from(
    new Map(
      pipes.map((pipe) => [
        pipe.id,
        pipe,
      ]),
    ).values(),
  );
}

function hasAllowManualInput(outputSchema: unknown) {
  if (!outputSchema || typeof outputSchema !== "object") {
    return false;
  }

  const flags = (
    outputSchema as {
      flags?: {
        allowManualInput?: boolean;
      };
    }
  ).flags;

  return flags?.allowManualInput === true;
}

function toProjectInputColumn(
  column: MarbleColumn,
  table: ProjectTable,
): ProjectInputColumn {
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
}

export async function getProjectSourceWorkspaceData(projectId: string) {
  const resolved = await createServerMarbleSdkForProject(projectId);

  if (!resolved) {
    return null;
  }

  const { project, sdk } = resolved;
  const [tables, sources, sourceEvents] = await Promise.all([
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

      return table && hasAllowManualInput(column.outputSchema)
        ? [
            toProjectInputColumn(column, table),
          ]
        : [];
    }),
    pipes: dedupePipes(sourcePipes.flat()),
    project: {
      ...project,
      tableCount: tables.length,
      tables: projectTables,
    },
    sourceEvents,
    sources,
    webhookBaseUrl: getMarbleIngestorBaseUrl(),
  } satisfies ProjectSourceWorkspaceData;
}
