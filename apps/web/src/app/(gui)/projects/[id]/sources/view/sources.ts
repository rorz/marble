import type { Source } from "./types";

export const sortByCreatedAtDesc = <
  T extends {
    createdAt: string;
  },
>(
  records: T[],
) => {
  return [
    ...records,
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
};

export const sortByUpdatedAtDesc = <
  T extends {
    updatedAt: string;
  },
>(
  records: T[],
) => {
  return [
    ...records,
  ].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
};

export const webhookEndpoint = (
  baseUrl: string,
  source: Pick<Source, "id">,
) => {
  return `${baseUrl}/webhooks/${source.id}`;
};

export const sourceTitle = (source: null | Pick<Source, "name">) => {
  return source?.name || "Untitled Source";
};
