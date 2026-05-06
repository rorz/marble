import "server-only";

import { MarbleClient } from "@marble/sdk";
import { requireUser } from "./auth";
import { createClient } from "./supabase/server";
import { createServiceRoleClient } from "./supabase/service-role";

const PROFILELESS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

export async function createServerMarbleSdk(
  options: { profileId?: string } = {},
) {
  const [supabase, user] = await Promise.all([
    createClient(),
    requireUser(),
  ]);

  return new MarbleClient({
    driver: {
      client: supabase,
      profileId: options.profileId ?? PROFILELESS_PROFILE_ID,
      serviceClient: createServiceRoleClient(),
      type: "supabase",
      userId: user.id,
    },
  });
}

async function listCurrentUserProfileIds() {
  const sdk = await createServerMarbleSdk({
    profileId: PROFILELESS_PROFILE_ID,
  });

  return (await sdk.profiles.list({})).map((profile) => profile.id);
}

export async function createServerMarbleSdkForProject(projectId: string) {
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
}

export async function createServerMarbleSdkForTable(tableId: string) {
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
}
