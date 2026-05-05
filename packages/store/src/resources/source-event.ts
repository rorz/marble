import type { ListOptions, ResourceDeps } from "../db";
import type { CreateParams, ListParams } from "../types";

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
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = (input: CreateSourceEventInput) =>
    this.deps.db.createSourceEvent(input);

  public readonly get = (input: IdObject) =>
    this.deps.db.get("source_event", input.id);

  public readonly list = async (input: ListSourceEventsInput) => {
    if (input.projectId === undefined && input.sourceId === undefined) {
      throw new Error("Either projectId or sourceId is required.");
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
