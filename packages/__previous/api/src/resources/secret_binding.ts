import { ENVIRONMENT_VARIABLE_NAME_PATTERN } from "@marble/old-core";
import type { Tables } from "@marble/supabase";
import type { Hono } from "hono";
import { z } from "zod";
import {
  type ApiContext,
  type ApiEnv,
  ApiError,
  parseJsonBody,
  requiredParam,
  route,
} from "../core";
import { getRecord, listRecordsInColumn } from "../data";
import { requireAccessibleColumn } from "./access";
import { requireOwnedProfileForUser } from "./profile";
import { requestObject, uuidSchema } from "./shared";

const envNameSchema = z
  .string()
  .trim()
  .refine(
    (value) => ENVIRONMENT_VARIABLE_NAME_PATTERN.test(value),
    "Environment variable names must be valid shell identifiers.",
  );

const secretBindingEntrySchema = requestObject({
  envName: envNameSchema,
  secretId: uuidSchema,
});

const secretBindingsBodySchema = requestObject({
  bindings: z.array(secretBindingEntrySchema).superRefine((bindings, ctx) => {
    const seenEnvNames = new Set<string>();

    for (const [index, binding] of bindings.entries()) {
      if (!seenEnvNames.has(binding.envName)) {
        seenEnvNames.add(binding.envName);
        continue;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate secret binding for '${binding.envName}'.`,
        path: [
          index,
          "envName",
        ],
      });
    }
  }),
});

type SecretBindingEntry = z.infer<typeof secretBindingEntrySchema>;
type ProgramSecretBindingRow = Tables<"program_secret_binding">;
type ColumnSecretBindingRow = Tables<"column_secret_binding">;

function serializeBindings<
  Row extends {
    env_name: string;
    secret_id: string;
  },
>(bindings: Row[]) {
  return bindings
    .map((binding) => ({
      envName: binding.env_name,
      secretId: binding.secret_id,
    }))
    .sort((left, right) => left.envName.localeCompare(right.envName));
}

async function resolveAuthenticatedOwnerUserId(c: ApiContext) {
  if (c.var.auth?.userId) {
    return c.var.auth.userId;
  }

  if (c.var.auth?.profileId) {
    const profile = await getRecord(
      c.var.supabase,
      "profile",
      c.var.auth.profileId,
    );
    return profile.owner_user_id;
  }

  throw new ApiError(401, "Unauthorized");
}

async function requireConfigurableProgram(c: ApiContext, programId: string) {
  const program = await getRecord(c.var.supabase, "program", programId);

  if (program.first_party) {
    return program;
  }

  if (c.var.auth?.userId) {
    await requireOwnedProfileForUser(c.var.supabase, {
      profileId: program.owner_profile_id,
      userId: c.var.auth.userId,
    });
    return program;
  }

  if (c.var.auth?.profileId === program.owner_profile_id) {
    return program;
  }

  throw new ApiError(404, "Program not found");
}

async function validateSecretBindings(
  c: ApiContext,
  ownerUserId: string,
  bindings: SecretBindingEntry[],
) {
  const secretIds = Array.from(
    new Set(bindings.map((binding) => binding.secretId)),
  );

  if (secretIds.length === 0) {
    return;
  }

  const secrets = await listRecordsInColumn(
    c.var.supabase,
    "secret",
    "id",
    secretIds,
  );

  if (
    secrets.length !== secretIds.length ||
    secrets.some((secret) => secret.owner_user_id !== ownerUserId)
  ) {
    throw new ApiError(404, "Secret not found");
  }
}

async function listProgramSecretBindings(
  c: ApiContext,
  ownerUserId: string,
  programId: string,
) {
  const { data, error } = await c.var.supabase
    .from("program_secret_binding")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("program_id", programId)
    .order("env_name", {
      ascending: true,
    });

  if (error) {
    throw new ApiError(500, error.message);
  }

  return serializeBindings((data ?? []) as ProgramSecretBindingRow[]);
}

async function replaceProgramSecretBindings(
  c: ApiContext,
  ownerUserId: string,
  programId: string,
  bindings: SecretBindingEntry[],
) {
  await validateSecretBindings(c, ownerUserId, bindings);

  const { error: deleteError } = await c.var.supabase
    .from("program_secret_binding")
    .delete()
    .eq("owner_user_id", ownerUserId)
    .eq("program_id", programId);

  if (deleteError) {
    throw new ApiError(500, deleteError.message);
  }

  if (bindings.length === 0) {
    return [] as ReturnType<typeof serializeBindings<ProgramSecretBindingRow>>;
  }

  const { data, error } = await c.var.supabase
    .from("program_secret_binding")
    .insert(
      bindings.map((binding) => ({
        env_name: binding.envName,
        owner_user_id: ownerUserId,
        program_id: programId,
        secret_id: binding.secretId,
      })),
    )
    .select("*");

  if (error) {
    throw new ApiError(500, error.message);
  }

  return serializeBindings((data ?? []) as ProgramSecretBindingRow[]);
}

async function listColumnSecretBindings(c: ApiContext, columnId: string) {
  const { data, error } = await c.var.supabase
    .from("column_secret_binding")
    .select("*")
    .eq("column_id", columnId)
    .order("env_name", {
      ascending: true,
    });

  if (error) {
    throw new ApiError(500, error.message);
  }

  return serializeBindings((data ?? []) as ColumnSecretBindingRow[]);
}

async function replaceColumnSecretBindings(
  c: ApiContext,
  ownerUserId: string,
  columnId: string,
  bindings: SecretBindingEntry[],
) {
  await validateSecretBindings(c, ownerUserId, bindings);

  const { error: deleteError } = await c.var.supabase
    .from("column_secret_binding")
    .delete()
    .eq("column_id", columnId);

  if (deleteError) {
    throw new ApiError(500, deleteError.message);
  }

  if (bindings.length === 0) {
    return [] as ReturnType<typeof serializeBindings<ColumnSecretBindingRow>>;
  }

  const { data, error } = await c.var.supabase
    .from("column_secret_binding")
    .insert(
      bindings.map((binding) => ({
        column_id: columnId,
        env_name: binding.envName,
        secret_id: binding.secretId,
      })),
    )
    .select("*");

  if (error) {
    throw new ApiError(500, error.message);
  }

  return serializeBindings((data ?? []) as ColumnSecretBindingRow[]);
}

export function mountSecretBindingRoutes(app: Hono<ApiEnv>) {
  app.get(
    "/programs/:programId/secrets",
    route(async (c) => {
      const programId = requiredParam(c, "programId");
      const ownerUserId = await resolveAuthenticatedOwnerUserId(c);

      await requireConfigurableProgram(c, programId);

      return c.json(await listProgramSecretBindings(c, ownerUserId, programId));
    }),
  );

  app.put(
    "/programs/:programId/secrets",
    route(async (c) => {
      const programId = requiredParam(c, "programId");
      const ownerUserId = await resolveAuthenticatedOwnerUserId(c);
      const body = await parseJsonBody(c, secretBindingsBodySchema);

      await requireConfigurableProgram(c, programId);

      return c.json(
        await replaceProgramSecretBindings(
          c,
          ownerUserId,
          programId,
          body.bindings,
        ),
      );
    }),
  );

  app.get(
    "/columns/:columnId/secrets",
    route(async (c) => {
      const columnId = requiredParam(c, "columnId");

      await requireAccessibleColumn(c.var.supabase, {
        authenticatedProfileId: c.var.auth?.profileId,
        columnId,
        userId: c.var.auth?.userId,
      });

      return c.json(await listColumnSecretBindings(c, columnId));
    }),
  );

  app.put(
    "/columns/:columnId/secrets",
    route(async (c) => {
      const columnId = requiredParam(c, "columnId");
      const ownerUserId = await resolveAuthenticatedOwnerUserId(c);
      const body = await parseJsonBody(c, secretBindingsBodySchema);

      await requireAccessibleColumn(c.var.supabase, {
        authenticatedProfileId: c.var.auth?.profileId,
        columnId,
        userId: c.var.auth?.userId,
      });

      return c.json(
        await replaceColumnSecretBindings(
          c,
          ownerUserId,
          columnId,
          body.bindings,
        ),
      );
    }),
  );
}
