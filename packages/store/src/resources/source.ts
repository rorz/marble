import type { Json } from "@marble/supabase";
import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

type Source = Entity<"source">;

type CreateSourceInput = Pick<CreateParams<"source">, "projectId"> &
  Partial<Pick<CreateParams<"source">, "name" | "payloadSchema">>;

type IdObject = {
  id: string;
};

type ListSourcesInput = Pick<Source, "projectId">;

type UpdateSourceInput = IdObject & {
  values: Partial<Pick<UpdateParams<"source">, "name" | "payloadSchema">>;
};

const DEFAULT_SOURCE_PAYLOAD_SCHEMA = {
  type: "object",
} as const satisfies Json;

export class SourceCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = async (input: CreateSourceInput) => {
    return this.deps.db.insert("source", {
      name: input.name ?? "Untitled Source",
      payloadSchema: input.payloadSchema ?? DEFAULT_SOURCE_PAYLOAD_SCHEMA,
      projectId: input.projectId,
    });
  };

  public readonly delete = (input: IdObject) =>
    this.deps.db.delete("source", input.id);

  public readonly get = (input: IdObject) =>
    this.deps.db.get("source", input.id);

  public readonly list = (input: ListSourcesInput) =>
    this.deps.db.list("source", input);

  public readonly update = (input: UpdateSourceInput) =>
    this.deps.db.update("source", input.id, input.values);
}
