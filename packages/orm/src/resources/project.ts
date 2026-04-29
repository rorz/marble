import {
  CollectionResource,
  type CreateParams,
  type Entity,
  type UpdateParams,
} from "../types";

export type CreateProjectInput = Partial<
  Pick<CreateParams<"project">, "folderPath" | "name">
>;

export type UpdateProjectInput = Partial<
  Pick<UpdateParams<"project">, "folderPath" | "name">
>;

export type ProjectCollectionApi = {
  readonly create: (input?: CreateProjectInput) => Promise<Entity<"project">>;
  readonly delete: (id: string) => Promise<Entity<"project">>;
  readonly get: (id: string) => Promise<Entity<"project">>;
  readonly list: () => Promise<Entity<"project">[]>;
  readonly update: (
    id: string,
    input: UpdateProjectInput,
  ) => Promise<Entity<"project">>;
};

export class ProjectCollection
  extends CollectionResource<"project">
  implements ProjectCollectionApi
{
  public readonly tableName = "project" as const;

  public readonly create = (
    input: CreateProjectInput = {},
  ): Promise<Entity<"project">> =>
    this.createRecord({
      folderPath: input.folderPath ?? [],
      name: input.name ?? "Untitled Project",
      ownerProfileId: this.context.profileId,
    });

  public readonly delete = (id: string): Promise<Entity<"project">> =>
    this.deleteRecord(id, this.ownerScope());

  public readonly get = (id: string): Promise<Entity<"project">> =>
    this.getRecord(id, this.ownerScope());

  public readonly list = (): Promise<Entity<"project">[]> =>
    this.listRecords(this.ownerScope());

  public readonly update = (
    id: string,
    input: UpdateProjectInput,
  ): Promise<Entity<"project">> =>
    this.updateRecord(id, input, this.ownerScope());

  private ownerScope(): Pick<Entity<"project">, "ownerProfileId"> {
    return {
      ownerProfileId: this.context.profileId,
    };
  }
}
