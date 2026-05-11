type RealtimePayload<Row> = {
  eventType: "DELETE" | "INSERT" | "UPDATE";
  new: Partial<Row>;
  old: Partial<Row>;
};

export function compareByCreatedAtCamelDesc<
  T extends {
    createdAt: string;
  },
>(left: T, right: T) {
  return (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export function compareByUpdatedAtCamelDesc<
  T extends {
    updatedAt: string;
  },
>(left: T, right: T) {
  return (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function sortRows<T>(rows: T[], compare: (left: T, right: T) => number) {
  return [
    ...rows,
  ].sort(compare);
}

export function upsertRow<
  T extends {
    id: string;
  },
>(rows: T[], row: T, compare?: (left: T, right: T) => number) {
  const next = [
    row,
    ...rows.filter((candidate) => candidate.id !== row.id),
  ];

  return compare ? next.sort(compare) : next;
}

export function removeRow<
  T extends {
    id: string;
  },
>(rows: T[], id: string) {
  return rows.filter((row) => row.id !== id);
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

export function isOptimisticId(id: string) {
  return id.startsWith("temp:");
}

export function makeOptimisticId() {
  return `temp:${crypto.randomUUID()}`;
}
