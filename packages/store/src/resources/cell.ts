import type { ResourceDeps } from "../db";
import type { CellRunInput, CellRunResult, Entity } from "../types";

export type Cell = Entity<"cell">;

export type ListCellsInput =
  | (Pick<Cell, "columnId"> & Partial<Pick<Cell, "rowId">>)
  | (Pick<Cell, "rowId"> & Partial<Pick<Cell, "columnId">>);

export type CellCollectionApi = {
  readonly get: (id: string) => Promise<Cell>;
  readonly list: (input: ListCellsInput) => Promise<Cell[]>;
  readonly run: (id: string, input?: CellRunInput) => Promise<CellRunResult>;
  readonly setManualValue: (id: string, value: string | null) => Promise<Cell>;
};

export class CellCollection implements CellCollectionApi {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly get = (id: string) => this.deps.db.get("cell", id);

  public readonly list = (input: ListCellsInput) =>
    this.deps.db.list("cell", input);

  public readonly run = (id: string, input?: CellRunInput) => {
    if (!this.deps.actions.runCell) {
      throw new Error("Cell run requires a runCell action.");
    }

    return this.deps.actions.runCell(id, input);
  };

  public readonly setManualValue = (id: string, value: string | null) =>
    this.deps.db.update("cell", id, {
      manualInput: value,
    });
}
