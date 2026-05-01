import { createRouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import {
  type ApiContext,
  createApiContext,
  createMarbleApiRuntime,
  type MarbleApiConfig,
} from "./context";
import { router } from "./projects";

export type { ApiAuth, ApiContext, MarbleApiConfig } from "./context";
export { createApiContext, createMarbleApiRuntime } from "./context";
export type { MarbleRouter } from "./projects";
export { router } from "./projects";

export function createMarbleRouterClient(context: ApiContext) {
  return createRouterClient(router, {
    context,
  });
}

export function createMarbleApi(config: MarbleApiConfig) {
  const runtime = createMarbleApiRuntime(config);
  const app = new Hono();
  const handler = new RPCHandler(router);

  app.use("/rpc/*", async (c, next) => {
    const { matched, response } = await handler.handle(c.req.raw, {
      context: await createApiContext(c.req.raw, runtime),
      prefix: "/rpc",
    });

    if (matched) {
      return c.newResponse(response.body, response);
    }

    return next();
  });

  app.get("/", (c) =>
    c.json({
      ok: true,
    }),
  );

  return app;
}
