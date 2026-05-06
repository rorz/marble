import { createClient, type Json, type SupabaseClient } from "@marble/supabase";
import { Hono } from "hono";
import { JSONPath } from "jsonpath-plus";
import { z } from "zod";

const httpApp = new Hono<{
  Bindings: Env;
}>();

const WEBHOOK_USAGE = {
  message:
    "Send a POST request with a JSON body and either Authorization: Bearer <token> or X-Marble-Webhook-Token.",
  method: "POST",
};

const queueMessageSchema = z.object({
  payload: z.json(),
  sourceId: z.string().uuid(),
});
type QueueMessage = z.infer<typeof queueMessageSchema>;
type ExecutorPayload = Record<string, unknown>;
type MaterializedCell = {
  column_id: string;
  id: string;
};

const pipeMappingSchema = z.object({
  columnId: z.string().uuid(),
  jsonPath: z.string().trim().min(1),
});

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
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

function getWebhookToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();

  if (authorization) {
    const [scheme, token] = authorization.split(/\s+/, 2);

    if (scheme?.toLowerCase() === "bearer" && token) {
      return token;
    }
  }

  const headerToken = request.headers.get("x-marble-webhook-token")?.trim();
  return headerToken && headerToken.length > 0 ? headerToken : null;
}

async function materializeTableRow(supabase: SupabaseClient, tableId: string) {
  const { data: lastRow, error: lastRowError } = await supabase
    .from("row")
    .select("idx")
    .eq("table_id", tableId)
    .order("idx", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (lastRowError) {
    throw new Error(lastRowError.message);
  }

  const { data: row, error: rowError } = await supabase
    .from("row")
    .insert({
      idx: (lastRow?.idx ?? -1) + 1,
      table_id: tableId,
    })
    .select("id")
    .single();

  if (rowError || !row) {
    throw new Error(rowError?.message ?? "Could not create row.");
  }

  try {
    const { data: columns, error: columnError } = await supabase
      .from("column")
      .select("id")
      .eq("table_id", tableId);

    if (columnError) {
      throw new Error(columnError.message);
    }

    if (!columns || columns.length === 0) {
      return [] as MaterializedCell[];
    }

    const { data: cells, error: cellError } = await supabase
      .from("cell")
      .insert(
        columns.map((column) => ({
          column_id: column.id,
          row_id: row.id,
        })),
      )
      .select("id, column_id");

    if (cellError) {
      throw new Error(cellError.message);
    }

    return (cells ?? []) as MaterializedCell[];
  } catch (error) {
    await supabase.from("cell").delete().eq("row_id", row.id);
    await supabase.from("row").delete().eq("id", row.id);
    throw error;
  }
}

async function createPendingRunsForCellIds(
  supabase: SupabaseClient,
  cellIds: string[],
) {
  const uniqueCellIds = Array.from(new Set(cellIds));

  if (uniqueCellIds.length === 0) {
    return [] as string[];
  }

  const { data: cells, error: cellError } = await supabase
    .from("cell")
    .select("id, column_id")
    .in("id", uniqueCellIds);

  if (cellError) {
    throw new Error(cellError.message);
  }

  for (const cellId of uniqueCellIds) {
    if (!(cells ?? []).some((cell) => cell.id === cellId)) {
      throw new Error(`Cell '${cellId}' was not found.`);
    }
  }

  const cellById = new Map(
    (cells ?? []).map((cell) => [
      cell.id,
      cell,
    ]),
  );
  const columnIds = Array.from(
    new Set((cells ?? []).map((cell) => cell.column_id)),
  );
  const { data: columns, error: columnError } = await supabase
    .from("column")
    .select("id, program_version_id")
    .in("id", columnIds);

  if (columnError) {
    throw new Error(columnError.message);
  }

  const programVersionIdByColumnId = new Map(
    (columns ?? []).map((column) => [
      column.id,
      column.program_version_id,
    ]),
  );
  const { error: pendingStateError } = await supabase
    .from("cell")
    .update({
      state: {
        ok: null,
      } as Json,
    })
    .in("id", uniqueCellIds);

  if (pendingStateError) {
    throw new Error(pendingStateError.message);
  }

  const { data: runs, error: runError } = await supabase
    .from("program_run")
    .insert(
      uniqueCellIds.map((cellId) => {
        const cell = cellById.get(cellId);

        if (!cell) {
          throw new Error(`Cell '${cellId}' was not found.`);
        }

        const programVersionId = programVersionIdByColumnId.get(cell.column_id);

        if (!programVersionId) {
          throw new Error(
            `Program version for column '${cell.column_id}' was not found.`,
          );
        }

        return {
          program_version_id: programVersionId,
          target_cell_id: cellId,
        };
      }),
    )
    .select("id, target_cell_id");

  if (runError) {
    throw new Error(runError.message);
  }

  const runIdByCellId = new Map(
    (runs ?? []).map((run) => [
      run.target_cell_id,
      run.id,
    ]),
  );

  return uniqueCellIds.map((cellId) => {
    const runId = runIdByCellId.get(cellId);

    if (!runId) {
      throw new Error(`Run for cell '${cellId}' was not created.`);
    }

    return runId;
  });
}

async function readExecutorResponse(response: Response) {
  const text = await response.text();

  try {
    return (text.length === 0 ? {} : JSON.parse(text)) as ExecutorPayload;
  } catch {
    return {
      message: text || "Executor returned a non-JSON response.",
      success: false,
    };
  }
}

function executorPayloadMessage(payload: ExecutorPayload) {
  return typeof payload.message === "string" ? payload.message : undefined;
}

async function executeRuns(env: Env, runIds: string[]) {
  if (runIds.length === 0) {
    return;
  }

  const response = await env.MARBLE_EXECUTOR.fetch(
    new Request("https://executor.marble.internal/runs", {
      body: JSON.stringify({
        runIds,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
  const payload = await readExecutorResponse(response);

  if (!response.ok && !(response.status === 500 && payload.success === false)) {
    throw new Error(
      `Executor batch run failed (${response.status}): ${
        executorPayloadMessage(payload) ?? JSON.stringify(payload)
      }`,
    );
  }
}

async function materializePipe(
  env: Env,
  pipe: {
    id: string;
    mappings: unknown;
    table_id: string;
  },
  parsedPayload: QueueMessage["payload"],
) {
  const mappings = pipeMappingSchema.array().parse(pipe.mappings);

  if (mappings.length === 0) {
    return;
  }

  const supabase = db(env);
  const cells = await materializeTableRow(supabase, pipe.table_id);

  const cellIdByColumnId = new Map(
    (cells ?? []).map((cell) => [
      cell.column_id,
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
        json: parsedPayload,
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

    const { error: updateError } = await supabase
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

  if (writtenCellIds.length === 0) {
    return;
  }

  const runIds = await createPendingRunsForCellIds(supabase, writtenCellIds);
  await executeRuns(env, runIds);
}

async function processQueuedSourceEvent(env: Env, input: QueueMessage) {
  const supabase = db(env);
  const { data: source, error: sourceError } = await supabase
    .from("source")
    .select("*")
    .eq("id", input.sourceId)
    .maybeSingle();

  if (sourceError) {
    throw new Error(sourceError.message);
  }

  if (!source) {
    return;
  }

  let parsedPayload: QueueMessage["payload"] | null = null;
  let parseError: string | null = null;

  try {
    const validation = z
      .fromJSONSchema(source.payload_schema as z.core.JSONSchema.Schema)
      .safeParse(input.payload);

    if (validation.success) {
      parsedPayload = validation.data as QueueMessage["payload"];
    } else {
      parseError = validation.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; ");
    }
  } catch (error) {
    parseError =
      error instanceof Error
        ? error.message
        : "Payload schema could not be applied";
  }

  const { error: sourceEventError } = await supabase
    .from("source_event")
    .insert({
      parse_error: parseError,
      parsed_payload: parsedPayload as Json | null,
      project_id: source.project_id,
      raw_payload: input.payload as Json,
      source_id: source.id,
    });

  if (sourceEventError) {
    throw new Error(sourceEventError.message);
  }

  const { data: pipes, error: pipeError } = await supabase
    .from("pipe")
    .select("id, mappings, table_id")
    .eq("source_id", source.id)
    .order("created_at", {
      ascending: true,
    });

  if (pipeError) {
    throw new Error(pipeError.message);
  }

  if (parsedPayload === null) {
    return;
  }

  for (const pipe of pipes ?? []) {
    try {
      await materializePipe(env, pipe, parsedPayload);
    } catch (error) {
      console.error(`Pipe ${pipe.id} failed`, error);
    }
  }
}

httpApp.get("/webhooks/:sourceId", (c) => {
  return new Response(
    JSON.stringify({
      ...WEBHOOK_USAGE,
      sourceId: c.req.param("sourceId"),
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      status: 200,
    },
  );
});

httpApp.post("/webhooks/:sourceId", async (c) => {
  const supabase = db(c.env);
  const sourceId = c.req.param("sourceId");
  const token = getWebhookToken(c.req.raw);
  let payload: unknown;

  if (!token) {
    return c.json(
      {
        error:
          "Provide a webhook token with Authorization: Bearer <token> or X-Marble-Webhook-Token",
      },
      {
        status: 401,
      },
    );
  }

  try {
    payload = await c.req.json();
  } catch {
    return c.json(
      {
        error: "Webhook payload must be valid JSON",
      },
      {
        status: 400,
      },
    );
  }

  const { data: source, error } = await supabase
    .from("source")
    .select("id")
    .eq("id", sourceId)
    .eq("webhook_token", token)
    .maybeSingle();

  if (error) {
    return c.json(
      {
        error: error.message,
      },
      {
        status: 500,
      },
    );
  }

  if (!source) {
    return c.json(
      {
        error: "Source not found",
      },
      {
        status: 404,
      },
    );
  }

  await c.env.SOURCE_INGEST_QUEUE.send({
    payload: payload as never,
    sourceId,
  });

  return c.json({
    queued: true,
    sourceId,
  });
});

export default {
  fetch(request: Request, env: Env, executionContext: ExecutionContext) {
    return httpApp.fetch(request, env, executionContext);
  },
  async queue(batch: MessageBatch<unknown>, env: Env) {
    for (const message of batch.messages) {
      try {
        const input = queueMessageSchema.parse(message.body);
        await processQueuedSourceEvent(env, input);
        message.ack();
      } catch (error) {
        console.error("Failed to process source ingest message", error);
        message.ack();
      }
    }
  },
};
