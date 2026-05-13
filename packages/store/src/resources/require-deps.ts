import type { SupabaseClient } from "@marble/supabase";
import type { ResourceDeps } from "../db";

/**
 * Returns `deps.serviceSupabase` or throws with a normalized error message.
 * `resource` is the human-readable subject (e.g. "Cell", "Program version") —
 * the message is rendered as `${resource} operations require a service Supabase client.`
 */
export function requireServiceSupabase(
  deps: ResourceDeps,
  resource: string,
): SupabaseClient {
  if (!deps.serviceSupabase) {
    throw new Error(
      `${resource} operations require a service Supabase client.`,
    );
  }

  return deps.serviceSupabase;
}

/**
 * Returns `deps.context.userId` or throws with a normalized error message.
 * `resource` is the human-readable subject (see `requireServiceSupabase`).
 */
export function requireUserId(deps: ResourceDeps, resource: string): string {
  if (!deps.context.userId) {
    throw new Error(`${resource} operations require a user session.`);
  }

  return deps.context.userId;
}
