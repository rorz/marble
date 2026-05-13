import type { ResourceDeps } from "../../db";
import type { CreateParams, Entity, UpdateParams } from "../../types";

export type Row = Entity<"row">;

export type CreateRowInput = Pick<CreateParams<"row">, "idx" | "tableId">;

export type ListRowsInput = Pick<Row, "tableId">;

export type GetRowInput = Pick<Row, "id">;

export type DeleteRowInput = Pick<Row, "id">;

export type UpdateRowInput = Partial<Pick<UpdateParams<"row">, "idx">>;

export type UpdateRowParams = Pick<Row, "id"> & {
  values: UpdateRowInput;
};

export type RowCollectionApi = {
  readonly create: (input: CreateRowInput) => Promise<Row>;
  readonly delete: (input: DeleteRowInput) => Promise<Row>;
  readonly get: (input: GetRowInput) => Promise<Row>;
  readonly list: (input: ListRowsInput) => Promise<Row[]>;
  readonly update: (input: UpdateRowParams) => Promise<Row>;
};

export class RowCollection implements RowCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = (input: CreateRowInput) =>
    this.deps.db.insert("row", input);

  public readonly delete = async ({ id }: DeleteRowInput) => {
    const row = await this.get({
      id,
    });
    const cells = await this.deps.db.list("cell", {
      rowId: id,
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
      .eq("row_id", id);

    if (cellError) {
      throw new Error(cellError.message);
    }

    await this.deps.db.delete("row", id);
    return row;
  };

  public readonly get = ({ id }: GetRowInput) => this.deps.db.get("row", id);

  public readonly list = (input: ListRowsInput) =>
    this.deps.db.list("row", input);

  public readonly update = ({ id, values }: UpdateRowParams) =>
    this.deps.db.update("row", id, values);
}
