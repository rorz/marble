import type { Json } from "@marble/supabase";
import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

export type Column = Entity<"column">;

export type CreateColumnInput = Pick<
  CreateParams<"column">,
  "inputTemplate" | "name" | "programVersionId" | "tableId"
> &
  Partial<
    Pick<CreateParams<"column">, "idx" | "outputSchema" | "runCondition">
  >;

export type ListColumnsInput = Pick<Column, "tableId">;

export type UpdateColumnInput = Partial<
  Pick<
    UpdateParams<"column">,
    | "idx"
    | "inputTemplate"
    | "name"
    | "outputSchema"
    | "programVersionId"
    | "runCondition"
  >
>;

export type ColumnCollectionApi = {
  readonly create: (input: CreateColumnInput) => Promise<Column>;
  readonly delete: (id: string) => Promise<Column>;
  readonly get: (id: string) => Promise<Column>;
  readonly list: (input: ListColumnsInput) => Promise<Column[]>;
  readonly listReferenceable: () => Promise<
    Array<
      Pick<Column, "id" | "name" | "tableId"> & {
        allowManualInput: boolean;
        label: string;
        projectId: string;
        projectName: string;
        tableName: string;
      }
    >
  >;
  readonly update: (id: string, input: UpdateColumnInput) => Promise<Column>;
};

function getOutputSchema(outputConfig: unknown) {
  if (!outputConfig || typeof outputConfig !== "object") {
    return {};
  }

  return "schema" in outputConfig ? outputConfig.schema : {};
}

function hasAllowManualInput(outputSchema: unknown) {
  if (!outputSchema || typeof outputSchema !== "object") {
    return false;
  }

  return (
    (
      outputSchema as {
        flags?: {
          allowManualInput?: boolean;
        };
      }
    ).flags?.allowManualInput === true
  );
}

const asJson = (value: unknown): Json => value as Json;

function extractDependenciesFromTemplate(template: string) {
  const sourceColumnIds = new Set<string>();
  let parsedTemplate: unknown;

  try {
    parsedTemplate = JSON.parse(template);
  } catch {
    return [];
  }

  const jsonPathPattern = /^\$\.columns\.([a-f0-9-]+)\./;
  const interpolationPattern = /\{\{\$\.columns\.([a-f0-9-]+)\.[^}]+\}\}/g;

  const visit = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(interpolationPattern)) {
        sourceColumnIds.add(match[1]);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (
          key === "$marble_ref" &&
          Array.isArray(entry) &&
          entry[0] === "columns"
        ) {
          sourceColumnIds.add(String(entry[1]));
        } else if (key.endsWith(".$") && typeof entry === "string") {
          const match = entry.match(jsonPathPattern);

          if (match) {
            sourceColumnIds.add(match[1]);
          }
        }

        visit(entry);
      }
    }
  };

  visit(parsedTemplate);
  return Array.from(sourceColumnIds);
}

async function replaceColumnDependencies(
  deps: ResourceDeps,
  columnId: string,
  inputTemplate: string,
) {
  const supabase = deps.serviceSupabase ?? deps.supabase;
  const sourceColumnIds = extractDependenciesFromTemplate(inputTemplate);
  const deleteResult = await supabase
    .from("column_dependency")
    .delete()
    .eq("target_column_id", columnId);

  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  if (sourceColumnIds.length === 0) {
    return;
  }

  const insertResult = await supabase.from("column_dependency").insert(
    sourceColumnIds.map((sourceColumnId) => ({
      source_column_id: sourceColumnId,
      target_column_id: columnId,
    })),
  );

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }
}

async function deleteColumnDependencies(deps: ResourceDeps, columnId: string) {
  const supabase = deps.serviceSupabase ?? deps.supabase;

  const [sourceResult, targetResult] = await Promise.all([
    supabase
      .from("column_dependency")
      .delete()
      .eq("source_column_id", columnId),
    supabase
      .from("column_dependency")
      .delete()
      .eq("target_column_id", columnId),
  ]);

  if (sourceResult.error || targetResult.error) {
    throw new Error(
      sourceResult.error?.message ??
        targetResult.error?.message ??
        "Could not delete column dependencies.",
    );
  }
}

export class ColumnCollection implements ColumnCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = async (input: CreateColumnInput) => {
    const programVersion = await this.deps.db.get(
      "program_version",
      input.programVersionId,
    );
    const idx =
      input.idx ??
      ((
        await this.deps.db.first("column", {
          orderBy: {
            ascending: false,
            column: "idx",
          },
          where: {
            tableId: input.tableId,
          },
        })
      )?.idx ?? -1) + 1;
    const column = await this.deps.db.insert("column", {
      idx,
      inputTemplate: input.inputTemplate,
      name: input.name,
      outputSchema: asJson(
        input.outputSchema ?? getOutputSchema(programVersion.outputConfig),
      ),
      programVersionId: input.programVersionId,
      runCondition: asJson(input.runCondition ?? false),
      tableId: input.tableId,
    });
    const rows = await this.deps.db.list("row", {
      tableId: input.tableId,
    });

    await Promise.all(
      rows.map((row) =>
        this.deps.db.insert("cell", {
          columnId: column.id,
          rowId: row.id,
        }),
      ),
    );
    await replaceColumnDependencies(this.deps, column.id, input.inputTemplate);

    return column;
  };

  public readonly delete = async (id: string) => {
    const column = await this.get(id);
    const cells = await this.deps.db.list("cell", {
      columnId: id,
    });

    if (cells.length > 0) {
      const { error: runError } = await (
        this.deps.serviceSupabase ?? this.deps.supabase
      )
        .from("program_run")
        .delete()
        .in(
          "target_cell_id",
          cells.map((cell) => cell.id),
        );

      if (runError) {
        throw new Error(runError.message);
      }
    }

    const { error: cellError } = await this.deps.supabase
      .from("cell")
      .delete()
      .eq("column_id", id);

    if (cellError) {
      throw new Error(cellError.message);
    }

    await deleteColumnDependencies(this.deps, id);
    await this.deps.db.delete("column", id);
    return column;
  };

  public readonly get = (id: string) => this.deps.db.get("column", id);

  public readonly list = (input: ListColumnsInput) =>
    this.deps.db.list("column", input);

  public readonly listReferenceable = async () => {
    const projects = await this.deps.db.list("project");
    const tables = await Promise.all(
      projects.map((project) =>
        this.deps.db.list("table", {
          projectId: project.id,
        }),
      ),
    );
    const flatTables = tables.flat();
    const columns = await Promise.all(
      flatTables.map((table) =>
        this.deps.db.list("column", {
          tableId: table.id,
        }),
      ),
    );
    const projectById = new Map(
      projects.map((project) => [
        project.id,
        project,
      ]),
    );
    const tableById = new Map(
      flatTables.map((table) => [
        table.id,
        table,
      ]),
    );

    return columns.flat().flatMap((column) => {
      const table = tableById.get(column.tableId);
      const project = table ? projectById.get(table.projectId) : null;

      if (!table || !project) {
        return [];
      }

      return [
        {
          allowManualInput: hasAllowManualInput(column.outputSchema),
          id: column.id,
          label: `${project.name} / ${table.name} / ${column.name}`,
          name: column.name,
          projectId: project.id,
          projectName: project.name,
          tableId: table.id,
          tableName: table.name,
        },
      ];
    });
  };

  public readonly update = async (id: string, input: UpdateColumnInput) => {
    const programVersion =
      input.programVersionId === undefined
        ? null
        : await this.deps.db.get("program_version", input.programVersionId);
    const column = await this.deps.db.update("column", id, {
      ...input,
      ...(input.outputSchema === undefined && programVersion === null
        ? {}
        : {
            outputSchema: asJson(
              input.outputSchema ??
                getOutputSchema(programVersion?.outputConfig),
            ),
          }),
      ...(input.runCondition === undefined
        ? {}
        : {
            runCondition: asJson(input.runCondition),
          }),
    });

    if (input.inputTemplate !== undefined) {
      await replaceColumnDependencies(this.deps, id, input.inputTemplate);
    }

    return column;
  };
}
