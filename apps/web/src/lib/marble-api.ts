import "server-only";
import app from "@marble/api";
import { env } from "@/env";
import { requireUser } from "./auth";
import { maybeResolveOwnedProfileId } from "./supabase/service-role";

type MarbleApiMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type CallMarbleApiOptions = {
  allowErrorStatus?: boolean;
  body?: unknown;
  method?: MarbleApiMethod;
  profileId?: false | string;
  requestId?: string;
  requireActorProfile?: boolean;
};

async function resolveForwardedProfileId(
  userId: string,
  options: CallMarbleApiOptions,
) {
  if (typeof options.profileId === "string") {
    return options.profileId;
  }

  const resolvedProfileId = await maybeResolveOwnedProfileId(userId);

  if (resolvedProfileId || options.requireActorProfile === false) {
    return resolvedProfileId;
  }

  throw new Error("Create a profile before performing this action.");
}

function buildRequestBody(body: unknown) {
  if (body === undefined) {
    return undefined;
  }

  return JSON.stringify(body);
}

export async function callMarbleApi<T>(
  path: string,
  options: CallMarbleApiOptions = {},
): Promise<T> {
  const user = await requireUser();
  const requestId = options.requestId ?? crypto.randomUUID();
  const profileId = await resolveForwardedProfileId(user.id, options);
  const headers = new Headers();
  const body = buildRequestBody(options.body);

  headers.set("x-marble-actor-source", "WEB_APP");
  headers.set("x-marble-auth-user-id", user.id);
  headers.set("x-marble-request-id", requestId);

  if (profileId) {
    headers.set("x-marble-auth-profile-id", profileId);
  }

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await app.fetch(
    new Request(new URL(path, "http://marble.local"), {
      body,
      headers,
      method: options.method ?? (body === undefined ? "GET" : "POST"),
    }),
    {
      MARBLE_EXECUTOR_URL: env.MARBLE_EXECUTOR_URL || env.EXECUTOR_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_URL: env.SUPABASE_URL,
    },
  );
  const text = await response.text();

  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok && !options.allowErrorStatus) {
    throw new Error(
      typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
        ? payload.error
        : text || `Request failed with status ${response.status}`,
    );
  }

  return payload as T;
}
