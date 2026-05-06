import { createResourceDeps } from "./db";
import { CellCollection } from "./resources/cell";
import { ColumnCollection } from "./resources/column";
import { EventCollection } from "./resources/event";
import { KeyCollection } from "./resources/key";
import { PipeCollection } from "./resources/pipe";
import { ProfileCollection } from "./resources/profile";
import { ProgramCollection } from "./resources/program";
import { ProgramFileCollection } from "./resources/program-file";
import { ProgramVersionCollection } from "./resources/program-version";
import { ProjectCollection } from "./resources/project";
import { RowCollection } from "./resources/row";
import { SecretCollection } from "./resources/secret";
import { SecretBindingCollection } from "./resources/secret-binding";
import { SidebarCollection } from "./resources/sidebar";
import { SourceCollection } from "./resources/source";
import { SourceEventCollection } from "./resources/source-event";
import { TableCollection } from "./resources/table";
import type { MarbleStoreOptions } from "./types";

export class MarbleStore {
  readonly cells: CellCollection;
  readonly columns: ColumnCollection;
  readonly events: EventCollection;
  readonly keys: KeyCollection;
  readonly pipes: PipeCollection;
  readonly programs: ProgramCollection;
  readonly programFiles: ProgramFileCollection;
  readonly programVersions: ProgramVersionCollection;
  readonly profiles: ProfileCollection;
  readonly projects: ProjectCollection;
  readonly rows: RowCollection;
  readonly secrets: SecretCollection;
  readonly secretBindings: SecretBindingCollection;
  readonly sidebar: SidebarCollection;
  readonly sourceEvents: SourceEventCollection;
  readonly sources: SourceCollection;
  readonly tables: TableCollection;

  constructor(options: MarbleStoreOptions) {
    const deps = createResourceDeps(options);

    this.cells = new CellCollection(deps);
    this.columns = new ColumnCollection(deps);
    this.events = new EventCollection(deps);
    this.keys = new KeyCollection(deps);
    this.pipes = new PipeCollection(deps);
    this.programs = new ProgramCollection(deps);
    this.programFiles = new ProgramFileCollection(deps);
    this.programVersions = new ProgramVersionCollection(deps);
    this.profiles = new ProfileCollection(deps);
    this.projects = new ProjectCollection(deps);
    this.rows = new RowCollection(deps);
    this.secrets = new SecretCollection(deps);
    this.secretBindings = new SecretBindingCollection(deps);
    this.sidebar = new SidebarCollection(deps);
    this.sourceEvents = new SourceEventCollection(deps);
    this.sources = new SourceCollection(deps);
    this.tables = new TableCollection(deps);
  }
}
