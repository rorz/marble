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
    const requestBody = Schemas.ExecutorRequestBodySchema.parse(
      await request.json(),
    );

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
    const parsedInput = z
      .fromJSONSchema(inputPayloadSchema)
      .parse(JSON.parse(renderedInput));

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
    const unsafeOutput = (() => {
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
        const out = executionResult.stdout.trim();
        const outputValueSchema = JsonSchemaSchema.parse(
          runValue.program.output_value_schema,
        );
        return {
          ok: true,
          value: z.fromJSONSchema(outputValueSchema).parse(JSON.parse(out)),
        };
      } catch (e) {
        return {
          ok: false,
          error: {
            type: "Parser",
          },
          message: `Unable to parse program output with error:: ${e}`,
        };
      }
    })();

    const parsedOutput =
      Schemas.ProgramOutputValueMetaschema.parse(unsafeOutput);

    await supabase
      .from("cell")
      .update({
        value: parsedOutput,
      })
      .eq("id", runValue.target_cell_id);
    await supabase
      .from("program_run")
      .update({
        output: parsedOutput,
      })
      .eq("id", runId);

    return Response.json({
      success: true,
      output: parsedOutput,
    });
  },
};
