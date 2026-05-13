import { Hono } from "hono";
import { consumeQueue } from "./consumer";
import { handleWebhook } from "./producer";

const httpApp = new Hono<{
  Bindings: Env;
}>();

httpApp.post("/webhooks/:sourceId", handleWebhook);

export default {
  fetch: (request: Request, env: Env, executionContext: ExecutionContext) => {
    return httpApp.fetch(request, env, executionContext);
  },
  queue: async (batch: MessageBatch<unknown>, env: Env) => {
    await consumeQueue(batch, env);
  },
};
