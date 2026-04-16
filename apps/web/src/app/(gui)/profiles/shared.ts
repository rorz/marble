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

export type ProfileKeyRecord = Pick<
  Database["public"]["Tables"]["key"]["Row"],
  "created_at" | "deleted_at" | "id" | "owner_profile_id" | "prefix"
> & {
  preview: string;
};

export type ManagedProfileRecord = ProfileRecord & {
  keys: ProfileKeyRecord[];
};
