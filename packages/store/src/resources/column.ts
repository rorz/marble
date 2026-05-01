import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

export type Column = Entity<"column">;

export type CreateColumnInput = Pick<
  CreateParams<"column">,
  | "idx"
  | "inputTemplate"
  | "name"
  | "outputSchema"
  | "programVersionId"
  | "tableId"
> &
  Partial<Pick<CreateParams<"column">, "runCondition">>;

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
  readonly update: (id: string, input: UpdateColumnInput) => Promise<Column>;
};

export class ColumnCollection implements ColumnCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = (input: CreateColumnInput) =>
    this.deps.db.insert("column", input);

  public readonly delete = (id: string) => this.deps.db.delete("column", id);

  public readonly get = (id: string) => this.deps.db.get("column", id);

  public readonly list = (input: ListColumnsInput) =>
    this.deps.db.list("column", input);

  public readonly update = (id: string, input: UpdateColumnInput) =>
    this.deps.db.update("column", id, input);
}
