import type { Json } from "@marble/supabase";
import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";
import { ResourceAccess } from "./access";

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
  private readonly access: ResourceAccess;

  public constructor(private readonly deps: ResourceDeps) {
    this.access = new ResourceAccess(deps);
  }

  public readonly create = async (input: CreateSourceInput) => {
    await this.access.requireProject(input.projectId);

    return this.deps.db.insert("source", {
      name: input.name ?? "Untitled Source",
      payloadSchema: input.payloadSchema ?? DEFAULT_SOURCE_PAYLOAD_SCHEMA,
      projectId: input.projectId,
    });
  };

  public readonly delete = async (input: IdObject) => {
    const source = await this.access.requireSource(input.id);
    return this.deps.db.delete("source", source.id);
  };

  public readonly get = (input: IdObject) =>
    this.access.requireSource(input.id);

  public readonly list = async (input: ListSourcesInput) => {
    await this.access.requireProject(input.projectId);
    return this.deps.db.list("source", input);
  };

  public readonly update = async (input: UpdateSourceInput) => {
    const source = await this.access.requireSource(input.id);
    return this.deps.db.update("source", source.id, input.values);
  };
}
