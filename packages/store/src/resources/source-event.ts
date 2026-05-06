import type { Json } from "@marble/supabase";
import { JSONPath } from "jsonpath-plus";
import { z } from "zod";
import type { ListOptions, ResourceDeps } from "../db";
import type { CreateParams, ListParams } from "../types";
import { ProgramRunCollection } from "./program-run";

type JsonValue = Json;

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
const pipeMappingSchema = z.object({
  columnId: z.string().uuid(),
  jsonPath: z.string().trim().min(1),
});

type SourceWebhookIngestResult = {
  parseError: string | null;
  runIds: string[];
  sourceEventId: string;
};

function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error(
      "Source event ingestion requires a service Supabase client.",
    );
  }

  return deps.serviceSupabase;
}

function valueToManualInput(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export class SourceEventCollection {
  private readonly deps: ResourceDeps;
  private readonly programRuns: ProgramRunCollection;

  public constructor(deps: ResourceDeps) {
    this.deps = deps;
    this.programRuns = new ProgramRunCollection(deps);
  }

  private readonly loadSource = async (sourceId: string) => {
    const { data, error } = await requireServiceSupabase(this.deps)
      .from("source")
      .select("*, project!source_project_id_fkey(owner_profile_id)")
      .eq("id", sourceId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Source not found.");
    }

    const project = Array.isArray(data.project)
      ? data.project[0]
      : data.project;

    if (!project?.owner_profile_id) {
      throw new Error("Source project owner could not be resolved.");
    }

    return {
      id: data.id,
      ownerProfileId: project.owner_profile_id,
      payloadSchema: data.payload_schema,
      projectId: data.project_id,
    };
  };

  private readonly materializeTableRow = async (input: {
    ownerProfileId: string;
    tableId: string;
  }) => {
    const supabase = requireServiceSupabase(this.deps);
    const { data: lastRow, error: lastRowError } = await supabase
      .from("row")
      .select("idx")
      .eq("table_id", input.tableId)
      .order("idx", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (lastRowError) {
      throw new Error(lastRowError.message);
    }

    const inserted = await this.deps.db.insertTableRows({
      idx: (lastRow?.idx ?? -1) + 1,
      ownerProfileId: input.ownerProfileId,
      quantity: 1,
      tableId: input.tableId,
    });

    return inserted.cells;
  };

  private readonly materializePipe = async (
    pipe: {
      id: string;
      mappings: unknown;
      table_id: string;
    },
    input: {
      ownerProfileId: string;
      parsedPayload: JsonValue;
    },
  ) => {
    const mappings = pipeMappingSchema.array().parse(pipe.mappings);

    if (mappings.length === 0) {
      return [] as string[];
    }

    const cells = await this.materializeTableRow({
      ownerProfileId: input.ownerProfileId,
      tableId: pipe.table_id,
    });
    const cellIdByColumnId = new Map(
      cells.map((cell) => [
        cell.columnId,
        cell.id,
      ]),
    );
    const writtenCellIds: string[] = [];

    for (const mapping of mappings) {
      const cellId = cellIdByColumnId.get(mapping.columnId);

      if (!cellId) {
        continue;
      }

      let value: unknown;

      try {
        value = JSONPath({
          json: input.parsedPayload,
          path: mapping.jsonPath,
          wrap: false,
        });
      } catch (error) {
        console.error(
          `Pipe ${pipe.id} mapping ${mapping.columnId} failed for path ${mapping.jsonPath}`,
          error,
        );
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      const { error: updateError } = await requireServiceSupabase(this.deps)
        .from("cell")
        .update({
          manual_input: valueToManualInput(value),
        })
        .eq("id", cellId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      writtenCellIds.push(cellId);
    }

    return this.programRuns.createPendingForCellIds(writtenCellIds);
  };

  public readonly create = (input: CreateSourceEventInput) =>
    this.deps.db.createSourceEvent(input);

  public readonly get = (input: IdObject) =>
    this.deps.db.get("source_event", input.id);

  public readonly ingestWebhook = async (input: {
    payload: JsonValue;
    sourceId: string;
  }): Promise<SourceWebhookIngestResult> => {
    const source = await this.loadSource(input.sourceId);
    let parsedPayload: JsonValue | null = null;
    let parseError: string | null = null;

    try {
      const validation = z
        .fromJSONSchema(source.payloadSchema as z.core.JSONSchema.Schema)
        .safeParse(input.payload);

      if (validation.success) {
        parsedPayload = validation.data as JsonValue;
      } else {
        parseError = validation.error.issues
          .map(
            (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
          )
          .join("; ");
      }
    } catch (error) {
      parseError =
        error instanceof Error
          ? error.message
          : "Payload schema could not be applied";
    }

    const { data: sourceEvent, error: sourceEventError } =
      await requireServiceSupabase(this.deps)
        .from("source_event")
        .insert({
          parse_error: parseError,
          parsed_payload: parsedPayload as Json | null,
          project_id: source.projectId,
          raw_payload: input.payload as Json,
          source_id: source.id,
        })
        .select("id")
        .single();

    if (sourceEventError || !sourceEvent) {
      throw new Error(
        sourceEventError?.message ?? "Could not create source event.",
      );
    }

    if (parsedPayload === null) {
      return {
        parseError,
        runIds: [],
        sourceEventId: sourceEvent.id,
      };
    }

    const { data: pipes, error: pipeError } = await requireServiceSupabase(
      this.deps,
    )
      .from("pipe")
      .select("id, mappings, table_id")
      .eq("source_id", source.id)
      .order("created_at", {
        ascending: true,
      });

    if (pipeError) {
      throw new Error(pipeError.message);
    }

    const runIds: string[] = [];

    for (const pipe of pipes ?? []) {
      try {
        runIds.push(
          ...(await this.materializePipe(pipe, {
            ownerProfileId: source.ownerProfileId,
            parsedPayload,
          })),
        );
      } catch (error) {
        console.error(`Pipe ${pipe.id} failed`, error);
      }
    }

    return {
      parseError,
      runIds,
      sourceEventId: sourceEvent.id,
    };
  };

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
