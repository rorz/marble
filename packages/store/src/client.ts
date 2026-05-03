import { createResourceDeps } from "./db";
import { CellCollection } from "./resources/cell";
import { ColumnCollection } from "./resources/column";
import { ProjectCollection } from "./resources/project";
import { RowCollection } from "./resources/row";
import { TableCollection } from "./resources/table";
import type { MarbleStoreOptions } from "./types";

export class MarbleStore {
  readonly cells: CellCollection;
  readonly columns: ColumnCollection;
  readonly projects: ProjectCollection;
  readonly rows: RowCollection;
  readonly tables: TableCollection;

  constructor(options: MarbleStoreOptions) {
    const deps = createResourceDeps(options);

    this.cells = new CellCollection(deps);
    this.columns = new ColumnCollection(deps);
    this.projects = new ProjectCollection(deps);
    this.rows = new RowCollection(deps);
    this.tables = new TableCollection(deps);
  }
}
