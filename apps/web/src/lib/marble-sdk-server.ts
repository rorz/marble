import "server-only";

import { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import { requireUser } from "./auth";
import { createClient } from "./supabase/server";
import {
  createServiceRoleClient,
  maybeResolveOwnedProfileId,
} from "./supabase/service-role";

const PROFILELESS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

export const createServerMarbleSdk = async (
  options: { profileId?: string } = {},
) => {
  const [supabase, user] = await Promise.all([
    createClient(),
    requireUser(),
  ]);
  const profileId =
    options.profileId ?? (await maybeResolveOwnedProfileId(user.id));

  if (!profileId) {
    throw new Error("Could not find a human profile for the current user.");
  }

  return createSupabaseClientRouterClient({
    profileId,
    serviceSupabase: createServiceRoleClient(),
    supabase,
    userId: user.id,
  });
};

const listCurrentUserProfileIds = async () => {
  const sdk = await createServerMarbleSdk({
    profileId: PROFILELESS_PROFILE_ID,
  });

  return (await sdk.profiles.list({})).map((profile) => profile.id);
};

export const createServerMarbleSdkForProject = async (projectId: string) => {
  const profileIds = await listCurrentUserProfileIds();

  for (const profileId of profileIds) {
    const sdk = await createServerMarbleSdk({
      profileId,
    });

    try {
      const project = await sdk.projects.get({
        projectId,
      });

      return {
        project,
        sdk,
      };
    } catch {
      // Try the next owned profile; project access is profile-scoped in the SDK.
    }
  }

  return null;
};

export const createServerMarbleSdkForTable = async (tableId: string) => {
  const profileIds = await listCurrentUserProfileIds();

  for (const profileId of profileIds) {
    const sdk = await createServerMarbleSdk({
      profileId,
    });

    try {
      const table = await sdk.tables.get({
        id: tableId,
      });
      const project = await sdk.projects.get({
        projectId: table.projectId,
      });

      return {
        project,
        sdk,
        table,
      };
    } catch {
      // Try the next owned profile; table access is profile-scoped in the SDK.
    }
  }

  return null;
};
