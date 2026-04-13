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

app.use("*", async (c, next) => {
  const env = getEnv(c.env);
  const authHeader = c.req.header("Authorization");
  const headers: Record<string, string> = authHeader
    ? {
        Authorization: authHeader,
      }
    : {};

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
      resources: {
        column_dependencies: "/column-dependencies",
        columns: "/columns",
        events: "/events",
        profiles: "/profiles",
        program_files: "/program-files",
        program_runs: "/program-runs",
        program_versions: "/program-versions",
        programs: "/programs",
        rows: "/rows",
        tables: "/tables",
      },
    }),
  ),
);

mountProfileResource(app);
mountEventResource(app);
mountTableResource(app);
mountColumnResource(app);
mountColumnDependencyResource(app);
mountRowResource(app);
mountCellResource(app);
mountProgramResource(app);
mountProgramVersionResource(app);
mountProgramFileResource(app);
mountProgramRunResource(app);

app.post(
  "/programs/dry-run",
  route(async (c) => {
    const env = getEnv(c.env);
    const response = await fetch(
      `${env.MARBLE_EXECUTOR_URL || "http://localhost:8787"}/dry-run`,
      {
        body: JSON.stringify(await readJsonBody(c)),
        headers: {
          "Content-Type": "application/json",
        },
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
