import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { consumeQueue } from "./consumer";
import { handleWebhook } from "./producer";

const WEBHOOK_BODY_LIMIT_BYTES = 1024 * 1024;

const httpApp = new Hono<{
  Bindings: Env;
}>();

httpApp.post(
  "/webhooks/:sourceId",
  bodyLimit({
    maxSize: WEBHOOK_BODY_LIMIT_BYTES,
    onError: (c) =>
      c.json(
        {
          error: "Webhook payload is too large. Maximum size is 1MB.",
        },
        {
          status: 413,
        },
      ),
  }),
  handleWebhook,
);

export default {
  fetch: (request: Request, env: Env, executionContext: ExecutionContext) => {
    return httpApp.fetch(request, env, executionContext);
  },
  queue: async (batch: MessageBatch<unknown>, env: Env) => {
    await consumeQueue(batch, env);
  },
};
