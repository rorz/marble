import { createResourceDeps } from "./db";
import { CellCollection } from "./resources/entities/cell";
import { ColumnCollection } from "./resources/entities/column";
import { EventCollection } from "./resources/entities/event";
import { KeyCollection } from "./resources/entities/key";
import { PipeCollection } from "./resources/entities/pipe";
import { ProfileCollection } from "./resources/entities/profile";
import { ProgramCollection } from "./resources/entities/program";
import { ProgramFileCollection } from "./resources/entities/program-file";
import { ProgramRunCollection } from "./resources/entities/program-run";
import { ProgramVersionCollection } from "./resources/entities/program-version";
import { ProjectCollection } from "./resources/entities/project";
import { RowCollection } from "./resources/entities/row";
import { SecretCollection } from "./resources/entities/secret";
import { SecretBindingCollection } from "./resources/entities/secret-binding";
import { SidebarCollection } from "./resources/entities/sidebar";
import { SourceCollection } from "./resources/entities/source";
import { SourceEventCollection } from "./resources/entities/source-event";
import { TableCollection } from "./resources/entities/table";
import type { MarbleStoreOptions } from "./types";

export class MarbleStore {
  readonly cells: CellCollection;
  readonly columns: ColumnCollection;
  readonly events: EventCollection;
  readonly keys: KeyCollection;
  readonly pipes: PipeCollection;
  readonly programs: ProgramCollection;
  readonly programFiles: ProgramFileCollection;
  readonly programRuns: ProgramRunCollection;
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
    this.programRuns = new ProgramRunCollection(deps);
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
