import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

export type Project = Entity<"project">;

export type CreateProjectInput = Partial<
  Pick<CreateParams<"project">, "folderPath" | "name">
>;

export type DeleteProjectInput = {
  projectId: string;
};

export type GetProjectInput = {
  projectId: string;
};

export type GetMostRecentProjectInput = Record<string, never>;

export type ListProjectsInput = Partial<Pick<Project, "name">>;

export type UpdateProjectInput = {
  projectId: string;
  values: Partial<Pick<UpdateParams<"project">, "folderPath" | "name">>;
};

export type ProjectCollectionApi = {
  readonly create: (input?: CreateProjectInput) => Promise<Project>;
  readonly delete: (input: DeleteProjectInput) => Promise<Project>;
  readonly get: (input: GetProjectInput) => Promise<Project>;
  readonly getMostRecentProject: (
    input?: GetMostRecentProjectInput,
  ) => Promise<Project | null>;
  readonly list: (input?: ListProjectsInput) => Promise<Project[]>;
  readonly update: (input: UpdateProjectInput) => Promise<Project>;
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

  public readonly delete = ({ projectId }: DeleteProjectInput) =>
    this.deps.db.delete("project", projectId, {
      ownerProfileId: this.ownerProfileId,
    });

  public readonly get = ({ projectId }: GetProjectInput) =>
    this.deps.db.get("project", projectId, {
      ownerProfileId: this.ownerProfileId,
    });

  public readonly getMostRecentProject = (_input?: GetMostRecentProjectInput) =>
    this.deps.db.first("project", {
      orderBy: {
        ascending: false,
        column: "createdAt",
      },
      where: {
        ownerProfileId: this.ownerProfileId,
      },
    });

  public readonly list = (input: ListProjectsInput = {}) =>
    this.deps.db.list("project", {
      name: input.name,
      ownerProfileId: this.ownerProfileId,
    });

  public readonly update = ({ projectId, values }: UpdateProjectInput) =>
    this.deps.db.update("project", projectId, values, {
      ownerProfileId: this.ownerProfileId,
    });
}
