import type { ResourceDeps } from "../db";
import type { DbRow, Entity } from "../types";
import { toCamelKeys } from "../types";

export type Event = Entity<"event">;

type EventTargetResolution = {
  columnTableIds: Record<string, null | string>;
  rowTableIds: Record<string, null | string>;
  versionProgramIds: Record<string, null | string>;
};

function requireUserId(deps: ResourceDeps) {
  if (!deps.context.userId) {
    throw new Error("Event operations require a user session.");
  }

  return deps.context.userId;
}

function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error("Event operations require a service Supabase client.");
  }

  return deps.serviceSupabase;
}

async function listOwnedProfileIds(deps: ResourceDeps) {
  const { data, error } = await requireServiceSupabase(deps)
    .from("profile")
    .select("id")
    .eq("owner_user_id", requireUserId(deps))
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((profile) => profile.id);
}

export class EventCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly listForCurrentUser = async (
    input: { excludeSources?: Event["source"][]; limit?: number } = {},
  ) => {
    const profileIds = await listOwnedProfileIds(this.deps);

    if (profileIds.length === 0) {
      return [] as Event[];
    }

    let request = requireServiceSupabase(this.deps)
      .from("event")
      .select("*")
      .in("actor_profile_id", profileIds)
      .order("created_at", {
        ascending: false,
      })
      .limit(input.limit ?? 120);

    for (const source of input.excludeSources ?? []) {
      request = request.neq("source", source);
    }

    const { data, error } = await request;

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((event) =>
      toCamelKeys<"event">(event as DbRow<"event">),
    );
  };

  public readonly resolveTargets = async (input: {
    columnIds?: string[];
    programVersionIds?: string[];
    rowIds?: string[];
  }): Promise<EventTargetResolution> => {
    const supabase = requireServiceSupabase(this.deps);
    const rowIds = Array.from(new Set(input.rowIds ?? []));
    const columnIds = Array.from(new Set(input.columnIds ?? []));
    const programVersionIds = Array.from(
      new Set(input.programVersionIds ?? []),
    );
    const [rowsResult, columnsResult, versionsResult] = await Promise.all([
      rowIds.length === 0
        ? Promise.resolve({
            data: [],
            error: null,
          })
        : supabase.from("row").select("id, table_id").in("id", rowIds),
      columnIds.length === 0
        ? Promise.resolve({
            data: [],
            error: null,
          })
        : supabase.from("column").select("id, table_id").in("id", columnIds),
      programVersionIds.length === 0
        ? Promise.resolve({
            data: [],
            error: null,
          })
        : supabase
            .from("program_version")
            .select("id, program_id")
            .in("id", programVersionIds),
    ]);

    if (rowsResult.error || columnsResult.error || versionsResult.error) {
      throw new Error(
        rowsResult.error?.message ??
          columnsResult.error?.message ??
          versionsResult.error?.message ??
          "Could not resolve event targets.",
      );
    }

    const rows = rowsResult.data ?? [];
    const columns = columnsResult.data ?? [];
    const versions = versionsResult.data ?? [];

    return {
      columnTableIds: Object.fromEntries(
        columnIds.map((id) => [
          id,
          columns.find((column) => column.id === id)?.table_id ?? null,
        ]),
      ),
      rowTableIds: Object.fromEntries(
        rowIds.map((id) => [
          id,
          rows.find((row) => row.id === id)?.table_id ?? null,
        ]),
      ),
      versionProgramIds: Object.fromEntries(
        programVersionIds.map((id) => [
          id,
          versions.find((version) => version.id === id)?.program_id ?? null,
        ]),
      ),
    };
  };
}
