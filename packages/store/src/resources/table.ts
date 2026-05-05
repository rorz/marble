import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

type Table = Entity<"table">;

type IdObject = {
  id: string;
};

type InsertRowsInput = IdObject & {
  idx: number;
  quantity: number;
};

type ListTablesInput = Pick<Table, "projectId">;

type UpdateTableInput = IdObject & {
  values: Partial<Pick<UpdateParams<"table">, "name">>;
};

export class TableCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = async (
    input: Pick<CreateParams<"table">, "projectId"> &
      Partial<Pick<CreateParams<"table">, "name">>,
  ) => {
    return this.deps.db.insert("table", {
      name: input.name ?? "Untitled Table",
      projectId: input.projectId,
    });
  };

  public readonly delete = (input: IdObject) =>
    this.deps.db.delete("table", input.id);

  public readonly get = (input: IdObject) =>
    this.deps.db.get("table", input.id);

  public readonly insertRows = (input: InsertRowsInput) =>
    this.deps.db.insertTableRows({
      idx: input.idx,
      ownerProfileId: this.deps.context.profileId,
      quantity: input.quantity,
      tableId: input.id,
    });

  public readonly list = (input: ListTablesInput) =>
    this.deps.db.list("table", input);

  public readonly update = (input: UpdateTableInput) =>
    this.deps.db.update("table", input.id, input.values);
}
