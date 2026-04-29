import { type CreateParams, Resource } from "../types";

export class Project extends Resource<"project"> {
  public readonly tableName = "project" as const;

  public readonly create = this.defineCreate<
    Pick<CreateParams<"project">, "folderPath" | "name">
  >((input) => ({
    folderPath: input.folderPath ?? [],
    name: input.name ?? "Untitled Project",
    ownerProfileId: this.context.profileId,
  }));

  public readonly retrieve = this.defineRetrieve();
}
