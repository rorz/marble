import type { ListOptions, ResourceDeps } from "../../db";
import type { CreateParams, Entity, UpdateParams } from "../../types";
import { requireProfileId } from "../../types";

type Project = Entity<"project">;

type ProjectIdObject = {
  projectId: string;
};

type UpdateProjectInput = ProjectIdObject & {
  values: Partial<Pick<UpdateParams<"project">, "folderPath" | "name">>;
};

export class ProjectCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  private readonly actorProfileId = () => requireProfileId(this.deps.context);

  public readonly create = (
    input: Partial<Pick<CreateParams<"project">, "folderPath" | "name">> = {},
  ) =>
    this.deps.db.insert("project", {
      folderPath: input.folderPath ?? [],
      name: input.name ?? "Untitled Project",
      ownerProfileId: this.actorProfileId(),
    });

  public readonly delete = ({ projectId }: ProjectIdObject) =>
    this.deps.db.delete("project", projectId);

  public readonly get = ({ projectId }: ProjectIdObject) =>
    this.deps.db.get("project", projectId);

  public readonly list = (
    input: Partial<Pick<Project, "name">> = {},
    options?: ListOptions<"project">,
  ) =>
    this.deps.db.list(
      "project",
      {
        name: input.name,
      },
      options,
    );

  public readonly update = ({ projectId, values }: UpdateProjectInput) =>
    this.deps.db.update("project", projectId, values);
}
