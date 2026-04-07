import { createClient, type SupabaseClient } from "@marble/supabase";
import { Hono } from "hono";

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

// Middleware: Authenticate and inject Supabase client
app.use("*", async (c, next) => {
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const executorUrl = c.env.MARBLE_EXECUTOR_URL || "http://localhost:8787";
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
