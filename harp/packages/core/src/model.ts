import { z } from "zod";

/**
 * HARP's intermediate representation (IR).
 *
 * A captured HAR is reverse-engineered into an {@link ApiModel}: a host, a set
 * of resources, and per-endpoint inferred {@link SchemaNode} shapes for path
 * params, query, request body, and response body. Every node in the IR is plain
 * JSON so it survives filesystem persistence and oRPC transport unchanged.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type StringFormat =
  | "uuid"
  | "datetime"
  | "date"
  | "email"
  | "url"
  | "plain";

/**
 * A mergeable, JSON-serialisable description of an inferred value shape.
 * `nullable` rides alongside each concrete kind so a field that is sometimes
 * `null` stays a single typed node rather than exploding into a union.
 */
export type SchemaNode =
  | {
      kind: "unknown";
    }
  | {
      kind: "null";
    }
  | {
      kind: "boolean";
      nullable: boolean;
    }
  | {
      kind: "number";
      integer: boolean;
      nullable: boolean;
    }
  | {
      kind: "string";
      format: StringFormat;
      nullable: boolean;
    }
  | {
      kind: "array";
      element: SchemaNode;
      nullable: boolean;
    }
  | {
      kind: "object";
      fields: SchemaField[];
      nullable: boolean;
    }
  | {
      kind: "union";
      variants: SchemaNode[];
    };

export type SchemaField = {
  key: string;
  optional: boolean;
  schema: SchemaNode;
};

const stringFormatSchema = z.enum([
  "uuid",
  "datetime",
  "date",
  "email",
  "url",
  "plain",
]);

export const schemaNodeSchema: z.ZodType<SchemaNode> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal("unknown"),
    }),
    z.object({
      kind: z.literal("null"),
    }),
    z.object({
      kind: z.literal("boolean"),
      nullable: z.boolean(),
    }),
    z.object({
      integer: z.boolean(),
      kind: z.literal("number"),
      nullable: z.boolean(),
    }),
    z.object({
      format: stringFormatSchema,
      kind: z.literal("string"),
      nullable: z.boolean(),
    }),
    z.object({
      element: schemaNodeSchema,
      kind: z.literal("array"),
      nullable: z.boolean(),
    }),
    z.object({
      fields: z.array(
        z.object({
          key: z.string(),
          optional: z.boolean(),
          schema: schemaNodeSchema,
        }),
      ),
      kind: z.literal("object"),
      nullable: z.boolean(),
    }),
    z.object({
      kind: z.literal("union"),
      variants: z.array(schemaNodeSchema),
    }),
  ]),
);

export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

export type HttpMethod = z.infer<typeof httpMethodSchema>;

export const endpointModelSchema = z.object({
  contentTypes: z.object({
    request: z.string().nullable(),
    response: z.string().nullable(),
  }),
  host: z.string(),
  id: z.string(),
  lastSeenAt: z.iso.datetime({
    offset: true,
  }),
  method: httpMethodSchema,
  pathParams: z.array(
    z.object({
      name: z.string(),
      schema: schemaNodeSchema,
    }),
  ),
  pathTemplate: z.string(),
  probed: z.boolean().default(false),
  query: schemaNodeSchema.nullable(),
  requestBody: schemaNodeSchema.nullable(),
  responseBody: schemaNodeSchema.nullable(),
  responseStatuses: z.array(z.number().int()),
  sampleCount: z.number().int(),
});

export type EndpointModel = z.infer<typeof endpointModelSchema>;

export const resourceModelSchema = z.object({
  endpoints: z.array(endpointModelSchema),
  name: z.string(),
});

export type ResourceModel = z.infer<typeof resourceModelSchema>;

export const apiModelSchema = z.object({
  generatedAt: z.iso.datetime({
    offset: true,
  }),
  host: z.string(),
  resources: z.array(resourceModelSchema),
});

export type ApiModel = z.infer<typeof apiModelSchema>;
