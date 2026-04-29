import type { Database } from "./types";

export type TableName = keyof Database["public"]["Tables"];
