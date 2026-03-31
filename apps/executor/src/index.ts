import { getSandbox } from "@cloudflare/sandbox";
import { createClient, Schemas } from "@marble/supabase";
import mustache from "mustache";
import z from "zod";
import { JsonSchemaSchema } from "../../../supabase/src/schemas";

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
    const runId = url.searchParams.get("run_id");
    const requestBody = Schemas.ExecutorRequestBodySchema.parse(
      await request.json(),
    );

    if (!runId) {
      return Response.json(
        { error: true, message: "Missing required `run_id` search parameter." },
        { status: 400 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const columnProgramRunInitialValueQuery = await supabase
      .from("program_run")
      .select(`
        *,
        program(*),
        cell(*, column(*))
        `)
      .eq("id", runId);

    const runValue = columnProgramRunInitialValueQuery.data?.at(0);

    if (runValue === undefined) {
      return Response.json({
        error: true,
        message: "No run found.",
      });
    }

    const columnDependencies = await supabase
      .from("column_dependency")
      .select(`
        *,
        column!source_column_id(*)
        `)
      .eq("target_column_id", runValue.cell.column.id);

    const cellsInRow = await supabase
      .from("cell")
      .select(`*`)
      .eq("row_id", runValue.cell.row_id)
      .in("column_id", columnDependencies.data?.map(({ id }) => id) ?? []);

    const view = cellsInRow.data?.reduce(
      (acc, cell) => {
        return {
          columns: {
            ...acc.columns,
            [cell.column_id]: {
              value: cell.value,
            },
          },
        };
      },
      {
        columns: {},
      },
    );

    const renderedInput = mustache.render(
      runValue.cell.column.input_template,
      view,
    );
    const inputPayloadSchema = JsonSchemaSchema.parse(
      runValue.program.input_payload_schema,
    );
    // if (inputPayloadSchema === null) {
    //   return Response.json({
    //     error: true,
    //     message: "schema equals null",
    //   });
    // }

    const parsedInput = z
      .fromJSONSchema(inputPayloadSchema)
      .parse(JSON.parse(renderedInput));

    // const templateInput = {
    //   columns: {}
    // }

    // cellsInRow.data?.forEach(cir => {
    //   templateInput.columns[cir.column_id] = {
    //     value: cir.value
    //   }
    // })

    // const inputSchema = Schemas.ColumnProgramInputSchema.parse(
    //   runValue.program.input_payload_schema,
    // );
    // const outputSchema = Schemas.ColumnProgramOutputSchema.parse(
    //   runValue.program.output_value_schema,
    // );
    // const template = Schemas.ColumnProgramInputValuesTemplate.parse(
    //   runValue.cell.column.input_template,
    // );

    // Resolve template → concrete variables
    // const columnRefs = Object.values(template.variables).flatMap((v) =>
    //   v.source === "column" ? [v.column_id] : [],
    // );

    // const depCells =
    //   columnRefs.length > 0
    //     ? await supabase
    //         .from("cell")
    //         .select("column_id, value")
    //         .eq("row_id", runValue.cell.row_id)
    //         .in("column_id", columnRefs)
    //     : { data: [] };

    // const depValues = Object.fromEntries(
    //   (depCells.data ?? []).map((c) => [c.column_id, c.value]),
    // );

    // const variables = Object.fromEntries(
    //   Object.entries(template.variables).map(([key, tmpl]) => {
    //     const value =
    //       tmpl.source === "column"
    //         ? (depValues[tmpl.column_id] ?? null)
    //         : tmpl.source === "cell_value"
    //           ? (requestBody.$marble__cell_value ?? null)
    //           : tmpl.value;
    //     return [key, value];
    //   }),
    // );

    if (runValue.program.runtime !== "JavaScript") {
      return Response.json({
        error: true,
        message: "Only JavaScript is supported right now",
      });
    }

    const sandbox = getSandbox(env.Sandbox, runValue.cell.column.id);

    const codeAsBase64 = Buffer.from(runValue.program.code).toString("base64");
    const statement = `\
    node --input-type=module -e \
    "const m = await import('data:text/javascript;base64,${codeAsBase64}');\
    console.log(m.default({input: ${parsedInput}}))"
    `;

    console.log(`Running statement:\n\n${statement}`);

    const executionResult = await sandbox.exec(statement);
    // executionResult.

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

    await supabase.from("program_run").update({ output }).eq("id", runId);

    return Response.json({
      success: true,
      output,
    });
  },
};
