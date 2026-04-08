import {
  createClient,
  type Database,
  type SupabaseClient,
} from "@marble/supabase";
import { Hono } from "hono";
import { getEnv } from "./env";

export type ApiEnv = {
  Bindings: {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    MARBLE_EXECUTOR_URL?: string;
  };
  Variables: {
    supabase: SupabaseClient;
  };
};

const app = new Hono<ApiEnv>();
type CellInsert = Database["public"]["Tables"]["cell"]["Insert"];

async function createCells(
  supabase: SupabaseClient,
  cells: CellInsert[],
): Promise<void> {
  if (cells.length === 0) {
    return;
  }

  const { error } = await supabase.from("cell").insert(cells);
  if (error) {
    throw error;
  }
}

// Middleware: Authenticate and inject Supabase client
app.use("*", async (c, next) => {
  const env = getEnv(c.env);
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return c.json(
      {
        error: "Server missing Supabase credentials",
      },
      500,
    );
  }

  // Allow clients to pass their own auth token if RLS is desired,
  // Otherwise default to the service role key for admin tasks.
  const authHeader = c.req.header("Authorization");
  const headers: Record<string, string> = authHeader
    ? {
        Authorization: authHeader,
      }
    : {};

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers,
    },
  });

  c.set("supabase", supabase);
  await next();
});

// --- Tables ---

app.get("/tables", async (c) => {
  const { data, error } = await c.var.supabase.from("table").select("*");
  if (error)
    return c.json(
      {
        error: error.message,
      },
      500,
    );
  return c.json(data);
});

app.post("/tables", async (c) => {
  const body = await c.req.json();
  const { data, error } = await c.var.supabase
    .from("table")
    .insert({
      name: body.name || "Untitled Table",
    })
    .select()
    .single();

  if (error)
    return c.json(
      {
        error: error.message,
      },
      500,
    );
  return c.json(data);
});

app.get("/tables/:id", async (c) => {
  const { data, error } = await c.var.supabase
    .from("table")
    .select("*, column(*), row(*)")
    .eq("id", c.req.param("id"))
    .single();

  if (error)
    return c.json(
      {
        error: error.message,
      },
      404,
    );
  return c.json(data);
});

app.delete("/tables/:id", async (c) => {
  const { error } = await c.var.supabase
    .from("table")
    .delete()
    .eq("id", c.req.param("id"));

  if (error)
    return c.json(
      {
        error: error.message,
      },
      500,
    );
  return c.json({
    success: true,
  });
});

// --- Programs ---

app.get("/programs", async (c) => {
  const { data, error } = await c.var.supabase.from("program").select("*");
  if (error)
    return c.json(
      {
        error: error.message,
      },
      500,
    );
  return c.json(data);
});

app.get("/programs/:id", async (c) => {
  const { data, error } = await c.var.supabase
    .from("program")
    .select("*")
    .eq("id", c.req.param("id"))
    .single();

  if (error)
    return c.json(
      {
        error: error.message,
      },
      404,
    );
  return c.json(data);
});

app.post("/programs", async (c) => {
  const body = await c.req.json();

  const payload = {
    name: body.name,
    code: body.code,
    runtime: body.runtime || "JavaScript",
    input_schema: body.inputSchema,
    output_config: body.outputConfig,
  };

  const { data: existing } = await c.var.supabase
    .from("program")
    .select("id")
    .eq("name", payload.name)
    .single();

  let result: {
    data: unknown;
    error: {
      message: string;
    } | null;
  };
  if (existing) {
    result = await c.var.supabase
      .from("program")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await c.var.supabase
      .from("program")
      .insert(payload)
      .select()
      .single();
  }

  if (result.error)
    return c.json(
      {
        error: result.error.message,
      },
      500,
    );
  return c.json(result.data);
});

app.post("/programs/dry-run", async (c) => {
  const env = getEnv(c.env);
  const executorUrl = env.MARBLE_EXECUTOR_URL || "http://localhost:8787";
  const body = await c.req.json();

  try {
    const res = await fetch(`${executorUrl}/dry-run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return c.json(
        {
          error: "Executor failed",
          detail: text,
        },
        // @ts-expect-error Types for Hono status are strict but we forward HTTP status
        res.status,
      );
    }

    const data = await res.json();
    return c.json(data);
  } catch (err) {
    return c.json(
      {
        error: String(err),
      },
      500,
    );
  }
});

// --- Columns ---

app.get("/tables/:tableId/columns", async (c) => {
  const { data, error } = await c.var.supabase
    .from("column")
    .select("*")
    .eq("table_id", c.req.param("tableId"))
    .order("index", {
      ascending: true,
    });

  if (error)
    return c.json(
      {
        error: error.message,
      },
      500,
    );
  return c.json(data);
});

app.post("/tables/:tableId/columns", async (c) => {
  const tableId = c.req.param("tableId");
  const body = await c.req.json();

  const { data: columns } = await c.var.supabase
    .from("column")
    .select("index")
    .eq("table_id", tableId)
    .order("index", {
      ascending: false,
    })
    .limit(1);

  const nextIndex = columns && columns.length > 0 ? columns[0].index + 1 : 0;

  const { data, error } = await c.var.supabase
    .from("column")
    .insert({
      table_id: tableId,
      name: body.name,
      index: nextIndex,
      program_id: body.programId,
      input_template: body.inputTemplate,
      output_schema: body.outputSchema,
    })
    .select()
    .single();

  if (error)
    return c.json(
      {
        error: error.message,
      },
      500,
    );

  // Automatically extract column dependencies from the inputTemplate
  let templateObj: unknown;
  try {
    templateObj =
      typeof body.inputTemplate === "string"
        ? JSON.parse(body.inputTemplate)
        : body.inputTemplate;
  } catch (_e) {
    templateObj = {};
  }

  const deps = new Set<string>();

  function extractDeps(obj: unknown) {
    if (!obj || typeof obj !== "object") {
      if (typeof obj === "string") {
        const matches = [
          ...obj.matchAll(/\$\.columns\.([^.]+)/g),
        ];
        for (const match of matches) {
          deps.add(match[1]);
        }
      }
      return;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) extractDeps(item);
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (
        key === "$marble_ref" &&
        Array.isArray(value) &&
        value[0] === "columns"
      ) {
        deps.add(value[1]);
      } else if (key.endsWith(".$") && typeof value === "string") {
        const match = value.match(/\$\.columns\.([^.]+)/);
        if (match) deps.add(match[1]);
      } else {
        extractDeps(value);
      }
    }
  }

  extractDeps(templateObj);

  if (deps.size > 0) {
    const depInserts = Array.from(deps).map((source_column_id) => ({
      source_column_id,
      target_column_id: data.id,
    }));
    const { error: depError } = await c.var.supabase
      .from("column_dependency")
      .insert(depInserts);

    if (depError) {
      console.error("Failed to insert column dependencies:", depError.message);
    }
  }

  const { data: rows, error: rowsError } = await c.var.supabase
    .from("row")
    .select("id")
    .eq("table_id", tableId);

  if (rowsError) {
    await c.var.supabase.from("column").delete().eq("id", data.id);
    return c.json(
      {
        error: rowsError.message,
      },
      500,
    );
  }

  try {
    await createCells(
      c.var.supabase,
      (rows ?? []).map((row) => ({
        column_id: data.id,
        row_id: row.id,
      })),
    );
  } catch (err) {
    await c.var.supabase.from("column").delete().eq("id", data.id);
    return c.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }

  return c.json(data);
});

// --- Rows & Cells ---

app.get("/tables/:tableId/rows", async (c) => {
  const { data, error } = await c.var.supabase
    .from("row")
    .select("*")
    .eq("table_id", c.req.param("tableId"))
    .order("index", {
      ascending: true,
    });

  if (error)
    return c.json(
      {
        error: error.message,
      },
      500,
    );
  return c.json(data);
});

app.post("/tables/:tableId/rows", async (c) => {
  const tableId = c.req.param("tableId");

  const { data: rows } = await c.var.supabase
    .from("row")
    .select("index")
    .eq("table_id", tableId)
    .order("index", {
      ascending: false,
    })
    .limit(1);

  const nextIndex = rows && rows.length > 0 ? rows[0].index + 1 : 0;

  const { data, error } = await c.var.supabase
    .from("row")
    .insert({
      table_id: tableId,
      index: nextIndex,
    })
    .select()
    .single();

  if (error)
    return c.json(
      {
        error: error.message,
      },
      500,
    );

  const { data: columns, error: columnsError } = await c.var.supabase
    .from("column")
    .select("id")
    .eq("table_id", tableId);

  if (columnsError) {
    await c.var.supabase.from("row").delete().eq("id", data.id);
    return c.json(
      {
        error: columnsError.message,
      },
      500,
    );
  }

  try {
    await createCells(
      c.var.supabase,
      (columns ?? []).map((column) => ({
        column_id: column.id,
        row_id: data.id,
      })),
    );
  } catch (err) {
    await c.var.supabase.from("row").delete().eq("id", data.id);
    return c.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }

  return c.json(data);
});

app.get("/cells/:cellId", async (c) => {
  const { data, error } = await c.var.supabase
    .from("cell")
    .select("*, program_run(*)")
    .eq("id", c.req.param("cellId"))
    .single();

  if (error)
    return c.json(
      {
        error: error.message,
      },
      404,
    );
  return c.json(data);
});

export default app;
