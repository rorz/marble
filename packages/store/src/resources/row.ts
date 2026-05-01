import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

export type Row = Entity<"row">;

export type CreateRowInput = Pick<CreateParams<"row">, "idx" | "tableId">;

export type ListRowsInput = Pick<Row, "tableId">;

export type UpdateRowInput = Partial<Pick<UpdateParams<"row">, "idx">>;

export type RowCollectionApi = {
  readonly create: (input: CreateRowInput) => Promise<Row>;
  readonly delete: (id: string) => Promise<Row>;
  readonly get: (id: string) => Promise<Row>;
  readonly list: (input: ListRowsInput) => Promise<Row[]>;
  readonly update: (id: string, input: UpdateRowInput) => Promise<Row>;
};

export class RowCollection implements RowCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = (input: CreateRowInput) =>
    this.deps.db.insert("row", input);

  public readonly delete = (id: string) => this.deps.db.delete("row", id);

  public readonly get = (id: string) => this.deps.db.get("row", id);

  public readonly list = (input: ListRowsInput) =>
    this.deps.db.list("row", input);

  public readonly update = (id: string, input: UpdateRowInput) =>
    this.deps.db.update("row", id, input);
}
