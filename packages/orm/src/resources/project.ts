import {
  type CallableCollection,
  CollectionResource,
  type CreateParams,
  type Entity,
  RecordResource,
  type ResourceIdentity,
  type UpdateParams,
} from "../types";
import { TableCollection, type TableRecord } from "./table";

type CreateProjectInput = Partial<
  Pick<CreateParams<"project">, "folderPath" | "name">
>;

type UpdateProjectInput = Partial<
  Pick<UpdateParams<"project">, "folderPath" | "name">
>;

export class ProjectCollection extends CollectionResource<
  "project",
  ProjectRecord
> {
  public readonly tableName = "project" as const;

  public readonly create = (
    input: CreateProjectInput = {},
  ): Promise<Entity<"project">> =>
    this.createRecord({
      folderPath: input.folderPath ?? [],
      name: input.name ?? "Untitled Project",
      ownerProfileId: this.context.profileId,
    });

  public readonly delete = this.defineDelete();

  public readonly list = (): Promise<Entity<"project">[]> =>
    this.listRecords({
      ownerProfileId: this.context.profileId,
    });

  public readonly retrieve = this.defineRetrieve();

  public readonly update = this.defineUpdate<
    {
      id: string;
    } & UpdateProjectInput
  >((input) => ({
    folderPath: input.folderPath,
    name: input.name,
  }));

  public tablesForProject(
    projectId: string,
  ): CallableCollection<TableRecord, TableCollection> {
    return this.createScopedCallableCollection(TableCollection, {
      projectId,
    });
  }

  protected override createRecordResource(
    identity: ResourceIdentity<"project">,
  ): ProjectRecord {
    return new ProjectRecord(this, identity);
  }
}

export class ProjectRecord extends RecordResource<
  "project",
  UpdateProjectInput,
  ProjectCollection
> {
  public readonly tables = this.collection.tablesForProject(this.id);
}
