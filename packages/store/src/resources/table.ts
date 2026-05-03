import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

type Table = Entity<"table">;

type IdObject = {
  id: string;
};

export class TableCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = (
    input: Pick<CreateParams<"table">, "projectId"> &
      Partial<Pick<CreateParams<"table">, "name">>,
  ) =>
    this.deps.db.insert("table", {
      name: input.name ?? "Untitled Table",
      projectId: input.projectId,
    });

  public readonly delete = (input: IdObject) =>
    this.deps.db.delete("table", input.id);

  public readonly get = (input: IdObject) =>
    this.deps.db.get("table", input.id);

  public readonly list = (input: Partial<Pick<Table, "projectId">> = {}) =>
    this.deps.db.list("table", input);

  public readonly update = (
    id: string,
    input: Partial<Pick<UpdateParams<"table">, "name">>,
  ) => this.deps.db.update("table", id, input);
}
