import type { ResourceDeps } from "../db";
import { requireServiceSupabase, requireUserId } from "./require-deps";

/**
 * Returns the IDs of every profile owned by the current user, ordered by
 * `created_at` ascending. Callers that need a `Set` should wrap with
 * `new Set(...)`.
 */
export const listOwnedProfileIds = async (
  deps: ResourceDeps,
  resource: string,
): Promise<string[]> => {
  const { data, error } = await requireServiceSupabase(deps, resource)
    .from("profile")
    .select("id")
    .eq("owner_user_id", requireUserId(deps, resource))
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((profile) => profile.id);
};
