import { describe, expect, test } from "bun:test";
import type { ResourceDeps } from "../src/db";
import { replaceColumnDependencies } from "../src/resources/entities/column/dependency";

const TARGET_COLUMN_ID = "00000000-0000-4000-8000-000000000001";
const SAME_PROJECT_SOURCE_COLUMN_ID = "00000000-0000-4000-8000-000000000002";
const OTHER_PROJECT_SOURCE_COLUMN_ID = "00000000-0000-4000-8000-000000000003";
const TARGET_TABLE_ID = "00000000-0000-4000-8000-000000000101";
const SAME_PROJECT_TABLE_ID = "00000000-0000-4000-8000-000000000102";
const OTHER_PROJECT_TABLE_ID = "00000000-0000-4000-8000-000000000103";
const TARGET_PROJECT_ID = "00000000-0000-4000-8000-000000000201";
const OTHER_PROJECT_ID = "00000000-0000-4000-8000-000000000202";

type ColumnRow = {
  id: string;
  table_id: string;
};

type TableRow = {
  id: string;
  project_id: string;
};

type DependencySupabaseFixture = {
  client: ResourceDeps["supabase"];
  deletedTargets: string[];
  insertedRows: unknown[];
};

const createDependencySupabaseFixture = ({
  columns,
  tables,
}: {
  columns: ColumnRow[];
  tables: TableRow[];
}): DependencySupabaseFixture => {
  const deletedTargets: string[] = [];
  const insertedRows: unknown[] = [];
  const client = {
    from: (tableName: string) => {
      if (tableName === "column") {
        return {
          select: () => ({
            in: (_field: string, ids: string[]) =>
              Promise.resolve({
                data: columns.filter((column) => ids.includes(column.id)),
                error: null,
              }),
          }),
        };
      }

      if (tableName === "table") {
        return {
          select: () => ({
            in: (_field: string, ids: string[]) =>
              Promise.resolve({
                data: tables.filter((table) => ids.includes(table.id)),
                error: null,
              }),
          }),
        };
      }

      if (tableName === "column_dependency") {
        return {
          delete: () => ({
            eq: (_field: string, value: string) => {
              deletedTargets.push(value);
              return Promise.resolve({
                error: null,
              });
            },
          }),
          insert: (rows: unknown[]) => {
            insertedRows.push(...rows);
            return Promise.resolve({
              error: null,
            });
          },
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    },
  } as unknown as ResourceDeps["supabase"];

  return {
    client,
    deletedTargets,
    insertedRows,
  };
};

const createDeps = (supabase: ResourceDeps["supabase"]): ResourceDeps => ({
  actions: {},
  context: {},
  db: {} as ResourceDeps["db"],
  supabase,
});

const createInputTemplate = (sourceColumnId: string) =>
  JSON.stringify({
    "email.$": `$.columns.${sourceColumnId}.value`,
  });

describe("replaceColumnDependencies", () => {
  test("rejects cross-project dependencies before replacing existing rows", async () => {
    const fixture = createDependencySupabaseFixture({
      columns: [
        {
          id: TARGET_COLUMN_ID,
          table_id: TARGET_TABLE_ID,
        },
        {
          id: OTHER_PROJECT_SOURCE_COLUMN_ID,
          table_id: OTHER_PROJECT_TABLE_ID,
        },
      ],
      tables: [
        {
          id: TARGET_TABLE_ID,
          project_id: TARGET_PROJECT_ID,
        },
        {
          id: OTHER_PROJECT_TABLE_ID,
          project_id: OTHER_PROJECT_ID,
        },
      ],
    });

    await expect(
      replaceColumnDependencies(
        createDeps(fixture.client),
        TARGET_COLUMN_ID,
        createInputTemplate(OTHER_PROJECT_SOURCE_COLUMN_ID),
      ),
    ).rejects.toThrow("same project");
    expect(fixture.deletedTargets).toEqual([]);
    expect(fixture.insertedRows).toEqual([]);
  });

  test("replaces dependencies that stay inside the target project", async () => {
    const fixture = createDependencySupabaseFixture({
      columns: [
        {
          id: TARGET_COLUMN_ID,
          table_id: TARGET_TABLE_ID,
        },
        {
          id: SAME_PROJECT_SOURCE_COLUMN_ID,
          table_id: SAME_PROJECT_TABLE_ID,
        },
      ],
      tables: [
        {
          id: TARGET_TABLE_ID,
          project_id: TARGET_PROJECT_ID,
        },
        {
          id: SAME_PROJECT_TABLE_ID,
          project_id: TARGET_PROJECT_ID,
        },
      ],
    });

    await replaceColumnDependencies(
      createDeps(fixture.client),
      TARGET_COLUMN_ID,
      createInputTemplate(SAME_PROJECT_SOURCE_COLUMN_ID),
    );

    expect(fixture.deletedTargets).toEqual([
      TARGET_COLUMN_ID,
    ]);
    expect(fixture.insertedRows).toEqual([
      {
        source_column_id: SAME_PROJECT_SOURCE_COLUMN_ID,
        target_column_id: TARGET_COLUMN_ID,
      },
    ]);
  });
});
