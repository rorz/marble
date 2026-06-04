import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { cors } from "hono/cors";
import { createExploreRoute } from "./explore";
import { harpRouter } from "./router";
import type { HarpContext } from "./server";
import type { FileStore } from "./store";

export type { FileStore } from "./store";
export { createFileStore } from "./store";

const shouldLog = (error: unknown) =>
  !(error instanceof ORPCError) ||
  error.code === "INTERNAL_SERVER_ERROR" ||
  error.cause !== undefined;

const logError = (error: unknown) => {
  if (!shouldLog(error)) {
    return;
  }
  console.error("[harp] oRPC request failed", error);
};

/**
 * A Scalar API-reference page for a reverse-engineered target contract, pointed
 * at that project's generated `openapi.json`. This is the same reference UI oRPC
 * ships for its own specs — here it renders the contract HARP built for you.
 */
const targetDocsPage = (projectId: string): string =>
  [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>HARP \uD83E\uDE89 · API reference</title>",
    "</head>",
    "<body>",
    `<script id="api-reference" data-url="/projects/${projectId}/openapi.json"></script>`,
    '<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>',
    "</body>",
    "</html>",
  ].join("\n");

/**
 * Builds the HARP control-plane Hono app: an RPC handler at `/rpc` (for the SDK
 * and CLI) and an OpenAPI/REST handler everywhere else with Scalar docs at
 * `/openapi` (for the extension and any HTTP client). CORS is wide open so the
 * Chrome extension can POST captures cross-origin to localhost.
 */
export const createHarpServer = (options: { store: FileStore }) => {
  const context: HarpContext = {
    store: options.store,
  };
  const app = new Hono();
  const { upgradeWebSocket, websocket } = createBunWebSocket();

  const openApiHandler = new OpenAPIHandler(harpRouter, {
    interceptors: [
      onError(logError),
    ],
    plugins: [
      new OpenAPIReferencePlugin({
        docsPath: "/openapi",
        schemaConverters: [
          new ZodToJsonSchemaConverter(),
        ],
        specGenerateOptions: {
          info: {
            title: "HARP Control API",
            version: "0.1.0",
          },
        },
        specPath: "/openapi/spec.json",
      }),
    ],
  });
  const rpcHandler = new RPCHandler(harpRouter, {
    interceptors: [
      onError(logError),
    ],
  });

  app.use("*", cors());

  app.get("/", (c) =>
    c.json({
      docs: "/openapi",
      name: "HARP \uD83E\uDE89",
      openapi: "/openapi/spec.json",
      rpc: "/rpc",
    }),
  );

  app.get(
    "/projects/:id/explore",
    createExploreRoute(options.store, upgradeWebSocket),
  );

  // The reverse-engineered target contract's own OpenAPI spec + Scalar docs,
  // distinct from the control API's spec at /openapi.
  app.get("/projects/:id/openapi.json", async (c) => {
    const artifacts = await options.store.getArtifacts(c.req.param("id"));
    if (!artifacts) {
      return c.json(
        {
          error: "No contract yet — ingest a capture first.",
        },
        404,
      );
    }
    return c.body(artifacts.openapi, 200, {
      "content-type": "application/json; charset=utf-8",
    });
  });

  app.get("/projects/:id/docs", (c) =>
    c.html(targetDocsPage(c.req.param("id"))),
  );

  app.use("/rpc/*", async (c, next) => {
    const result = await rpcHandler.handle(c.req.raw, {
      context,
      prefix: "/rpc",
    });
    return result.matched
      ? c.newResponse(result.response.body, result.response)
      : next();
  });

  app.use("*", async (c, next) => {
    const result = await openApiHandler.handle(c.req.raw, {
      context,
    });
    return result.matched
      ? c.newResponse(result.response.body, result.response)
      : next();
  });

  return {
    app,
    websocket,
  };
};
