import { getSandbox } from "@cloudflare/sandbox";
import { type JsonValue, resolveColumnConfig, Schemas } from "@marble/core";
import { createClient, type Json } from "@marble/supabase";
import { z } from "zod";

export { Sandbox } from "@cloudflare/sandbox";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        {
          error: true,
          message: "Missing Supabase credentials.",
        },
        {
          status: 500,
        },
      );
    }

    const url = new URL(request.url);
    const runId = url.searchParams.get("run_id");

    if (!runId) {
      return Response.json(
        {
          error: true,
          message: "Missing required `run_id` search parameter.",
        },
        {
          status: 400,
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: runs, error: runError } = await supabase
      .from("program_run")
      .select(
        `
        *,
        program(*),
        cell!target_cell_id(*, column!column_id(*))
      `,
      )
      .eq("id", runId);

    const run = runs?.at(0);

    if (!run || runError) {
      return Response.json(
        {
          error: true,
          message: runError?.message ?? "No run found.",
        },
        {
          status: 404,
        },
      );
    }

    // From here on, any failure MUST be persisted to cell.state + program_run.output
    const persistFailure = async (
      errorType: string,
      message: string,
      detail?: Json,
    ) => {
      const failState = {
        ok: false as const,
        error: {
          type: errorType,
          ...(detail != null
            ? {
                detail,
              }
            : {}),
        },
        message,
      };
      await Promise.all([
        supabase
          .from("cell")
          .update({
            state: failState,
          })
          .eq("id", run.target_cell_id),
        supabase
          .from("program_run")
          .update({
            output: failState as unknown as Json,
          })
          .eq("id", runId),
      ]);
      return failState;
    };

    try {
      const { data: dependencies } = await supabase
        .from("column_dependency")
        .select("source_column_id")
        .eq("target_column_id", run.cell.column.id);

      const sourceColumnIds =
        dependencies?.map((d) => d.source_column_id) ?? [];

      const { data: dependencyCells } = await supabase
        .from("cell")
        .select("*")
        .eq("row_id", run.cell.row_id)
        .in("column_id", sourceColumnIds);

      const columns: Record<string, JsonValue> = {};
      for (const cell of dependencyCells ?? []) {
        const state = cell.state as {
          ok?: boolean;
          value?: JsonValue;
        } | null;
        columns[cell.column_id] = {
          value: state?.ok ? (state.value ?? null) : null,
        };
      }

      const rowContext: Record<string, JsonValue> = {
        cell: {
          manualInputValue: run.cell.manual_input,
        },
        columns,
      };

      const inputTemplate: JsonValue = JSON.parse(
        run.cell.column.input_template,
      );
      const resolvedInput = resolveColumnConfig(inputTemplate, rowContext);

      const inputPayloadSchema = Schemas.ProgramInputSchema.parse(
        run.program.input_schema,
      );
      const parsedInput = z
        .fromJSONSchema(inputPayloadSchema)
        .parse(resolvedInput);

      if (run.program.runtime !== "JavaScript") {
        const failState = await persistFailure(
          "UnsupportedRuntime",
          `Runtime "${run.program.runtime}" is not supported yet.`,
        );
        return Response.json(
          {
            success: false,
            output: failState,
          },
          {
            status: 501,
          },
        );
      }

      const sandbox = getSandbox(env.Sandbox, run.cell.column.id);

      const runInput = {
        system: {},
        cell: {
          manualInputValue: run.cell.manual_input ?? undefined,
        },
        input: parsedInput,
      };

      const codeAsBase64 = Buffer.from(run.program.code).toString("base64");
      const inputAsBase64 = Buffer.from(JSON.stringify(runInput)).toString(
        "base64",
      );

      const statement = `\
    node --input-type=module -e \
    "const m = await import('data:text/javascript;base64,${codeAsBase64}');\
    const ri = JSON.parse(Buffer.from('${inputAsBase64}', 'base64').toString());\
    console.log(JSON.stringify(await m.default(ri)))"
    `;

      console.log(`Running statement:\n\n${statement}`);

      const executionResult = await sandbox.exec(statement);

      // Output schema is resolved ahead of execution and stored on the column.
      const outputSchema = Schemas.ColumnOutputSchema.parse(
        run.cell.column.output_schema,
      );

      const rawOutput = (() => {
        if (!executionResult.success) {
          return {
            ok: false as const,
            error: {
              type: "Crashed",
            },
            message: executionResult.stderr.trim() || "Program crashed",
          };
        }

        try {
          const parsed = JSON.parse(executionResult.stdout.trim());

          // Validate shape but preserve the full raw data —
          // z.fromJSONSchema strips undeclared properties at every
          // nesting level which destroys rich API responses.
          const validation = z.fromJSONSchema(outputSchema).safeParse(parsed);

          if (!validation.success) {
            const detail = validation.error.issues as unknown as
              | Json
              | undefined;
            const summary = validation.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ");
            return {
              ok: false as const,
              error: {
                type: "Parser",
                ...(detail
                  ? {
                      detail,
                    }
                  : {}),
              },
              message: `Output validation failed: ${summary}`,
            };
          }

          return {
            ok: true as const,
            value: parsed,
          };
        } catch (e) {
          const summary =
            e instanceof Error
              ? e.message
              : `Unexpected parse error: ${String(e)}`;
          return {
            ok: false as const,
            error: {
              type: "Parser",
            },
            message: `Output validation failed: ${summary}`,
          };
        }
      })();

      const validatedOutput = Schemas.RunReturnValue.parse(rawOutput);

      await Promise.all([
        supabase
          .from("cell")
          .update({
            state: validatedOutput,
          })
          .eq("id", run.target_cell_id),
        supabase
          .from("program_run")
          .update({
            input: parsedInput as Json,
            output: validatedOutput as Json,
          })
          .eq("id", runId),
      ]);

      return Response.json({
        success: true,
        output: validatedOutput,
      });
    } catch (e) {
      console.error(`Run ${runId} failed:`, e);

      if (e instanceof z.ZodError) {
        const summary = e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        const failState = await persistFailure(
          "Validation",
          summary,
          e.issues as unknown as Json,
        );
        return Response.json(
          {
            success: false,
            output: failState,
          },
          {
            status: 500,
          },
        );
      }

      const message =
        e instanceof Error ? e.message : `Unexpected error: ${String(e)}`;
      const failState = await persistFailure("Unhandled", message);
      return Response.json(
        {
          success: false,
          output: failState,
        },
        {
          status: 500,
        },
      );
    }
  },
};
