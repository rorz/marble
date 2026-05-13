import type { Context } from "hono";
import { workerStore } from "./store";

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

export async function handleWebhook(
  c: Context<
    {
      Bindings: Env;
    },
    "/webhooks/:sourceId"
  >,
) {
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
}
