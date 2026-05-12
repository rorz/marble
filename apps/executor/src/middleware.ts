import { getApiKeyTokenFromHeaders } from "@marble/keys";
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

export const authMiddleware = createMiddleware<ExecutorEnv>(async (c, next) => {
  const forwardedKeyId = c.req.header("x-marble-auth-key-id")?.trim();
  const forwardedProfileId = c.req.header("x-marble-auth-profile-id")?.trim();
  const forwardedUserId = c.req.header("x-marble-auth-user-id")?.trim();

  if (forwardedKeyId || forwardedProfileId || forwardedUserId) {
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
