import { type CreateParams, Resource } from "../types";

type CreateProjectInput = Pick<CreateParams<"project">, "folderPath" | "name">;

export class ProjectResource extends Resource<"project"> {
  public readonly tableName = "project" as const;

  public readonly create = this.defineCreate<CreateProjectInput>((input) => ({
    folderPath: input.folderPath ?? [],
    name: input.name ?? "Untitled Project",
    ownerProfileId: this.context.profileId,
  }));

  public readonly retrieve = this.defineRetrieve();
}
