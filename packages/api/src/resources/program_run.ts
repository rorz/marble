import type { Json } from "@marble/supabase";
import type { Hono } from "hono";
import {
  type ApiEnv,
  ApiError,
  hasAnyDefined,
  mountResource,
  requireAnyDefined,
  requiredParam,
} from "../core";
import {
  createRecord,
  type DbUpdate,
  deleteRecord,
  deleteRecordsInColumn,
  getRecord,
  listRecordsFromQuery,
  successResponse,
  updateRecord,
} from "../data";
import { resolveProgramVersionId } from "./program_version";
import { jsonValueSchema, requestObject, uuidSchema } from "./shared";

const programRunListSchema = requestObject({
  programVersionId: uuidSchema.optional(),
  targetCellId: uuidSchema.optional(),
});

const programRunCreateSchema = requestObject({
  input: jsonValueSchema.optional(),
  output: jsonValueSchema.optional(),
  programId: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  targetCellId: uuidSchema.optional(),
});

const programRunPatchSchema = requestObject({
  input: jsonValueSchema.optional(),
  output: jsonValueSchema.optional(),
  programId: uuidSchema.optional(),
  programVersionId: uuidSchema.optional(),
  targetCellId: uuidSchema.optional(),
});

export function mountProgramRunResource(app: Hono<ApiEnv>) {
  mountResource(app, {
    collection: {
      create: {
        handler: async (c, body) => {
          if (!body.targetCellId) {
            throw new ApiError(400, "targetCellId is required");
          }

          await getRecord(c.var.supabase, "cell", body.targetCellId);

          const programVersionId = await resolveProgramVersionId(
            c.var.supabase,
            {
              programId: body.programId,
              programVersionId: body.programVersionId,
            },
          );
          const data = await createRecord(c.var.supabase, "program_run", {
            input: body.input as Json | undefined,
            output: body.output as Json | undefined,
            program_version_id: programVersionId,
            target_cell_id: body.targetCellId,
          });

          return {
            data,
            location: `/program-runs/${data.id}`,
          };
        },
        schema: programRunCreateSchema,
      },
      list: {
        handler: (c, query) =>
          listRecordsFromQuery(
            c.var.supabase,
            "program_run",
            query,
            {
              programVersionId: "program_version_id",
              targetCellId: "target_cell_id",
            },
            [
              {
                ascending: false,
                column: "created_at",
              },
            ],
          ),
        schema: programRunListSchema,
      },
      path: "/program-runs",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await getRecord(c.var.supabase, "program_run", id);
          await deleteRecord(c.var.supabase, "program_run", id);

          return successResponse();
        },
      },
      get: {
        handler: (c, id) => getRecord(c.var.supabase, "program_run", id),
      },
      idParam: "runId",
      patch: {
        handler: async (c, id, body) => {
          await getRecord(c.var.supabase, "program_run", id);
          requireAnyDefined([
            body.input,
            body.output,
            body.programId,
            body.programVersionId,
            body.targetCellId,
          ]);

          const updates: DbUpdate<"program_run"> = {};

          if (body.input !== undefined) {
            updates.input = body.input as Json;
          }

          if (body.output !== undefined) {
            updates.output = body.output as Json;
          }

          if (body.targetCellId) {
            await getRecord(c.var.supabase, "cell", body.targetCellId);
            updates.target_cell_id = body.targetCellId;
          }

          if (
            hasAnyDefined([
              body.programId,
              body.programVersionId,
            ])
          ) {
            updates.program_version_id = await resolveProgramVersionId(
              c.var.supabase,
              {
                programId: body.programId,
                programVersionId: body.programVersionId,
              },
            );
          }

          return updateRecord(c.var.supabase, "program_run", id, updates);
        },
        schema: programRunPatchSchema,
      },
      path: "/program-runs/:runId",
    },
  });

  mountResource(app, {
    collection: {
      list: {
        handler: (c) =>
          listRecordsFromQuery(
            c.var.supabase,
            "program_run",
            {
              targetCellId: requiredParam(c, "cellId"),
            },
            {
              targetCellId: "target_cell_id",
            },
            [
              {
                ascending: false,
                column: "created_at",
              },
            ],
          ),
      },
      path: "/cells/:cellId/runs",
    },
  });
}

export function deleteProgramRunsForCellIds(
  supabase: Parameters<typeof deleteRecordsInColumn>[0],
  cellIds: string[],
) {
  return deleteRecordsInColumn(
    supabase,
    "program_run",
    "target_cell_id",
    cellIds,
  );
}
