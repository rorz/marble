import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

export type Project = Entity<"project">;

export type CreateProjectInput = Partial<
  Pick<CreateParams<"project">, "folderPath" | "name">
>;

export type UpdateProjectInput = Partial<
  Pick<UpdateParams<"project">, "folderPath" | "name">
>;

export type ListProjectsInput = Partial<Pick<Project, "name">>;

export type ProjectCollectionApi = {
  readonly create: (input?: CreateProjectInput) => Promise<Project>;
  readonly delete: (id: string) => Promise<Project>;
  readonly get: (id: string) => Promise<Project>;
  readonly list: (input?: ListProjectsInput) => Promise<Project[]>;
  readonly update: (id: string, input: UpdateProjectInput) => Promise<Project>;
};

export class ProjectCollection implements ProjectCollectionApi {
  private readonly ownerProfileId: string;

  public constructor(private readonly deps: ResourceDeps) {
    this.ownerProfileId = deps.context.profileId;
  }

  public readonly create = (input: CreateProjectInput = {}) =>
    this.deps.db.insert("project", {
      folderPath: input.folderPath ?? [],
      name: input.name ?? "Untitled Project",
      ownerProfileId: this.ownerProfileId,
    });

  public readonly delete = (id: string) =>
    this.deps.db.delete("project", id, {
      ownerProfileId: this.ownerProfileId,
    });

  public readonly get = (id: string) =>
    this.deps.db.get("project", id, {
      ownerProfileId: this.ownerProfileId,
    });

  public readonly list = (input: ListProjectsInput = {}) =>
    this.deps.db.list("project", {
      name: input.name,
      ownerProfileId: this.ownerProfileId,
    });

  public readonly update = (id: string, input: UpdateProjectInput) =>
    this.deps.db.update("project", id, input, {
      ownerProfileId: this.ownerProfileId,
    });
}
