import { SupabaseDriver } from "./drivers/supabase";
import { ProjectCollection, type ProjectRecord } from "./resources/project";
import { TableCollection, type TableRecord } from "./resources/table";
import {
  type CallableCollection,
  callableCollection,
  type ResourceOptions,
} from "./types";

export class MarbleClient {
  readonly projects: CallableCollection<ProjectRecord, ProjectCollection>;

  readonly tables: CallableCollection<TableRecord, TableCollection>;

  constructor(options: ResourceOptions) {
    this.projects = callableCollection(new ProjectCollection(options));
    this.tables = callableCollection(new TableCollection(options));
  }
}

const marbleClient = new MarbleClient({
  context: {
    profileId: "sldkfj",
  },
  driver: new SupabaseDriver(null),
});
