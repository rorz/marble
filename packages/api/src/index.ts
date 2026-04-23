import {
  type ApiResourceName,
  ApiResourceNames,
  apiResourcePath,
} from "@marble/core";
import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { createClient, type Json } from "@marble/supabase";
import { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  parseJsonBody,
  readJsonBody,
  requiredParam,
  route,
} from "./core";
import { createRecord, getRecord, updateRecord } from "./data";
import { getEnv } from "./env";
import { attachEventContext, type EventSource } from "./event-driver";
import {
  requireAccessibleCell,
  requireAccessibleProgramRun,
} from "./resources/access";
import { mountCellResource } from "./resources/cell";
import { mountColumnResource } from "./resources/column";
import { mountColumnDependencyResource } from "./resources/column_dependency";
import { mountEventResource } from "./resources/event";
import { mountKeyResource } from "./resources/key";
import { mountPipeResource } from "./resources/pipe";
import { mountProfileResource } from "./resources/profile";
import { mountProgramResource } from "./resources/program";
import { mountProgramFileResource } from "./resources/program_file";
import { mountProgramRunResource } from "./resources/program_run";
import { mountProgramVersionResource } from "./resources/program_version";
import { mountProjectResource } from "./resources/project";
import { mountRowResource } from "./resources/row";
import { mountSecretResource } from "./resources/secret";
import { mountSecretBindingRoutes } from "./resources/secret_binding";
import { mountSourceResource } from "./resources/source";
import { mountSourceEventResource } from "./resources/source_event";
import { mountTableResource } from "./resources/table";

const app = new Hono<ApiEnv>();
const resourceMounts = {
  cells: mountCellResource,
  column_dependencies: mountColumnDependencyResource,
  columns: mountColumnResource,
  events: mountEventResource,
  keys: mountKeyResource,
  pipes: mountPipeResource,
  profiles: mountProfileResource,
  program_files: mountProgramFileResource,
  program_runs: mountProgramRunResource,
  program_versions: mountProgramVersionResource,
  programs: mountProgramResource,
  projects: mountProjectResource,
  rows: mountRowResource,
  secrets: mountSecretResource,
  source_events: mountSourceEventResource,
  sources: mountSourceResource,
  tables: mountTableResource,
} satisfies Record<ApiResourceName, (app: Hono<ApiEnv>) => void>;

function executorEndpointUrl(baseUrl: string, path: string, search: string) {
  const endpoint = new URL(baseUrl);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}${path}`;
  endpoint.search = search;
  return endpoint;
}

const cellRunBodySchema = z.object({
  manualInput: z.string().nullable().optional(),
});

const batchCellRunBodySchema = z.object({
  cellIds: z.array(z.string().uuid()).min(1),
  manualInput: z.string().nullable().optional(),
});

function forwardExecutorHeaders(c: ApiContext) {
  return Object.fromEntries(
    [
      [
        "Authorization",
        c.req.header("Authorization"),
      ],
      [
        "Content-Type",
        "application/json",
      ],
      [
        "x-marble-actor-source",
        c.req.header("x-marble-actor-source"),
      ],
      [
        "x-marble-auth-key-id",
        c.req.header("x-marble-auth-key-id"),
      ],
      [
        "x-marble-auth-profile-id",
        c.req.header("x-marble-auth-profile-id"),
      ],
      [
        "x-marble-auth-user-id",
        c.req.header("x-marble-auth-user-id"),
      ],
      [
        "x-marble-request-id",
        c.req.header("x-marble-request-id"),
      ],
    ].filter(
      (
        entry,
      ): entry is [
        string,
        string,
      ] => entry[1] !== undefined,
    ),
  );
}

async function proxyExecutorRequest(
  c: ApiContext,
  options: {
    body: unknown;
    path: string;
    search: string;
  },
) {
  const env = getEnv(c.env);
  const response = await fetch(
    executorEndpointUrl(
      env.MARBLE_EXECUTOR_URL || "http://localhost:3087",
      options.path,
      options.search,
    ),
    {
      body: JSON.stringify(options.body),
      headers: forwardExecutorHeaders(c),
      method: "POST",
    },
  );
  const text = await response.text();

  try {
    return {
      payload: JSON.parse(text) as Record<string, unknown>,
      status: response.status as 200 | 400 | 401 | 404 | 500,
    };
  } catch {
    return {
      payload: {
        error: true,
        message: text || "Executor returned a non-JSON response.",
        output: null,
        success: false,
      },
      status: response.status as 200 | 400 | 401 | 404 | 500,
    };
  }
}

async function executeStoredRun(
  c: ApiContext,
  options: {
    cellId: string;
    runId: string;
    setPendingState?: boolean;
  },
) {
  if (options.setPendingState !== false) {
    await updateRecord(c.var.supabase, "cell", options.cellId, {
      state: {
        ok: null,
      } as Json,
    });
  }

  const { payload, status } = await proxyExecutorRequest(c, {
    body: {},
    path: "/run",
    search: new URLSearchParams({
      run_id: options.runId,
    }).toString(),
  });
  const responseStatus =
    status === 500 && payload.success === false ? 200 : status;

  return c.json(
    {
      ...payload,
      runId: options.runId,
    },
    {
      status: responseStatus,
    },
  );
}

async function executeStoredRuns(
  c: ApiContext,
  options: {
    runIds: string[];
  },
) {
  const { payload, status } = await proxyExecutorRequest(c, {
    body: {
      runIds: options.runIds,
    },
    path: "/runs",
    search: "",
  });
  const responseStatus =
    status === 500 && payload.success === false ? 200 : status;

  return c.json(payload, {
    status: responseStatus,
  });
}

async function createPendingStoredRun(
  c: ApiContext,
  options: {
    cellId: string;
    manualInput?: string | null;
  },
) {
  const cell = await requireAccessibleCell(c.var.supabase, {
    authenticatedProfileId: c.var.auth?.profileId,
    cellId: options.cellId,
    userId: c.var.auth?.userId,
  });
  const column = await getRecord(c.var.supabase, "column", cell.column_id);

  await updateRecord(c.var.supabase, "cell", options.cellId, {
    ...(options.manualInput === undefined
      ? {}
      : {
          manual_input: options.manualInput,
        }),
    state: {
      ok: null,
    } as Json,
  });

  const run = await createRecord(c.var.supabase, "program_run", {
    program_version_id: column.program_version_id,
    target_cell_id: options.cellId,
  });

  return {
    cellId: options.cellId,
    runId: run.id,
  };
}

function normalizeEventSource(
  value: string | undefined,
): EventSource | undefined {
  switch (value?.trim().toLowerCase()) {
    case "cli":
      return "CLI";
    case "raw_api":
    case "raw-api":
    case "api":
      return "RAW_API";
    case "web_app":
    case "web-app":
    case "webapp":
      return "WEB_APP";
    default:
      return undefined;
  }
}

function resolveEventSource(options: {
  actorKeyId?: string;
  forwardedUserId?: string;
  requestedActorSource?: string;
}): EventSource {
  return (
    normalizeEventSource(options.requestedActorSource) ??
    (options.forwardedUserId ? "WEB_APP" : undefined) ??
    (options.actorKeyId ? "RAW_API" : "RAW_API")
  );
}

app.use("*", async (c, next) => {
  const env = getEnv(c.env);
  const authHeader = c.req.header("Authorization");
  const forwardedProfileId =
    c.req.header("x-marble-auth-profile-id")?.trim() || undefined;
  const forwardedKeyId =
    c.req.header("x-marble-auth-key-id")?.trim() || undefined;
  const forwardedUserId =
    c.req.header("x-marble-auth-user-id")?.trim() || undefined;
  const requestedActorSource =
    c.req.header("x-marble-actor-source")?.trim() || undefined;
  const requestId =
    c.req.header("x-marble-request-id")?.trim() || crypto.randomUUID();
  let actorProfileId = forwardedProfileId;
  let actorKeyId = forwardedKeyId;

  if (!forwardedProfileId) {
    const apiKeyToken = getApiKeyTokenFromHeaders(c.req.raw.headers);

    if (apiKeyToken) {
      const keyAuth = await resolveApiKeyAuth(
        createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
        apiKeyToken,
      );

      if (keyAuth) {
        actorProfileId = keyAuth.owner_profile_id;
        actorKeyId = keyAuth.id;
        c.set("auth", {
          keyId: keyAuth.id,
          profileId: keyAuth.owner_profile_id,
          type: "api-key",
        });
      }
    }
  } else if (forwardedProfileId || forwardedKeyId || forwardedUserId) {
    c.set("auth", {
      ...(forwardedKeyId
        ? {
            keyId: forwardedKeyId,
          }
        : {}),
      ...(forwardedProfileId
        ? {
            profileId: forwardedProfileId,
          }
        : {}),
      ...(forwardedUserId
        ? {
            userId: forwardedUserId,
          }
        : {}),
      type: "forwarded",
    });
  }

  const source = resolveEventSource({
    actorKeyId,
    forwardedUserId,
    requestedActorSource,
  });
  const supabase = authHeader
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      })
    : createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  c.set(
    "supabase",
    attachEventContext(supabase, {
      actorKeyId,
      actorProfileId,
      requestId,
      source,
      userId: forwardedUserId,
    }),
  );

  await next();
});

app.get(
  "/",
  route(async (c) =>
    c.json({
      resources: Object.fromEntries(
        ApiResourceNames.map((resourceName) => [
          resourceName,
          apiResourcePath(resourceName),
        ]),
      ),
    }),
  ),
);

for (const resourceName of ApiResourceNames) {
  resourceMounts[resourceName](app);
}

mountSecretBindingRoutes(app);

app.post(
  "/test",
  route(async (c) => {
    const requestUrl = new URL(c.req.url);
    const { payload, status } = await proxyExecutorRequest(c, {
      body: await readJsonBody(c),
      path: "/test",
      search: requestUrl.search,
    });

    return c.json(payload, {
      status,
    });
  }),
);

app.post(
  "/program-runs/:runId/execute",
  route(async (c) => {
    const runId = requiredParam(c, "runId");
    const run = await requireAccessibleProgramRun(c.var.supabase, {
      authenticatedProfileId: c.var.auth?.profileId,
      runId,
      userId: c.var.auth?.userId,
    });

    return executeStoredRun(c, {
      cellId: run.target_cell_id,
      runId,
    });
  }),
);

app.post(
  "/cells/:cellId/run",
  route(async (c) => {
    const cellId = requiredParam(c, "cellId");
    const body = await parseJsonBody(c, cellRunBodySchema);
    const run = await createPendingStoredRun(c, {
      cellId,
      manualInput: body.manualInput,
    });

    return executeStoredRun(c, {
      cellId,
      runId: run.runId,
      setPendingState: false,
    });
  }),
);

app.post(
  "/cells/run",
  route(async (c) => {
    const body = await parseJsonBody(c, batchCellRunBodySchema);
    const cellIds = Array.from(new Set(body.cellIds));
    const runs = await Promise.all(
      cellIds.map((cellId) =>
        createPendingStoredRun(c, {
          cellId,
          manualInput: body.manualInput,
        }),
      ),
    );

    return executeStoredRuns(c, {
      runIds: runs.map((run) => run.runId),
    });
  }),
);

export default app;
