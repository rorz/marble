type BroadcastEvent = "DELETE" | "INSERT" | "UPDATE";

export type DeleteMutation<Type extends string, Row> = {
  event?: BroadcastEvent;
  id: string;
  row?: Row;
  type: Type;
};

export type UpsertMutation<Type extends string, Row> = {
  event?: BroadcastEvent;
  row: Row;
  type: Type;
};

type BroadcastMutation =
  | DeleteMutation<string, unknown>
  | UpsertMutation<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBroadcastMutation<Type extends string>(
  value: unknown,
  mutationTypes: Record<Type, true>,
) {
  if (
    !isRecord(value) ||
    typeof value.type !== "string" ||
    !(value.type in mutationTypes)
  ) {
    return false;
  }

  return value.type.endsWith(":delete")
    ? typeof value.id === "string"
    : isRecord(value.row);
}

export function createBroadcastMutationGuard<
  Mutation extends BroadcastMutation,
>(mutationTypes: Record<Mutation["type"], true>) {
  return (value: unknown): value is Mutation =>
    isBroadcastMutation(value, mutationTypes);
}
