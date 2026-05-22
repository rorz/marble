import type { BroadcastTagPayload, PostgresTagPayload } from "./types";

export const nowMs = () => {
  return performance.now();
};

export const formatMs = (value: number) => {
  return `${Math.round(value)}ms`;
};

export const tagTopic = (id: string) => {
  return `testing:tags:${id}`;
};

export const getPostgresTag = (payload: PostgresTagPayload) => {
  if (payload.eventType === "DELETE") {
    return payload.old;
  }

  return payload.new;
};

export const getBroadcastTag = (payload: BroadcastTagPayload) => {
  if (payload.payload.operation === "DELETE") {
    return payload.payload.old_record;
  }

  return payload.payload.record;
};
