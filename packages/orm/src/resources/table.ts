import {
  CollectionResource,
  type CreateParams,
  type Entity,
  type ListParams,
  RecordResource,
  type ResourceIdentity,
  type UpdateParams,
} from "../types";

type TableScope = Partial<Pick<ListParams<"table">, "projectId">>;

type CreateTableInput = Partial<Pick<CreateParams<"table">, "name">> &
  Partial<Pick<CreateParams<"table">, "projectId">>;

type UpdateTableInput = Partial<Pick<UpdateParams<"table">, "name">>;

export class TableCollection extends CollectionResource<"table", TableRecord> {
  public readonly tableName = "table" as const;

  public readonly create = (
    input: CreateTableInput = {},
  ): Promise<Entity<"table">> =>
    this.createRecord({
      name: input.name ?? "Untitled Table",
      projectId: this.requireProjectId(input.projectId),
    });

  public readonly delete = this.defineDelete();

  public readonly list = (input: TableScope = {}): Promise<Entity<"table">[]> =>
    this.listRecords(input);

  public readonly retrieve = this.defineRetrieve();

  public readonly update = this.defineUpdate<
    {
      id: string;
    } & UpdateTableInput
  >((input) => ({
    name: input.name,
  }));

  protected override createRecordResource(
    identity: ResourceIdentity<"table">,
  ): TableRecord {
    return new TableRecord(this, identity);
  }

  private requireProjectId(projectId?: string): string {
    const scopedProjectId = this.scope.projectId;

    if (scopedProjectId !== undefined) {
      if (projectId !== undefined && projectId !== scopedProjectId) {
        throw new Error("Cannot create a table outside the scoped project.");
      }

      return scopedProjectId;
    }

    if (projectId === undefined) {
      throw new Error("projectId is required to create a table.");
    }

    return projectId;
  }
}

export class TableRecord extends RecordResource<
  "table",
  UpdateTableInput,
  TableCollection
> {}
