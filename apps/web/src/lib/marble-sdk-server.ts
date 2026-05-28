import "server-only";

import { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import { trimTrailingSlash } from "@marble/lib/string";
import { requireUser } from "./auth";
import { getMarbleApiConfig } from "./server-config";
import { createClient } from "./supabase/server";
import {
  createServiceRoleClient,
  maybeResolveOwnedProfileId,
} from "./supabase/service-role";

const PROFILELESS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

type ServerExecutorActions = NonNullable<
  Parameters<typeof createSupabaseClientRouterClient>[0]["actions"]
>;

type ExecutorActionInput = {
  body: unknown;
  path: string;
  profileId: string;
  search: URLSearchParams;
  userId: string;
};

const executorEndpointUrl = (baseUrl: string, input: ExecutorActionInput) => {
  const endpoint = new URL(baseUrl);
  endpoint.pathname = `${trimTrailingSlash(endpoint.pathname)}${input.path}`;
  endpoint.search = input.search.toString();
  return endpoint;
};

const readExecutorActionResponse = async (response: Response) => {
  const text = await response.text();

  try {
    return {
      payload: JSON.parse(text) as Record<string, unknown>,
      status: response.status,
    };
  } catch (error) {
    void error;
    return {
      payload: {
        error: true,
        message: text || "Executor returned a non-JSON response.",
        output: null,
        success: false,
      },
      status: response.status,
    };
  }
};

const callExecutor = async (input: ExecutorActionInput) => {
  const executor = getMarbleApiConfig().executor;

  if (!executor) {
    throw new Error("Executor runtime is not configured.");
  }

  const response = await fetch(executorEndpointUrl(executor.url, input), {
    body: JSON.stringify(input.body),
    headers: {
      "Content-Type": "application/json",
      "x-marble-actor-source": "web-app",
      "x-marble-auth-profile-id": input.profileId,
      "x-marble-auth-user-id": input.userId,
    },
    method: "POST",
  });

  return readExecutorActionResponse(response);
};

const createServerExecutorActions = (input: {
  profileId: string;
  userId: string;
}): ServerExecutorActions => {
  return {
    executeProgramRun: ({ runId }) =>
      callExecutor({
        body: {},
        path: "/run",
        profileId: input.profileId,
        search: new URLSearchParams({
          run_id: runId,
        }),
        userId: input.userId,
      }),
    executeProgramVersionTest: ({ body, programVersionId }) =>
      callExecutor({
        body,
        path: "/test",
        profileId: input.profileId,
        search: new URLSearchParams({
          programVersionId,
        }),
        userId: input.userId,
      }),
  };
};

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
    actions: createServerExecutorActions({
      profileId,
      userId: user.id,
    }),
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
    } catch (error) {
      void error;
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
    } catch (error) {
      void error;
      // Try the next owned profile; table access is profile-scoped in the SDK.
    }
  }

  return null;
};
