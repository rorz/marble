import type { Json } from "@marble/supabase";
import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, ListParams, UpdateParams } from "../types";
import { ResourceAccess } from "./access";

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
  private readonly access: ResourceAccess;

  public constructor(private readonly deps: ResourceDeps) {
    this.access = new ResourceAccess(deps);
  }

  public readonly create = async (input: CreatePipeInput) => {
    const { source, table } = await this.access.requirePipeScope(input);

    return toPipe(
      await this.deps.db.insert("pipe", {
        mappings: (input.mappings ?? []) as Json,
        sourceId: source.id,
        tableId: table.id,
      }),
    );
  };

  public readonly delete = async (input: IdObject) => {
    const pipe = await this.access.requirePipe(input.id);
    return toPipe(await this.deps.db.delete("pipe", pipe.id));
  };

  public readonly get = async (input: IdObject) =>
    toPipe(await this.access.requirePipe(input.id));

  public readonly list = async (input: ListPipesInput) => {
    if (input.sourceId === undefined && input.tableId === undefined) {
      throw new Error("Either sourceId or tableId is required.");
    }

    if (input.sourceId !== undefined) {
      await this.access.requireSource(input.sourceId);
    }

    if (input.tableId !== undefined) {
      await this.access.requireTable(input.tableId);
    }

    const where = {
      sourceId: input.sourceId,
      tableId: input.tableId,
    } satisfies ListParams<"pipe">;

    return (await this.deps.db.list("pipe", where)).map(toPipe);
  };

  public readonly update = async (input: UpdatePipeInput) => {
    const existing = await this.access.requirePipe(input.id);
    await this.access.requirePipeScope({
      sourceId: input.values.sourceId ?? existing.sourceId,
      tableId: input.values.tableId ?? existing.tableId,
    });

    return toPipe(
      await this.deps.db.update(
        "pipe",
        existing.id,
        toPipeValues(input.values),
      ),
    );
  };
}
