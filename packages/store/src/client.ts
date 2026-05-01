import { createResourceDeps } from "./db";
import { CellCollection, type CellCollectionApi } from "./resources/cell";
import { ColumnCollection, type ColumnCollectionApi } from "./resources/column";
import {
  ProjectCollection,
  type ProjectCollectionApi,
} from "./resources/project";
import { RowCollection, type RowCollectionApi } from "./resources/row";
import { TableCollection, type TableCollectionApi } from "./resources/table";
import type { MarbleStoreOptions } from "./types";

export class MarbleStore {
  readonly cells: CellCollectionApi;
  readonly columns: ColumnCollectionApi;
  readonly projects: ProjectCollectionApi;
  readonly rows: RowCollectionApi;
  readonly tables: TableCollectionApi;

  constructor(options: MarbleStoreOptions) {
    const deps = createResourceDeps(options);

    this.cells = new CellCollection(deps);
    this.columns = new ColumnCollection(deps);
    this.projects = new ProjectCollection(deps);
    this.rows = new RowCollection(deps);
    this.tables = new TableCollection(deps);
  }
}

export const createMarbleStore = (options: MarbleStoreOptions) =>
  new MarbleStore(options);

export class MarbleClient extends MarbleStore {}
