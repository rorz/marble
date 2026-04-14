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
  successResponse,
  updateRecord,
} from "../data";
import {
  listAccessibleCellIds,
  requireAccessibleCell,
  requireAccessibleProgramRun,
} from "./access";
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

          await requireAccessibleCell(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            cellId: body.targetCellId,
            userId: c.var.auth?.userId,
          });

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
        handler: async (c, query) => {
          let request = c.var.supabase.from("program_run").select("*");

          if (query.programVersionId) {
            request = request.eq("program_version_id", query.programVersionId);
          }

          if (query.targetCellId) {
            await requireAccessibleCell(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              cellId: query.targetCellId,
              userId: c.var.auth?.userId,
            });
            request = request.eq("target_cell_id", query.targetCellId);
          } else {
            const accessibleCellIds = await listAccessibleCellIds(
              c.var.supabase,
              {
                authenticatedProfileId: c.var.auth?.profileId,
                userId: c.var.auth?.userId,
              },
            );

            if (accessibleCellIds !== undefined) {
              if (accessibleCellIds.length === 0) {
                return [];
              }

              request = request.in("target_cell_id", accessibleCellIds);
            }
          }

          const { data, error } = await request.order("created_at", {
            ascending: false,
          });

          if (error) {
            throw new ApiError(500, error.message);
          }

          return data ?? [];
        },
        schema: programRunListSchema,
      },
      path: "/program-runs",
    },
    item: {
      delete: {
        handler: async (c, id) => {
          await requireAccessibleProgramRun(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            runId: id,
            userId: c.var.auth?.userId,
          });
          await deleteRecord(c.var.supabase, "program_run", id);

          return successResponse();
        },
      },
      get: {
        handler: (c, id) =>
          requireAccessibleProgramRun(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            runId: id,
            userId: c.var.auth?.userId,
          }),
      },
      idParam: "runId",
      patch: {
        handler: async (c, id, body) => {
          await requireAccessibleProgramRun(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            runId: id,
            userId: c.var.auth?.userId,
          });
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
            await requireAccessibleCell(c.var.supabase, {
              authenticatedProfileId: c.var.auth?.profileId,
              cellId: body.targetCellId,
              userId: c.var.auth?.userId,
            });
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
        handler: async (c) => {
          const cellId = requiredParam(c, "cellId");
          await requireAccessibleCell(c.var.supabase, {
            authenticatedProfileId: c.var.auth?.profileId,
            cellId,
            userId: c.var.auth?.userId,
          });

          const { data, error } = await c.var.supabase
            .from("program_run")
            .select("*")
            .eq("target_cell_id", cellId)
            .order("created_at", {
              ascending: false,
            });

          if (error) {
            throw new ApiError(500, error.message);
          }

          return data ?? [];
        },
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
