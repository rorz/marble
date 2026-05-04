import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";
import { ResourceAccess } from "./access";

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
  private readonly access: ResourceAccess;

  public constructor(private readonly deps: ResourceDeps) {
    this.access = new ResourceAccess(deps);
  }

  public readonly create = async (
    input: Pick<CreateParams<"table">, "projectId"> &
      Partial<Pick<CreateParams<"table">, "name">>,
  ) => {
    await this.access.requireProject(input.projectId);

    return this.deps.db.insert("table", {
      name: input.name ?? "Untitled Table",
      projectId: input.projectId,
    });
  };

  public readonly delete = async (input: IdObject) => {
    const table = await this.access.requireTable(input.id);
    return this.deps.db.delete("table", table.id);
  };

  public readonly get = (input: IdObject) => this.access.requireTable(input.id);

  public readonly insertRows = (input: InsertRowsInput) =>
    this.deps.db.insertTableRows({
      idx: input.idx,
      ownerProfileId: this.deps.context.profileId,
      quantity: input.quantity,
      tableId: input.id,
    });

  public readonly list = async (input: ListTablesInput) => {
    await this.access.requireProject(input.projectId);
    return this.deps.db.list("table", input);
  };

  public readonly update = async (input: UpdateTableInput) => {
    const table = await this.access.requireTable(input.id);
    return this.deps.db.update("table", table.id, input.values);
  };
}
