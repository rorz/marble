import { getApiKeyTokenFromHeaders } from "@marble/keys";
import { sha256Base64Url } from "@marble/lib/crypto";
import { MarbleStore } from "@marble/store";
import { createClient } from "@marble/supabase";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { RequestIdVariables } from "hono/request-id";
import { validator } from "hono/validator";
import type { z } from "zod";
import { formatZodIssues } from "./runner/index.js";
import { BODY_LIMIT_BYTES, ErrorResponseSchema } from "./schemas.js";

export type ExecutorEnv = {
  Bindings: Env;
  Variables: RequestIdVariables & {
    auth:
      | {
          keyId?: string;
          profileId?: string;
          type: "api-key" | "forwarded";
          userId?: string;
        }
      | undefined;
    store: MarbleStore;
  };
};

export const jsonResponse = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  data: z.input<Schema>,
  init?: ResponseInit,
) => Response.json(schema.parse(data), init);

export const httpError = (
  status: 400 | 401 | 404 | 500,
  message: string,
  cause?: unknown,
) =>
  new HTTPException(status, {
    message,
    ...(cause === undefined
      ? {}
      : {
          cause,
        }),
  });

/**
 * Timing-safe comparison for secret values. The caller-supplied value is always
 * hashed to a fixed-length SHA-256 digest before `crypto.subtle.timingSafeEqual`,
 * so the comparison never short-circuits on the presented value's length or
 * content. We only return early when no `expected` secret is configured — that
 * is a server-side config state, not attacker-controlled input.
 */
const timingSafeEqualStrings = async (
  presented: string | undefined,
  expected: string | undefined,
): Promise<boolean> => {
  if (expected === undefined) {
    return false;
  }

  try {
    const [hashA, hashB] = await Promise.all([
      sha256Base64Url(presented ?? ""),
      sha256Base64Url(expected),
    ]);
    const encoder = new TextEncoder();

    return crypto.subtle.timingSafeEqual(
      encoder.encode(hashA),
      encoder.encode(hashB),
    );
    // harness-ignore: no-swallowed-errors -- any crypto failure is treated as a non-match
  } catch {
    return false;
  }
};

export const zodValidator = <
  Target extends "header" | "json" | "param" | "query",
  Schema extends z.ZodTypeAny,
>(
  target: Target,
  schema: Schema,
) =>
  validator(target, (value) => {
    const parsed = schema.safeParse(value);

    if (!parsed.success) {
      throw httpError(
        400,
        formatZodIssues(parsed.error.issues),
        parsed.error.issues,
      );
    }

    return parsed.data;
  });

export const envMiddleware = createMiddleware<ExecutorEnv>(async (c, next) => {
  try {
    c.set(
      "store",
      (() => {
        const supabase = createClient(
          c.env.SUPABASE_URL,
          c.env.SUPABASE_SERVICE_ROLE_KEY,
        );

        return new MarbleStore({
          context: {
            eventSource: "RAW_API",
          },
          serviceSupabase: supabase,
          supabase,
        });
      })(),
    );
  } catch (error) {
    throw httpError(500, "INTERNAL ERROR: Database misconfigured!", error);
  }

  await next();
});

let warnedMissingInternalSecret = false;

export const authMiddleware = createMiddleware<ExecutorEnv>(async (c, next) => {
  const internalSecret = c.env.MARBLE_INTERNAL_SECRET;

  if (!internalSecret && !warnedMissingInternalSecret) {
    warnedMissingInternalSecret = true;
    console.warn(
      "MARBLE_INTERNAL_SECRET is not set; forwarded auth headers will be ignored.",
    );
  }

  const forwardedKeyId = c.req.header("x-marble-auth-key-id")?.trim();
  const forwardedProfileId = c.req.header("x-marble-auth-profile-id")?.trim();
  const forwardedUserId = c.req.header("x-marble-auth-user-id")?.trim();
  const forwardedSecret = c.req.header("x-marble-internal-secret")?.trim();

  // Forwarded auth is only trusted when the caller proves it is our own API by
  // presenting the internal secret. Without a configured + matching secret we
  // fall through to API-key auth (fail closed — never trust the headers alone).
  if (
    internalSecret &&
    (forwardedKeyId || forwardedProfileId || forwardedUserId) &&
    (await timingSafeEqualStrings(forwardedSecret, internalSecret))
  ) {
    c.set("auth", {
      ...(forwardedKeyId
        ? {
            keyId: forwardedKeyId,
          }
        : {}),
      ...(forwardedProfileId
        ? {
            profileId: forwardedProfileId,
          }
        : {}),
      type: "forwarded",
      ...(forwardedUserId
        ? {
            userId: forwardedUserId,
          }
        : {}),
    });
    await next();
    return;
  }

  const presentedToken = getApiKeyTokenFromHeaders(c.req.raw.headers);

  if (!presentedToken) {
    await next();
    return;
  }

  const keyAuth = await c.var.store.keys.authenticateToken(presentedToken);
  if (!keyAuth) {
    throw httpError(401, "Incorrect credentials");
  }

  c.set("auth", {
    keyId: keyAuth.keyId,
    profileId: keyAuth.profileId,
    type: "api-key",
    ...(keyAuth.userId
      ? {
          userId: keyAuth.userId,
        }
      : {}),
  });
  await next();
});

export const requestBodyLimit = bodyLimit({
  maxSize: BODY_LIMIT_BYTES,
  onError: (c) =>
    jsonResponse(
      ErrorResponseSchema,
      {
        error: true,
        message: "Request body is too large.",
        requestId: c.get("requestId"),
      },
      {
        status: 413,
      },
    ),
});
