import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import {
  createApiContext,
  createMarbleApiRuntime,
  createOpenApiDocsContext,
  type MarbleApiConfig,
} from "./context";
import { marbleRouter } from "./router";

export type { ApiAuth, ApiContext, MarbleApiConfig } from "./context";
export { createApiContext, createMarbleApiRuntime } from "./context";

const errorResponse = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return Response.json(
      {
        error:
          "message" in error && typeof error.message === "string"
            ? error.message
            : "Request failed.",
      },
      {
        status: error.status,
      },
    );
  }

  return Response.json(
    {
      error: error instanceof Error ? error.message : String(error),
    },
    {
      status: 500,
    },
  );
};

const shouldLogOrpcError = (error: unknown) =>
  !(error instanceof ORPCError) ||
  error.code === "INTERNAL_SERVER_ERROR" ||
  error.cause !== undefined;

const logOrpcError = (error: unknown) => {
  if (!shouldLogOrpcError(error)) return;

  console.error("[marble-api] oRPC request failed", error);

  if (error instanceof Error && error.cause !== undefined) {
    console.error("[marble-api] oRPC error cause", error.cause);
  }
};

function isOpenApiDocsPath(request: Request) {
  const pathname = new URL(request.url).pathname;
  return pathname === "/openapi" || pathname === "/openapi/spec.json";
}

export function createMarbleApi(config: MarbleApiConfig) {
  const runtime = createMarbleApiRuntime(config);
  const app = new Hono();
  const openApiHandler = new OpenAPIHandler(marbleRouter, {
    interceptors: [
      onError(logOrpcError),
    ],
    plugins: [
      new OpenAPIReferencePlugin({
        docsPath: "/openapi",
        schemaConverters: [
          new ZodToJsonSchemaConverter(),
        ],
        specGenerateOptions: {
          info: {
            title: "Marble Data API",
            version: "0.1.0",
          },
        },
        specPath: "/openapi/spec.json",
      }),
    ],
  });
  const rpcHandler = new RPCHandler(marbleRouter, {
    interceptors: [
      onError(logOrpcError),
    ],
  });

  app.get("/", (c) =>
    c.json({
      docs: "/openapi",
      ok: true,
      openapi: "/openapi/spec.json",
      rpc: "/rpc",
    }),
  );

  app.use("/rpc/*", async (c, next) => {
    let result: Awaited<ReturnType<typeof rpcHandler.handle>>;

    try {
      result = await rpcHandler.handle(c.req.raw, {
        context: await createApiContext(c.req.raw, runtime),
        prefix: "/rpc",
      });
    } catch (error) {
      return errorResponse(error);
    }

    if (result.matched) {
      return c.newResponse(result.response.body, result.response);
    }

    return next();
  });

  app.use("*", async (c, next) => {
    let result: Awaited<ReturnType<typeof openApiHandler.handle>>;

    try {
      result = await openApiHandler.handle(c.req.raw, {
        context: isOpenApiDocsPath(c.req.raw)
          ? createOpenApiDocsContext(c.req.raw, runtime)
          : await createApiContext(c.req.raw, runtime),
      });
    } catch (error) {
      return errorResponse(error);
    }

    if (result.matched) {
      return c.newResponse(result.response.body, result.response);
    }

    return next();
  });

  return app;
}
