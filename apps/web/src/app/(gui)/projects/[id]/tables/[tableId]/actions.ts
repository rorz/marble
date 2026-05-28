"use server";

import { createServerMarbleSdkForTable } from "@/lib/marble-sdk-server";
import { type FullProgram, hydrateEditorPrograms } from "@/lib/program-data";
import {
  listColumnSecretBindings,
  listLatestProgramSecretDeclarationsByProgramId,
  listProgramSecretBindingsForUser,
  listSecretsForUser,
} from "@/lib/secret-data";

type ProgramVersionForColumn = FullProgram["programVersions"][number] & {
  program: FullProgram;
};

type TableInfo = {
  createdAt: string;
  id: string;
  name: string;
  projectFolderPath: string[];
  projectId: string;
  projectName: string;
  projectOwnerProfileId: string;
  updatedAt: string;
};
const findProgramVersionForColumn = (
  programs: FullProgram[],
  programVersionId: string,
): ProgramVersionForColumn | null => {
  for (const program of programs) {
    for (const version of program.programVersions ?? []) {
      if (version.id === programVersionId) {
        return {
          ...version,
          program,
        };
      }
    }
  }

  return null;
};

const toTableInfo = (
  table: {
    createdAt: string;
    id: string;
    name: string;
    projectId: string;
    updatedAt: string;
  },
  project: {
    folderPath: string[];
    name: string;
    ownerProfileId: string;
  },
): TableInfo => {
  return {
    createdAt: table.createdAt,
    id: table.id,
    name: table.name,
    projectFolderPath: project.folderPath,
    projectId: table.projectId,
    projectName: project.name,
    projectOwnerProfileId: project.ownerProfileId,
    updatedAt: table.updatedAt,
  };
};

const loadTableData = async (
  resolved: NonNullable<
    Awaited<ReturnType<typeof createServerMarbleSdkForTable>>
  >,
  programs: FullProgram[],
) => {
  const [columns, rows] = await Promise.all([
    resolved.sdk.columns.list({
      tableId: resolved.table.id,
    }),
    resolved.sdk.rows.list({
      tableId: resolved.table.id,
    }),
  ]);
  const cellsByColumn = await Promise.all(
    columns.map((column) =>
      resolved.sdk.cells.list({
        columnId: column.id,
      }),
    ),
  );

  return {
    cells: cellsByColumn.flat(),
    columns: columns.map((column) => ({
      ...column,
      programVersion: findProgramVersionForColumn(
        programs,
        column.programVersionId,
      ),
    })),
    rows,
  };
};

export const loadTablePageDataForUser = async (
  userId: string,
  tableId: string,
) => {
  const resolved = await createServerMarbleSdkForTable(tableId);

  if (!resolved) {
    throw new Error("Table not found");
  }

  const programs = hydrateEditorPrograms(
    await resolved.sdk.programs.listForEditor({}),
  );
  const [data, referenceColumns] = await Promise.all([
    loadTableData(resolved, programs),
    resolved.sdk.columns.listReferenceable({
      projectId: resolved.project.id,
    }),
  ]);
  const [secrets, programSecretBindings, columnSecretBindings] =
    await Promise.all([
      listSecretsForUser(userId),
      listProgramSecretBindingsForUser(
        userId,
        programs.map((program) => program.id),
      ),
      listColumnSecretBindings(data.columns.map((column) => column.id)),
    ]);

  return {
    ...data,
    columnSecretBindings,
    programSecretBindings,
    programSecretDeclarations:
      listLatestProgramSecretDeclarationsByProgramId(programs),
    programs,
    referenceColumns,
    secrets,
    table: toTableInfo(resolved.table, resolved.project),
  };
};

export type TablePageData = Awaited<
  ReturnType<typeof loadTablePageDataForUser>
>;
