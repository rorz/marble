import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import {
  type ApiContext,
  type ApiTimingEntry,
  createHostedApiContext,
  createMarbleApiRuntime,
  createOpenApiDocsContext,
  type MarbleApiConfig,
} from "./context";
import { marbleRouter } from "./router/entities";

export type {
  ApiContext,
  ApiTimingEntry,
  MarbleApiConfig,
  MarbleApiRuntime,
} from "./context";
export {
  createHostedApiContext,
  createMarbleApiRuntime,
} from "./context";

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

const MARBLE_SERVER_TIMING_HEADER = "x-marble-server-timing";
const SERVER_TIMING_HEADER = "Server-Timing";

const timingHeader = (timings: ApiTimingEntry[]) =>
  timings
    .map((timing) => `${timing.name};dur=${Math.round(timing.durationMs)}`)
    .join(", ");

const appendHeaderValue = (currentValue: string | null, nextValue: string) =>
  [
    currentValue,
    nextValue,
  ]
    .filter(Boolean)
    .join(", ");

const appendServerTiming = (
  response: Response,
  timings: ApiTimingEntry[],
  enabled: boolean,
) => {
  if (!enabled) {
    return;
  }

  const nextTiming = timingHeader(timings);

  if (!nextTiming) {
    return;
  }

  response.headers.set(
    SERVER_TIMING_HEADER,
    appendHeaderValue(response.headers.get(SERVER_TIMING_HEADER), nextTiming),
  );
  response.headers.set(
    MARBLE_SERVER_TIMING_HEADER,
    appendHeaderValue(
      response.headers.get(MARBLE_SERVER_TIMING_HEADER),
      nextTiming,
    ),
  );
};

const shouldDebugTiming = (request: Request) =>
  request.headers.get("x-marble-debug-timing") === "1";

const logDebugTiming = (
  request: Request,
  context: ApiContext | null,
  timings: ApiTimingEntry[],
) => {
  if (!shouldDebugTiming(request)) {
    return;
  }

  console.log("[marble-api] timing", {
    path: new URL(request.url).pathname,
    requestId:
      context?.requestId ?? request.headers.get("x-marble-request-id") ?? null,
    timings,
  });
};

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
    let context: ApiContext | null = null;
    const debugTiming = shouldDebugTiming(c.req.raw);
    const timings: ApiTimingEntry[] = [];

    try {
      const contextStartedAt = performance.now();
      context = await createHostedApiContext(c.req.raw, runtime);
      timings.push({
        durationMs: performance.now() - contextStartedAt,
        name: "api_context",
      });
      const handlerStartedAt = performance.now();
      result = await rpcHandler.handle(c.req.raw, {
        context,
        prefix: "/rpc",
      });
      timings.push({
        durationMs: performance.now() - handlerStartedAt,
        name: "orpc_handle",
      });
    } catch (error) {
      const response = errorResponse(error);
      appendServerTiming(response, timings, debugTiming);
      logDebugTiming(c.req.raw, context, timings);
      return response;
    }

    if (result.matched) {
      const response = c.newResponse(result.response.body, result.response);
      const allTimings = [
        ...timings,
        ...(context?.timings ?? []),
      ];
      appendServerTiming(response, allTimings, debugTiming);
      logDebugTiming(c.req.raw, context, allTimings);
      return response;
    }

    return next();
  });

  app.use("*", async (c, next) => {
    let result: Awaited<ReturnType<typeof openApiHandler.handle>>;
    let context: ApiContext | null = null;
    const debugTiming = shouldDebugTiming(c.req.raw);
    const timings: ApiTimingEntry[] = [];

    try {
      const contextStartedAt = performance.now();
      context = isOpenApiDocsPath(c.req.raw)
        ? createOpenApiDocsContext(c.req.raw, runtime)
        : await createHostedApiContext(c.req.raw, runtime);
      timings.push({
        durationMs: performance.now() - contextStartedAt,
        name: "api_context",
      });
      const handlerStartedAt = performance.now();
      result = await openApiHandler.handle(c.req.raw, {
        context,
      });
      timings.push({
        durationMs: performance.now() - handlerStartedAt,
        name: "openapi_handle",
      });
    } catch (error) {
      const response = errorResponse(error);
      appendServerTiming(response, timings, debugTiming);
      logDebugTiming(c.req.raw, context, timings);
      return response;
    }

    if (result.matched) {
      const response = c.newResponse(result.response.body, result.response);
      const allTimings = [
        ...timings,
        ...(context?.timings ?? []),
      ];
      appendServerTiming(response, allTimings, debugTiming);
      logDebugTiming(c.req.raw, context, allTimings);
      return response;
    }

    return next();
  });

  return app;
}
