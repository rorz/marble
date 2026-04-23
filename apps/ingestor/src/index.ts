import marbleApi from "@marble/api";
import { createClient, type Json } from "@marble/supabase";
import { Hono } from "hono";
import { JSONPath } from "jsonpath-plus";
import { z } from "zod";
import { getEnv } from "./env";

const httpApp = new Hono<{
  Bindings: Env;
}>();

const queueMessageSchema = z.object({
  payload: z.json(),
  sourceId: z.string().uuid(),
});
type QueueMessage = z.infer<typeof queueMessageSchema>;

const drainMappingSchema = z.object({
  columnId: z.string().uuid(),
  jsonPath: z.string().trim().min(1),
});

function db(env: Env) {
  const parsedEnv = getEnv(env as unknown as Record<string, unknown>);
  return createClient(
    parsedEnv.SUPABASE_URL,
    parsedEnv.SUPABASE_SERVICE_ROLE_KEY,
  );
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

async function callMarbleApi<T>(
  env: Env,
  path: string,
  options: {
    body?: unknown;
    method?: string;
  } = {},
) {
  const parsedEnv = getEnv(env as unknown as Record<string, unknown>);
  const response = await marbleApi.fetch(
    new Request(new URL(path, "https://marble.internal"), {
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        "Content-Type": "application/json",
      },
      method: options.method ?? "GET",
    }),
    {
      MARBLE_EXECUTOR_URL: parsedEnv.MARBLE_EXECUTOR_URL,
      SUPABASE_SERVICE_ROLE_KEY: parsedEnv.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_URL: parsedEnv.SUPABASE_URL,
    },
  );
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Marble API ${options.method ?? "GET"} ${path} failed (${response.status}): ${text}`,
    );
  }

  return (text.length === 0 ? null : JSON.parse(text)) as T;
}

async function materializeDrain(
  env: Env,
  drain: {
    id: string;
    mappings: unknown;
    table_id: string;
  },
  parsedPayload: QueueMessage["payload"],
) {
  const supabase = db(env);
  const row = await callMarbleApi<{
    id: string;
  }>(env, "/rows", {
    body: {
      tableId: drain.table_id,
    },
    method: "POST",
  });
  const mappings = drainMappingSchema.array().parse(drain.mappings);
  const { data: cells, error: cellError } = await supabase
    .from("cell")
    .select("id, column_id")
    .eq("row_id", row.id);

  if (cellError) {
    throw new Error(cellError.message);
  }

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
        `Drain ${drain.id} mapping ${mapping.columnId} failed for path ${mapping.jsonPath}`,
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

  await callMarbleApi(env, "/cells/run", {
    body: {
      cellIds: writtenCellIds,
    },
    method: "POST",
  });
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

  let parsedPayload: QueueMessage["payload"] = input.payload;
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
      parsed_payload: parsedPayload as Json,
      project_id: source.project_id,
      raw_payload: input.payload as Json,
      source_id: source.id,
    });

  if (sourceEventError) {
    throw new Error(sourceEventError.message);
  }

  const { data: drains, error: drainError } = await supabase
    .from("drain")
    .select("id, mappings, table_id")
    .eq("source_id", source.id)
    .order("created_at", {
      ascending: true,
    });

  if (drainError) {
    throw new Error(drainError.message);
  }

  for (const drain of drains ?? []) {
    try {
      await materializeDrain(env, drain, parsedPayload);
    } catch (error) {
      console.error(`Drain ${drain.id} failed`, error);
    }
  }
}

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
