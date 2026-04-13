import {
  type ApiResourceName,
  ApiResourceNames,
  apiResourcePath,
} from "@marble/core";
import { getApiKeyTokenFromHeaders, resolveApiKeyAuth } from "@marble/keys";
import { createClient } from "@marble/supabase";
import { Hono } from "hono";
import { type ApiEnv, readJsonBody, route } from "./core";
import { getEnv } from "./env";
import { mountCellResource } from "./resources/cell";
import { mountColumnResource } from "./resources/column";
import { mountColumnDependencyResource } from "./resources/column_dependency";
import { mountEventResource } from "./resources/event";
import { mountProfileResource } from "./resources/profile";
import { mountProgramResource } from "./resources/program";
import { mountProgramFileResource } from "./resources/program_file";
import { mountProgramRunResource } from "./resources/program_run";
import { mountProgramVersionResource } from "./resources/program_version";
import { mountRowResource } from "./resources/row";
import { mountTableResource } from "./resources/table";

const app = new Hono<ApiEnv>();
const resourceMounts = {
  profiles: mountProfileResource,
  events: mountEventResource,
  tables: mountTableResource,
  columns: mountColumnResource,
  column_dependencies: mountColumnDependencyResource,
  rows: mountRowResource,
  cells: mountCellResource,
  programs: mountProgramResource,
  program_versions: mountProgramVersionResource,
  program_files: mountProgramFileResource,
  program_runs: mountProgramRunResource,
} satisfies Record<ApiResourceName, (app: Hono<ApiEnv>) => void>;

function executorEndpointUrl(baseUrl: string, path: string, search: string) {
  const endpoint = new URL(baseUrl);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}${path}`;
  endpoint.search = search;
  return endpoint;
}

app.use("*", async (c, next) => {
  const env = getEnv(c.env);
  const authHeader = c.req.header("Authorization");
  const forwardedProfileId =
    c.req.header("x-marble-auth-profile-id")?.trim() || undefined;
  const forwardedKeyId =
    c.req.header("x-marble-auth-key-id")?.trim() || undefined;
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
  } else {
    c.set("auth", {
      ...(forwardedKeyId
        ? {
            keyId: forwardedKeyId,
          }
        : {}),
      profileId: forwardedProfileId,
      type: "forwarded-key",
    });
  }

  const headers: Record<string, string> = {
    "x-marble-actor-source":
      requestedActorSource ??
      (actorKeyId ? "api" : forwardedProfileId ? "webapp" : "system"),
    "x-marble-request-id": requestId,
  };

  if (authHeader) {
    headers.Authorization = authHeader;
  }

  if (actorProfileId) {
    headers["x-marble-auth-profile-id"] = actorProfileId;
  }

  if (actorKeyId) {
    headers["x-marble-auth-key-id"] = actorKeyId;
  }

  c.set(
    "supabase",
    createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers,
      },
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

app.post(
  "/test",
  route(async (c) => {
    const env = getEnv(c.env);
    const requestUrl = new URL(c.req.url);
    const response = await fetch(
      executorEndpointUrl(
        env.MARBLE_EXECUTOR_URL || "http://localhost:8787",
        "/test",
        requestUrl.search,
      ),
      {
        body: JSON.stringify(await readJsonBody(c)),
        headers: Object.fromEntries(
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
        ),
        method: "POST",
      },
    );

    const text = await response.text();

    try {
      return c.json(JSON.parse(text) as unknown, {
        status: response.status as 200 | 400 | 401 | 404 | 500,
      });
    } catch {
      return c.json(text, {
        status: response.status as 200 | 400 | 401 | 404 | 500,
      });
    }
  }),
);

export default app;
