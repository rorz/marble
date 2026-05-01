import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

export type Table = Entity<"table">;

export type CreateTableInput = Pick<CreateParams<"table">, "projectId"> &
  Partial<Pick<CreateParams<"table">, "name">>;

export type ListTablesInput = Pick<Table, "projectId">;

export type UpdateTableInput = Partial<Pick<UpdateParams<"table">, "name">>;

export type TableCollectionApi = {
  readonly create: (input: CreateTableInput) => Promise<Table>;
  readonly delete: (id: string) => Promise<Table>;
  readonly get: (id: string) => Promise<Table>;
  readonly list: (input: ListTablesInput) => Promise<Table[]>;
  readonly update: (id: string, input: UpdateTableInput) => Promise<Table>;
};

export class TableCollection implements TableCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = (input: CreateTableInput) =>
    this.deps.db.insert("table", {
      name: input.name ?? "Untitled Table",
      projectId: input.projectId,
    });

  public readonly delete = (id: string) => this.deps.db.delete("table", id);

  public readonly get = (id: string) => this.deps.db.get("table", id);

  public readonly list = (input: ListTablesInput) =>
    this.deps.db.list("table", input);

  public readonly update = (id: string, input: UpdateTableInput) =>
    this.deps.db.update("table", id, input);
}
