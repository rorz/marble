import { getSandbox } from "@cloudflare/sandbox";
import { createClient, Schemas } from "@marble/supabase";

export { Sandbox } from "@cloudflare/sandbox";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        { error: true, message: "Missing Supabase credentials." },
        { status: 500 },
      );
    }

    const url = new URL(request.url);
    const columnProgramRunId = url.searchParams.get("run_id");
    const requestBody = Schemas.ExecutorRequestBodySchema.parse(
      await request.json(),
    );

    if (!columnProgramRunId) {
      return Response.json(
        { error: true, message: "Missing required `run_id` search parameter." },
        { status: 400 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const columnProgramRunInitialValueQuery = await supabase
      .from("column_program_run")
      .select(`
        *,
        column_program(*),
        cell(*, column(*))
        `)
      .eq("id", columnProgramRunId);

    const runValue = columnProgramRunInitialValueQuery.data?.at(0);

    if (runValue === undefined) {
      return Response.json({
        error: true,
        message: "No run found.",
      });
    }

    const inputSchema = Schemas.ColumnProgramInputSchema.parse(
      runValue.column_program.input_schema,
    );
    const outputSchema = Schemas.ColumnProgramOutputSchema.parse(
      runValue.column_program.output_schema,
    );
    const template = Schemas.ColumnProgramInputValuesTemplate.parse(
      runValue.cell.column.input_values_template,
    );

    // Resolve template → concrete variables
    const columnRefs = Object.values(template.variables).flatMap((v) =>
      v.source === "column" ? [v.column_id] : [],
    );

    const depCells =
      columnRefs.length > 0
        ? await supabase
            .from("cell")
            .select("column_id, value")
            .eq("row_id", runValue.cell.row_id)
            .in("column_id", columnRefs)
        : { data: [] };

    const depValues = Object.fromEntries(
      (depCells.data ?? []).map((c) => [c.column_id, c.value]),
    );

    const variables = Object.fromEntries(
      Object.entries(template.variables).map(([key, tmpl]) => {
        const value =
          tmpl.source === "column"
            ? (depValues[tmpl.column_id] ?? null)
            : tmpl.source === "cell_value"
              ? (requestBody.$marble__cell_value ?? null)
              : tmpl.value;
        return [key, value];
      }),
    );

    if (runValue.column_program.runtime !== "JavaScript") {
      return Response.json({
        error: true,
        message: "Only JavaScript is supported right now",
      });
    }

    const sandbox = getSandbox(env.Sandbox, runValue.cell.column.id);

    const codeAsBase64 = Buffer.from(runValue.column_program.code).toString(
      "base64",
    );
    const variablesJson = JSON.stringify(variables);
    const statement = `\
    node --input-type=module -e \
    "const m = await import('data:text/javascript;base64,${codeAsBase64}');\
    console.log(m.default({variables: ${variablesJson}}))"
    `;

    const executionResult = await sandbox.exec(statement);

    const output = (() => {
      try {
        return JSON.parse(executionResult.stdout.trim());
      } catch {
        return executionResult.stdout.trim();
      }
    })();

    await supabase
      .from("cell")
      .update({ value: output })
      .eq("id", runValue.target_cell_id);

    await supabase
      .from("column_program_run")
      .update({ output })
      .eq("id", columnProgramRunId);

    return Response.json({
      success: true,
      output,
    });
  },
};
