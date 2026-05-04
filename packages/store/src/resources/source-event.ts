import type { ListOptions, ResourceDeps } from "../db";
import type { CreateParams, ListParams } from "../types";
import { ResourceAccess } from "./access";

type IdObject = {
  id: string;
};

type CreateSourceEventInput = Pick<
  CreateParams<"source_event">,
  "rawPayload" | "sourceId"
>;

type ListSourceEventsInput = {
  limit?: number;
  projectId?: string;
  sourceId?: string;
};

const DEFAULT_SOURCE_EVENT_LIMIT = 50;

export class SourceEventCollection {
  private readonly access: ResourceAccess;

  public constructor(private readonly deps: ResourceDeps) {
    this.access = new ResourceAccess(deps);
  }

  public readonly create = async (input: CreateSourceEventInput) => {
    const source = await this.access.requireSource(input.sourceId);

    return this.deps.db.insert("source_event", {
      projectId: source.projectId,
      rawPayload: input.rawPayload,
      sourceId: source.id,
    });
  };

  public readonly get = (input: IdObject) =>
    this.access.requireSourceEvent(input.id);

  public readonly list = async (input: ListSourceEventsInput) => {
    if (input.projectId === undefined && input.sourceId === undefined) {
      throw new Error("Either projectId or sourceId is required.");
    }

    if (input.projectId !== undefined) {
      await this.access.requireProject(input.projectId);
    }

    if (input.sourceId !== undefined) {
      const source = await this.access.requireSource(input.sourceId);

      if (
        input.projectId !== undefined &&
        source.projectId !== input.projectId
      ) {
        return [];
      }
    }

    const where = {
      projectId: input.projectId,
      sourceId: input.sourceId,
    } satisfies ListParams<"source_event">;
    const options = {
      limit: input.limit ?? DEFAULT_SOURCE_EVENT_LIMIT,
      orderBy: [
        {
          ascending: false,
          column: "createdAt",
        },
      ],
    } satisfies ListOptions<"source_event">;

    return this.deps.db.list("source_event", where, options);
  };
}
