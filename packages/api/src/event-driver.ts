import type { Json, SupabaseClient } from "@marble/supabase";
import { ApiError } from "./core";

const EVENT_CONTEXT_KEY = Symbol.for("marble.api.event-context");
export type EventSource = "CLI" | "RAW_API" | "WEB_APP";

export type EventContext = {
  actorKeyId?: string;
  actorProfileId?: string;
  requestId: string;
  source: EventSource;
  userId?: string;
};

type EventfulSupabaseClient = SupabaseClient & {
  [EVENT_CONTEXT_KEY]?: EventContext;
};

type EventOperation = "Create" | "Delete" | "Update";

type EventDiffEntry = {
  after: Json | null;
  before: Json | null;
  path: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonValue(value: unknown): Json | null {
  if (value === undefined) {
    return null;
  }

  return value as Json;
}

function valuesMatch(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildDiffEntries(
  before: unknown,
  after: unknown,
  path: string[] = [],
): EventDiffEntry[] {
  if (valuesMatch(before, after)) {
    return [];
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    return Array.from(
      new Set([
        ...Object.keys(before),
        ...Object.keys(after),
      ]),
    )
      .sort()
      .flatMap((key) =>
        buildDiffEntries(before[key], after[key], [
          ...path,
          key,
        ]),
      );
  }

  return [
    {
      after: asJsonValue(after),
      before: asJsonValue(before),
      path,
    },
  ];
}

function normalizeEventRow(
  resource: string,
  row: Record<string, unknown> | null,
): Json | null {
  if (!row) {
    return null;
  }

  const normalized = Object.fromEntries(
    Object.entries(row).filter(
      ([key]) =>
        ![
          "created_at",
          "updated_at",
        ].includes(key),
    ),
  );

  if (resource === "key") {
    delete normalized.hash;
  }

  return normalized as Json;
}

function getEventContext(supabase: SupabaseClient) {
  return (supabase as EventfulSupabaseClient)[EVENT_CONTEXT_KEY];
}

export function attachEventContext(
  supabase: SupabaseClient,
  context: EventContext,
) {
  (supabase as EventfulSupabaseClient)[EVENT_CONTEXT_KEY] = context;
  return supabase;
}

export async function writeEventRecord(
  supabase: SupabaseClient,
  input: {
    after: Record<string, unknown> | null;
    before: Record<string, unknown> | null;
    operation: EventOperation;
    resource: string;
  },
) {
  if (input.resource === "event") {
    return;
  }

  const context = getEventContext(supabase);
  if (!context?.actorProfileId) {
    return;
  }

  const beforeState = normalizeEventRow(input.resource, input.before);
  const afterState = normalizeEventRow(input.resource, input.after);
  const diff = buildDiffEntries(beforeState, afterState);

  if (input.operation === "Update" && diff.length === 0) {
    return;
  }

  const entityId = String((input.after ?? input.before)?.id ?? "").trim();

  if (!entityId) {
    return;
  }

  const { error } = await supabase.from("event").insert({
    actor_key_id: context.actorKeyId,
    actor_profile_id: context.actorProfileId,
    after_state: afterState,
    before_state: beforeState,
    diff: diff as Json,
    entity_id: entityId,
    operation: input.operation,
    request_id: context.requestId,
    resource: input.resource,
    source: context.source,
  });

  if (error) {
    throw new ApiError(500, error.message);
  }
}
