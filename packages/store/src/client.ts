import { createResourceDeps } from "./db";
import { CellCollection } from "./resources/cell";
import { ColumnCollection } from "./resources/column";
import { PipeCollection } from "./resources/pipe";
import { ProjectCollection } from "./resources/project";
import { RowCollection } from "./resources/row";
import { SourceCollection } from "./resources/source";
import { SourceEventCollection } from "./resources/source-event";
import { TableCollection } from "./resources/table";
import type { MarbleStoreOptions } from "./types";

export class MarbleStore {
  readonly cells: CellCollection;
  readonly columns: ColumnCollection;
  readonly pipes: PipeCollection;
  readonly projects: ProjectCollection;
  readonly rows: RowCollection;
  readonly sourceEvents: SourceEventCollection;
  readonly sources: SourceCollection;
  readonly tables: TableCollection;

  constructor(options: MarbleStoreOptions) {
    const deps = createResourceDeps(options);

    this.cells = new CellCollection(deps);
    this.columns = new ColumnCollection(deps);
    this.pipes = new PipeCollection(deps);
    this.projects = new ProjectCollection(deps);
    this.rows = new RowCollection(deps);
    this.sourceEvents = new SourceEventCollection(deps);
    this.sources = new SourceCollection(deps);
    this.tables = new TableCollection(deps);
  }
}
