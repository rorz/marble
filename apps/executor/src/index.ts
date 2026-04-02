import { getSandbox } from "@cloudflare/sandbox";
import {
  resolveColumnConfig,
  resolveColumnOutputSchema,
  Schemas,
  type JsonValue,
} from "@marble/core";
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

    // Load the program run with its associated program, target cell, and column
    const { data: runs, error: runError } = await supabase
      .from("program_run")
      .select(`
        *,
        program(*),
        cell!target_cell_id(*, column!column_id(*))
      `)
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

    // Determine which upstream columns this column depends on
    const { data: dependencies } = await supabase
      .from("column_dependency")
      .select("source_column_id")
      .eq("target_column_id", run.cell.column.id);

    const sourceColumnIds = dependencies?.map((d) => d.source_column_id) ?? [];

    // Load the sibling cells in the same row for each dependency column
    const { data: dependencyCells } = await supabase
      .from("cell")
      .select("*")
      .eq("row_id", run.cell.row_id)
      .in("column_id", sourceColumnIds);

    // Build the row context used by JSONPath-based template resolution.
    // Each dependency cell's state is a RunReturnValue; we unwrap to the raw value.
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

    // Resolve the column's input template (JSONPath `.$` keys → concrete values)
    const inputTemplate: JsonValue = JSON.parse(run.cell.column.input_template);
    const resolvedInput = resolveColumnConfig(inputTemplate, rowContext);

    // Validate the resolved input against the program's declared input schema
    const inputPayloadSchema = Schemas.ProgramInputSchema.parse(
      run.program.input_payload_schema,
    );
    const parsedInput = z
      .fromJSONSchema(inputPayloadSchema)
      .parse(resolvedInput);

    if (run.program.runtime !== "JavaScript") {
      return Response.json(
        {
          error: true,
          message: "Only JavaScript is supported right now.",
        },
        {
          status: 501,
        },
      );
    }

    // Execute the program in a sandboxed environment
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
    console.log(JSON.stringify(m.default(ri)))"
    `;

    console.log(`Running statement:\n\n${statement}`);

    const executionResult = await sandbox.exec(statement);

    // Resolve the correct output schema (accounting for overloads)
    const outputConfig = Schemas.ProgramOutputConfig.parse(
      run.program.output_value_schema,
    );
    const outputSchema = resolveColumnOutputSchema(
      resolvedInput as Record<string, unknown>,
      outputConfig,
    );

    const rawOutput = (() => {
      if (!executionResult.success) {
        return {
          ok: false,
          error: {
            type: "Crashed",
          },
          message: executionResult.stderr.trim(),
        };
      }

      try {
        const value = z
          .fromJSONSchema(outputSchema)
          .parse(JSON.parse(executionResult.stdout.trim()));

        return {
          ok: true,
          value,
        };
      } catch (e) {
        return {
          ok: false,
          error: {
            type: "Parser",
          },
          message: `Unable to parse program output: ${e}`,
        };
      }
    })();

    const validatedOutput = Schemas.RunReturnValue.parse(rawOutput);

    // Persist the results back to the cell state and program run record
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
  },
};
