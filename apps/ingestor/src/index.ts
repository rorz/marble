import { MarbleStore } from "@marble/store";
import { createClient } from "@marble/supabase";
import { Hono } from "hono";
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

function workerStore(env: Env) {
  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return new MarbleStore({
    context: {
      eventSource: "RAW_API",
    },
    serviceSupabase: supabase,
    supabase,
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

async function processQueuedSourceEvent(env: Env, input: QueueMessage) {
  const { runIds } = await workerStore(env).sourceEvents.ingestWebhook(input);
  await executeRuns(env, runIds);
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

  let authorized: boolean;

  try {
    authorized = await workerStore(c.env).sources.authorizeWebhook({
      sourceId,
      token,
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Webhook auth failed",
      },
      {
        status: 500,
      },
    );
  }

  if (!authorized) {
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
