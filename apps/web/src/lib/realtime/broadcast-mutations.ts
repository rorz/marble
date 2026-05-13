import { isPlainRecord } from "@marble/lib/object";

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

const isBroadcastMutation = <Type extends string>(
  value: unknown,
  mutationTypes: Record<Type, true>,
) => {
  if (
    !isPlainRecord(value) ||
    typeof value.type !== "string" ||
    !(value.type in mutationTypes)
  ) {
    return false;
  }

  return value.type.endsWith(":delete")
    ? typeof value.id === "string"
    : isPlainRecord(value.row);
};

export const createBroadcastMutationGuard = <
  Mutation extends BroadcastMutation,
>(
  mutationTypes: Record<Mutation["type"], true>,
) => {
  return (value: unknown): value is Mutation =>
    isBroadcastMutation(value, mutationTypes);
};
