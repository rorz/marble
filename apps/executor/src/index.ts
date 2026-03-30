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
    const inputValuesTemplate = Schemas.ColumnProgramInputValuesTemplate.parse(
      runValue.cell.column.input_values_template,
    );
    const variables = inputValuesTemplate;

    if (runValue.column_program.runtime !== "JavaScript") {
      return Response.json({
        error: true,
        message: "Only JavaScript is supported right now",
      });
    }

    // Scoped to column for speed atm?
    const sandbox = getSandbox(env.Sandbox, runValue.cell.column.id);

    // --Build the node call
    const codeAsBase64 = Buffer.from(runValue.column_program.code).toString(
      "base64",
    );
    const statement = `\
    node --input-type=module -e \
    "const m = await import('data:text/javascript;base64,${codeAsBase64}');\
    m.default({variables: ${variables}})"
    `;

    const executionResult = await sandbox.exec(statement);

    await supabase
      .from("cell")
      .update({
        value: executionResult.stdout,
      })
      .eq("id", runValue.target_cell_id);

    await supabase
      .from("column_program_run")
      .update({
        output: executionResult.stdout,
      })
      .eq("id", runValue.target_cell_id);

    return Response.json({
      success: true,
    });
  },
};
