import type { Database } from "@marble/supabase";

export const PROFILE_RECORD_SELECT =
  "created_at, external_name, id, name, owner_user_id, type, updated_at";

export type ProfileRecord = Pick<
  Database["public"]["Tables"]["profile"]["Row"],
  | "created_at"
  | "external_name"
  | "id"
  | "name"
  | "owner_user_id"
  | "type"
  | "updated_at"
>;
