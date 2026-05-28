import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = resolve(
  THIS_DIR,
  "../migrations/20260423153000_squashed_schema.sql",
);
const migrationSql = readFileSync(MIGRATION_PATH, "utf-8");
const normalizedMigrationSql = migrationSql.replaceAll(/\s+/g, " ").trim();

const foreignKeySpecs = [
  "cell|cell_column_id_fkey|column_id|column|id|CASCADE",
  "cell|cell_row_id_fkey|row_id|row|id|CASCADE",
  "column_dependency|column_dependency_source_column_id_fkey|source_column_id|column|id|CASCADE",
  "column_dependency|column_dependency_target_column_id_fkey|target_column_id|column|id|CASCADE",
  "column|column_program_version_id_fkey|program_version_id|program_version|id|CASCADE",
  "column|column_table_id_fkey|table_id|table|id|CASCADE",
  "column_secret_binding|column_secret_binding_column_id_fkey|column_id|column|id|CASCADE",
  "pipe|pipe_source_id_fkey|source_id|source|id|CASCADE",
  "pipe|pipe_table_id_fkey|table_id|table|id|CASCADE",
  "program|fk_program_forked_from|forked_from_version_id|program_version|id|SET NULL",
  "program_file|program_file_version_id_fkey|version_id|program_version|id|CASCADE",
  "program_run|program_run_program_version_id_fkey|program_version_id|program_version|id|CASCADE",
  "program_run|program_run_target_cell_id_fkey|target_cell_id|cell|id|CASCADE",
  "program_secret_binding|program_secret_binding_program_id_fkey|program_id|program|id|CASCADE",
  "program_version|program_version_program_id_fkey|program_id|program|id|CASCADE",
  "source_event|source_event_source_id_project_id_fkey|source_id,project_id|source|id,project_id|CASCADE",
  "source_event|source_event_project_id_fkey|project_id|project|id|CASCADE",
  "source|source_project_id_fkey|project_id|project|id|CASCADE",
  "row|row_table_id_fkey|table_id|table|id|CASCADE",
  "table|table_project_id_fkey|project_id|project|id|CASCADE",
] as const;

const indexSpecs = [
  "cell|cell_column_idx|column_id",
  "column_dependency|column_dependency_source_idx|source_column_id",
  "column_dependency|column_dependency_target_idx|target_column_id",
  "column|column_program_version_idx|program_version_id",
  "program_file|program_file_version_idx|version_id",
  "program|program_forked_from_version_idx|forked_from_version_id",
  "program_run|program_run_program_version_idx|program_version_id",
  "program_run|program_run_target_cell_idx|target_cell_id",
  "program_secret_binding|program_secret_binding_program_idx|program_id",
  "program_version|program_version_program_idx|program_id",
] as const;

const quoteIdentifier = (identifier: string) => `"${identifier}"`;
const formatColumnList = (columns: string) =>
  columns.split(",").map(quoteIdentifier).join(", ");
const normalizeSql = (sql: string) => sql.replaceAll(/\s+/g, " ").trim();
const requirePart = (value: string | undefined, spec: string) => {
  if (value === undefined || value.length === 0) {
    throw new Error(`Malformed cascade schema spec: ${spec}`);
  }

  return value;
};

const expectedForeignKeySql = (spec: string) => {
  const [
    table,
    constraintName,
    columns,
    referencedTable,
    referencedColumns,
    action,
  ] = spec.split("|").map((value) => requirePart(value, spec));

  return normalizeSql(`
    ALTER TABLE ONLY "public"."${table}"
      ADD CONSTRAINT "${constraintName}"
      FOREIGN KEY (${formatColumnList(columns)})
      REFERENCES "public"."${referencedTable}"(${formatColumnList(referencedColumns)})
      ON DELETE ${action};
  `);
};

const expectedIndexSql = (spec: string) => {
  const [table, name, columns] = spec
    .split("|")
    .map((value) => requirePart(value, spec));

  return normalizeSql(`
    CREATE INDEX "${name}"
      ON "public"."${table}"
      USING "btree" (${formatColumnList(columns)});
  `);
};

describe("cascade delete schema", () => {
  test("keeps aggregate-owned relationships cascading from parent deletes", () => {
    for (const foreignKeySpec of foreignKeySpecs) {
      expect(normalizedMigrationSql).toContain(
        expectedForeignKeySql(foreignKeySpec),
      );
    }
  });

  test("indexes cascade child columns without an existing left-prefix index", () => {
    for (const indexSpec of indexSpecs) {
      expect(normalizedMigrationSql).toContain(expectedIndexSql(indexSpec));
    }
  });
});
