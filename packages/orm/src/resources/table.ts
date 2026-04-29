import {
  CollectionResource,
  type CreateParams,
  type Entity,
  type UpdateParams,
} from "../types";

export type CreateTableInput = Pick<CreateParams<"table">, "projectId"> &
  Partial<Pick<CreateParams<"table">, "name">>;

export type ListTablesInput = Pick<Entity<"table">, "projectId">;

export type UpdateTableInput = Partial<Pick<UpdateParams<"table">, "name">>;

export type TableCollectionApi = {
  readonly create: (input: CreateTableInput) => Promise<Entity<"table">>;
  readonly delete: (id: string) => Promise<Entity<"table">>;
  readonly get: (id: string) => Promise<Entity<"table">>;
  readonly list: (input: ListTablesInput) => Promise<Entity<"table">[]>;
  readonly update: (
    id: string,
    input: UpdateTableInput,
  ) => Promise<Entity<"table">>;
};

export class TableCollection
  extends CollectionResource<"table">
  implements TableCollectionApi
{
  public readonly tableName = "table" as const;

  public readonly create = (
    input: CreateTableInput,
  ): Promise<Entity<"table">> =>
    this.createRecord({
      name: input.name ?? "Untitled Table",
      projectId: input.projectId,
    });

  public readonly delete = (id: string): Promise<Entity<"table">> =>
    this.deleteRecord(id);

  public readonly get = (id: string): Promise<Entity<"table">> =>
    this.getRecord(id);

  public readonly list = (input: ListTablesInput): Promise<Entity<"table">[]> =>
    this.listRecords(input);

  public readonly update = (
    id: string,
    input: UpdateTableInput,
  ): Promise<Entity<"table">> => this.updateRecord(id, input);
}
