import type { Json } from "@marble/supabase";
import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, ListParams, UpdateParams } from "../types";

type PipeMapping = {
  columnId: string;
  jsonPath: string;
};

type Pipe = Omit<Entity<"pipe">, "mappings"> & {
  mappings: PipeMapping[];
};

type CreatePipeInput = Pick<CreateParams<"pipe">, "sourceId" | "tableId"> & {
  mappings?: PipeMapping[];
};

type IdObject = {
  id: string;
};

type ListPipesInput = {
  sourceId?: string;
  tableId?: string;
};

type UpdatePipeInput = IdObject & {
  values: Partial<
    Pick<UpdateParams<"pipe">, "sourceId" | "tableId"> & {
      mappings: PipeMapping[];
    }
  >;
};

function parsePipeMappings(value: Json): PipeMapping[] {
  if (!Array.isArray(value)) {
    throw new Error("Pipe mappings must be an array.");
  }

  return value.map((entry) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      typeof entry.columnId !== "string" ||
      typeof entry.jsonPath !== "string"
    ) {
      throw new Error("Pipe mapping rows must include columnId and jsonPath.");
    }

    return {
      columnId: entry.columnId,
      jsonPath: entry.jsonPath,
    };
  });
}

const toPipe = (pipe: Entity<"pipe">): Pipe => ({
  ...pipe,
  mappings: parsePipeMappings(pipe.mappings),
});

const toPipeValues = (input: UpdatePipeInput["values"]) => ({
  mappings: input.mappings as Json | undefined,
  sourceId: input.sourceId,
  tableId: input.tableId,
});

export class PipeCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly create = async (input: CreatePipeInput) =>
    toPipe(
      await this.deps.db.insert("pipe", {
        mappings: (input.mappings ?? []) as Json,
        sourceId: input.sourceId,
        tableId: input.tableId,
      }),
    );

  public readonly delete = async (input: IdObject) =>
    toPipe(await this.deps.db.delete("pipe", input.id));

  public readonly get = async (input: IdObject) =>
    toPipe(await this.deps.db.get("pipe", input.id));

  public readonly list = async (input: ListPipesInput) => {
    if (input.sourceId === undefined && input.tableId === undefined) {
      throw new Error("Either sourceId or tableId is required.");
    }

    const where = {
      sourceId: input.sourceId,
      tableId: input.tableId,
    } satisfies ListParams<"pipe">;

    return (await this.deps.db.list("pipe", where)).map(toPipe);
  };

  public readonly update = async (input: UpdatePipeInput) => {
    return toPipe(
      await this.deps.db.update("pipe", input.id, toPipeValues(input.values)),
    );
  };
}
