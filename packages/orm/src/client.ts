import {
  ProjectCollection,
  type ProjectCollectionApi,
} from "./resources/project";
import { TableCollection, type TableCollectionApi } from "./resources/table";
import type { ResourceOptions } from "./types";

export class MarbleClient {
  readonly projects: ProjectCollectionApi;
  readonly tables: TableCollectionApi;

  constructor(options: ResourceOptions) {
    this.projects = new ProjectCollection(options);
    this.tables = new TableCollection(options);
  }
}
