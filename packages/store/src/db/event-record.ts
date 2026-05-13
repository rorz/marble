import type { Json, SupabaseClient } from "@marble/supabase";
import type { ResourceContext } from "../types";

type EventOperation = "Create" | "Delete" | "Update";

type EventDiffEntry = {
  after: Json | null;
  before: Json | null;
  path: string[];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const asJsonValue = (value: unknown): Json | null => {
  if (value === undefined) {
    return null;
  }

  return value as Json;
};

const valuesMatch = (left: unknown, right: unknown) => {
  return JSON.stringify(left) === JSON.stringify(right);
};

const buildDiffEntries = (
  before: unknown,
  after: unknown,
  path: string[] = [],
): EventDiffEntry[] => {
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
};

const normalizeEventRow = (
  resource: string,
  row: Record<string, unknown> | null,
): Json | null => {
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

  if (resource === "secret") {
    delete normalized.value;
    delete normalized.vault_secret_id;
  }

  if (resource === "source") {
    delete normalized.webhook_token;
  }

  return normalized as Json;
};

export const writeEventRecord = async (
  serviceSupabase: SupabaseClient | undefined,
  context: ResourceContext,
  input: {
    after: Record<string, unknown> | null;
    before: Record<string, unknown> | null;
    operation: EventOperation;
    resource: string;
  },
) => {
  if (!serviceSupabase || input.resource === "event") {
    return;
  }

  const actorProfileId = context.profileId;

  if (!actorProfileId) {
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

  const { error } = await serviceSupabase.from("event").insert({
    actor_key_id: context.actorKeyId,
    actor_profile_id: actorProfileId,
    after_state: afterState,
    before_state: beforeState,
    diff: diff as Json,
    entity_id: entityId,
    operation: input.operation,
    request_id: context.requestId,
    resource: input.resource,
    source: context.eventSource ?? "RAW_API",
  });

  if (error) {
    throw new Error(error.message);
  }
};
