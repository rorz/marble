import type { ProgramConfig } from "@marble/contracts";
import type { Json, SupabaseClient } from "@marble/supabase";
import type { ResourceDeps } from "../../../db";
import type { CreateParams, Entity, UpdateParams } from "../../../types";
import {
  getProgramConfigOutputSchema,
  loadProgramConfigForVersion,
  programConfigAllowsManualInput,
} from "../program-file/config";
import {
  deleteColumnDependencies,
  replaceColumnDependencies,
} from "./dependency";

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

type GetColumnInput = Pick<Column, "id">;

type DeleteColumnInput = Pick<Column, "id">;

type UpdateColumnParams = Pick<Column, "id"> & {
  values: UpdateColumnInput;
};

export type ColumnCollectionApi = {
  readonly create: (input: CreateColumnInput) => Promise<Column>;
  readonly delete: (input: DeleteColumnInput) => Promise<Column>;
  readonly get: (input: GetColumnInput) => Promise<Column>;
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
  readonly update: (input: UpdateColumnParams) => Promise<Column>;
};

const asJson = (value: unknown): Json => value as Json;

const loadColumnProgramConfig = async (
  deps: ResourceDeps,
  versionId: string,
): Promise<ProgramConfig> => {
  try {
    return await loadProgramConfigForVersion(
      deps.serviceSupabase ?? deps.supabase,
      versionId,
    );
  } catch (error) {
    throw new Error(
      "Program version must include a readable marbleconfig.jsonc before it can be used for a column.",
      {
        cause: error,
      },
    );
  }
};

const loadProgramVersionAllowsManualInput = async (
  supabase: SupabaseClient,
  versionId: string,
) => {
  try {
    return programConfigAllowsManualInput(
      await loadProgramConfigForVersion(supabase, versionId),
    );
  } catch (error) {
    void error;
    return false;
  }
};

export class ColumnCollection implements ColumnCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = async (input: CreateColumnInput) => {
    const programConfig = await loadColumnProgramConfig(
      this.deps,
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
        input.outputSchema ?? getProgramConfigOutputSchema(programConfig),
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

  public readonly delete = async ({ id }: DeleteColumnInput) => {
    const column = await this.get({
      id,
    });
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

  public readonly get = ({ id }: GetColumnInput) =>
    this.deps.db.get("column", id);

  public readonly list = (input: ListColumnsInput) =>
    this.deps.db.list("column", input);

  public readonly listReferenceable = async () => {
    const [projects, allProgramVersions] = await Promise.all([
      this.deps.db.list("project"),
      this.deps.db.list("program_version"),
    ]);
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
    const programVersionAllowsManualInputById = new Map(
      await Promise.all(
        allProgramVersions.map(
          async (version) =>
            [
              version.id,
              await loadProgramVersionAllowsManualInput(
                this.deps.serviceSupabase ?? this.deps.supabase,
                version.id,
              ),
            ] as const,
        ),
      ),
    );

    return columns.flat().flatMap((column) => {
      const table = tableById.get(column.tableId);
      const project = table ? projectById.get(table.projectId) : null;

      if (!table || !project) {
        return [];
      }

      return [
        {
          allowManualInput:
            programVersionAllowsManualInputById.get(column.programVersionId) ===
            true,
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

  public readonly update = async ({ id, values }: UpdateColumnParams) => {
    const programConfig =
      values.programVersionId === undefined
        ? null
        : await loadColumnProgramConfig(this.deps, values.programVersionId);
    const nextOutputSchema =
      values.outputSchema !== undefined
        ? values.outputSchema
        : programConfig
          ? getProgramConfigOutputSchema(programConfig)
          : undefined;
    const column = await this.deps.db.update("column", id, {
      ...values,
      ...(nextOutputSchema === undefined
        ? {}
        : {
            outputSchema: asJson(nextOutputSchema),
          }),
      ...(values.runCondition === undefined
        ? {}
        : {
            runCondition: asJson(values.runCondition),
          }),
    });

    if (values.inputTemplate !== undefined) {
      await replaceColumnDependencies(this.deps, id, values.inputTemplate);
    }

    return column;
  };
}
