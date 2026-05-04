import type { ResourceDeps } from "../db";
import type { Entity } from "../types";

export class ResourceAccess {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly requireProject = (projectId: string) =>
    this.deps.db.get("project", projectId, {
      ownerProfileId: this.deps.context.profileId,
    });

  public readonly requireSource = async (sourceId: string) => {
    const source = await this.deps.db.get("source", sourceId);
    await this.requireProject(source.projectId);
    return source;
  };

  public readonly requireSourceEvent = async (sourceEventId: string) => {
    const sourceEvent = await this.deps.db.get("source_event", sourceEventId);
    await this.requireProject(sourceEvent.projectId);
    return sourceEvent;
  };

  public readonly requireTable = async (tableId: string) => {
    const table = await this.deps.db.get("table", tableId);
    await this.requireProject(table.projectId);
    return table;
  };

  public readonly requirePipe = async (pipeId: string) => {
    const pipe = await this.deps.db.get("pipe", pipeId);
    await this.requireSource(pipe.sourceId);
    return pipe;
  };

  public readonly requirePipeScope = async (input: {
    sourceId: string;
    tableId: string;
  }): Promise<{
    source: Entity<"source">;
    table: Entity<"table">;
  }> => {
    const [source, table] = await Promise.all([
      this.requireSource(input.sourceId),
      this.requireTable(input.tableId),
    ]);

    if (source.projectId !== table.projectId) {
      throw new Error("Pipe source and table must belong to the same project.");
    }

    return {
      source,
      table,
    };
  };
}
