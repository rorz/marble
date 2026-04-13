import type { SupabaseClient } from "@marble/supabase";
import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

export type ApiEnv = {
  Bindings: {
    MARBLE_EXECUTOR_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    SUPABASE_URL: string;
  };
  Variables: {
    auth:
      | {
          keyId?: string;
          profileId?: string;
          userId?: string;
          type: "api-key" | "forwarded";
        }
      | undefined;
    supabase: SupabaseClient;
  };
};

export type ApiContext = Context<ApiEnv>;

export class ApiError extends Error {
  details?: unknown;
  status: ContentfulStatusCode;

  constructor(
    status: ContentfulStatusCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.details = details;
    this.status = status;
  }
}

export type MutationResult = {
  data: unknown;
  location?: string;
  status?: ContentfulStatusCode;
};

type CollectionSpec<
  QuerySchema extends z.ZodTypeAny | undefined = undefined,
  CreateSchema extends z.ZodTypeAny | undefined = undefined,
> = {
  create?: CreateSchema extends z.ZodTypeAny
    ? {
        handler: (
          c: ApiContext,
          body: z.infer<CreateSchema>,
        ) => Promise<MutationResult>;
        schema: CreateSchema;
      }
    : undefined;
  list?: QuerySchema extends z.ZodTypeAny
    ? {
        handler: (
          c: ApiContext,
          query: z.infer<QuerySchema>,
        ) => Promise<unknown>;
        schema: QuerySchema;
      }
    : {
        handler: (c: ApiContext) => Promise<unknown>;
      };
  path: string;
};

type ItemSpec<UpdateSchema extends z.ZodTypeAny | undefined = undefined> = {
  delete?: {
    handler: (c: ApiContext, id: string) => Promise<unknown>;
  };
  get?: {
    handler: (c: ApiContext, id: string) => Promise<unknown>;
  };
  idParam: string;
  patch?: UpdateSchema extends z.ZodTypeAny
    ? {
        handler: (
          c: ApiContext,
          id: string,
          body: z.infer<UpdateSchema>,
        ) => Promise<unknown>;
        schema: UpdateSchema;
      }
    : undefined;
  path: string;
};

export type ResourceSpec<
  QuerySchema extends z.ZodTypeAny | undefined = undefined,
  CreateSchema extends z.ZodTypeAny | undefined = undefined,
  UpdateSchema extends z.ZodTypeAny | undefined = undefined,
> = {
  collection?: CollectionSpec<QuerySchema, CreateSchema>;
  item?: ItemSpec<UpdateSchema>;
};

function toCamelCase(key: string) {
  return key.replace(/[_-]([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

export function normalizeObjectKeys<T extends Record<string, unknown>>(
  value: T,
) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      toCamelCase(key),
      entry,
    ]),
  ) as T;
}

export function route(
  handler: (c: ApiContext) => Promise<Response>,
): (c: ApiContext) => Promise<Response> {
  return async (c) => {
    try {
      return await handler(c);
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(
              500,
              error instanceof Error ? error.message : String(error),
            );

      return Response.json(
        {
          error: apiError.message,
          ...(apiError.details === undefined
            ? {}
            : {
                details: apiError.details,
              }),
        },
        {
          status: apiError.status,
        },
      );
    }
  };
}

export function created(
  c: ApiContext,
  result: MutationResult,
  fallbackLocation: string,
) {
  c.header("Location", result.location ?? fallbackLocation);
  return c.json(result.data, {
    status: result.status ?? 201,
  });
}

export async function readJsonBody(c: ApiContext): Promise<unknown> {
  const text = await c.req.text();
  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "Request body must be valid JSON");
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

export async function parseJsonBody<T extends z.ZodTypeAny>(
  c: ApiContext,
  schema: T,
): Promise<z.infer<T>> {
  const body = asRecord(await readJsonBody(c));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw zodError(parsed.error);
  }

  return parsed.data;
}

export function parseQuery<T extends z.ZodTypeAny>(
  c: ApiContext,
  schema: T,
): z.infer<T> {
  const parsed = schema.safeParse(normalizeObjectKeys(c.req.query()));

  if (!parsed.success) {
    throw zodError(parsed.error);
  }

  return parsed.data;
}

export function requiredParam(c: ApiContext, key: string) {
  const value = c.req.param(key);

  if (value === undefined) {
    throw new ApiError(400, `Missing path parameter '${key}'`);
  }

  return value;
}

export function requiredValue(value: string | undefined, key: string) {
  if (value === undefined) {
    throw new ApiError(400, `Missing value '${key}'`);
  }

  return value;
}

export function hasAnyDefined(values: unknown[]) {
  return values.some((value) => value !== undefined);
}

export function requireAnyDefined(
  values: unknown[],
  message = "Request body must include at least one updatable field",
) {
  if (!hasAnyDefined(values)) {
    throw new ApiError(400, message);
  }
}

export async function requireById<T>(
  query: PromiseLike<{
    data: T | null;
    error: {
      message: string;
    } | null;
  }>,
  resourceName: string,
  id: string,
): Promise<T> {
  const { data, error } = await query;

  if (error) {
    throw new ApiError(500, error.message);
  }

  if (!data) {
    throw new ApiError(404, `${resourceName} '${id}' was not found`);
  }

  return data;
}

export function zodError(error: z.ZodError) {
  return new ApiError(
    400,
    "Invalid request",
    error.issues.map((issue) => ({
      message: issue.message,
      path: issue.path.join("."),
    })),
  );
}

export function mountResource<
  QuerySchema extends z.ZodTypeAny | undefined = undefined,
  CreateSchema extends z.ZodTypeAny | undefined = undefined,
  UpdateSchema extends z.ZodTypeAny | undefined = undefined,
>(
  app: Hono<ApiEnv>,
  spec: ResourceSpec<QuerySchema, CreateSchema, UpdateSchema>,
) {
  const collection = spec.collection;
  const item = spec.item;

  if (collection?.list) {
    const { list, path } = collection;

    app.get(
      path,
      route(async (c) => {
        if ("schema" in list) {
          const query = parseQuery(c, list.schema);
          return c.json(await list.handler(c, query));
        }

        return c.json(await list.handler(c));
      }),
    );
  }

  if (collection?.create) {
    const { create, path } = collection;

    app.post(
      path,
      route(async (c) => {
        const body = await parseJsonBody(c, create.schema);
        const result = await create.handler(c, body);
        return created(c, result, path);
      }),
    );
  }

  if (item?.get) {
    const { get, idParam, path } = item;

    app.get(
      path,
      route(async (c) =>
        c.json(await get.handler(c, requiredParam(c, idParam))),
      ),
    );
  }

  if (item?.patch) {
    const { idParam, patch, path } = item;

    app.patch(
      path,
      route(async (c) => {
        const body = await parseJsonBody(c, patch.schema);
        return c.json(await patch.handler(c, requiredParam(c, idParam), body));
      }),
    );
  }

  if (item?.delete) {
    const { delete: remove, idParam, path } = item;

    app.delete(
      path,
      route(async (c) =>
        c.json(await remove.handler(c, requiredParam(c, idParam))),
      ),
    );
  }
}
