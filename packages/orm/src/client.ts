import { ProjectResource } from "./resources/project";
import type { ResourceContext, ResourceDriver } from "./types";

export class MarbleClient {
  readonly projects: ProjectResource;

  constructor(options: {
    driver: ResourceDriver;
    context: ResourceContext;
  }) {
    this.projects = new ProjectResource(options.driver, options.context);
  }
}
