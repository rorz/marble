import type { ApiModel, EndpointModel, SchemaNode } from "../model";

/**
 * Emits an OpenAPI 3.1 document for a reverse-engineered API, derived from the
 * same {@link ApiModel} as the oRPC contract — so the spec, SDK, and CLI all
 * agree. OpenAPI 3.1 IS JSON Schema 2020-12, so {@link SchemaNode}s map across
 * directly. Served by HARP and rendered with Scalar (the same reference UI oRPC
 * ships), so you can browse the contract as a live API reference.
 */

type JsonSchema = Record<string, unknown>;

const FORMAT: Record<string, string | undefined> = {
  date: "date",
  datetime: "date-time",
  email: "email",
  plain: undefined,
  url: "uri",
  uuid: "uuid",
};

const typeOf = (base: string, nullable: boolean): string | string[] =>
  nullable
    ? [
        base,
        "null",
      ]
    : base;

const schemaNodeToJsonSchema = (node: SchemaNode): JsonSchema => {
  switch (node.kind) {
    case "unknown":
      return {};
    case "null":
      return {
        type: "null",
      };
    case "boolean":
      return {
        type: typeOf("boolean", node.nullable),
      };
    case "number":
      return {
        type: typeOf(node.integer ? "integer" : "number", node.nullable),
      };
    case "string": {
      const format = FORMAT[node.format];
      return format
        ? {
            format,
            type: typeOf("string", node.nullable),
          }
        : {
            type: typeOf("string", node.nullable),
          };
    }
    case "array":
      return {
        items: schemaNodeToJsonSchema(node.element),
        type: typeOf("array", node.nullable),
      };
    case "object": {
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];
      for (const field of node.fields) {
        properties[field.key] = schemaNodeToJsonSchema(field.schema);
        if (!field.optional) {
          required.push(field.key);
        }
      }
      return required.length > 0
        ? {
            properties,
            required,
            type: typeOf("object", node.nullable),
          }
        : {
            properties,
            type: typeOf("object", node.nullable),
          };
    }
    case "union": {
      const concrete = node.variants.filter(
        (variant) => variant.kind !== "null",
      );
      const hasNull = node.variants.some((variant) => variant.kind === "null");
      if (concrete.length === 0) {
        return {
          type: "null",
        };
      }
      const schemas = concrete.map(schemaNodeToJsonSchema);
      if (hasNull) {
        schemas.push({
          type: "null",
        });
      }
      return schemas.length === 1
        ? schemas[0]
        : {
            anyOf: schemas,
          };
    }
    default:
      return {};
  }
};

const capitalize = (value: string) =>
  value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

const requestContentType = (endpoint: EndpointModel): string =>
  /form/i.test(endpoint.contentTypes.request ?? "")
    ? "application/x-www-form-urlencoded"
    : "application/json";

const buildResponses = (endpoint: EndpointModel): JsonSchema => {
  const statuses =
    endpoint.responseStatuses.length > 0
      ? endpoint.responseStatuses
      : [
          200,
        ];
  const responses: Record<string, JsonSchema> = {};
  for (const status of statuses) {
    responses[String(status)] = {
      description: STATUS_TEXT[status] ?? "Response",
    };
  }
  const success = statuses.find((status) => status >= 200 && status < 300);
  if (success !== undefined) {
    const bodyKnown =
      endpoint.responseBody !== null &&
      endpoint.responseBody.kind !== "unknown";
    if (bodyKnown) {
      responses[String(success)].content = {
        "application/json": {
          schema: schemaNodeToJsonSchema(endpoint.responseBody as SchemaNode),
        },
      };
    } else if (endpoint.contentTypes.response) {
      responses[String(success)].content = {
        [endpoint.contentTypes.response.split(";")[0]]: {
          schema: {
            type: "string",
          },
        },
      };
    }
  }
  return responses;
};

const buildOperation = (
  endpoint: EndpointModel,
  resourceName: string,
): JsonSchema => {
  const op = endpoint.operationName || endpoint.method.toLowerCase();
  const parameters: JsonSchema[] = endpoint.pathParams.map((param) => ({
    in: "path",
    name: param.name,
    required: true,
    schema: schemaNodeToJsonSchema(param.schema),
  }));
  if (endpoint.query?.kind === "object") {
    for (const field of endpoint.query.fields) {
      parameters.push({
        in: "query",
        name: field.key,
        required: !field.optional,
        schema: schemaNodeToJsonSchema(field.schema),
      });
    }
  }
  const operation: JsonSchema = {
    operationId: `${resourceName}.${op}`,
    responses: buildResponses(endpoint),
    summary: `${capitalize(op)} ${resourceName}`,
    tags: [
      resourceName,
    ],
  };
  if (parameters.length > 0) {
    operation.parameters = parameters;
  }
  if (endpoint.requestBody !== null) {
    operation.requestBody = {
      content: {
        [requestContentType(endpoint)]: {
          schema: schemaNodeToJsonSchema(endpoint.requestBody),
        },
      },
      required: true,
    };
  }
  return operation;
};

export const generateOpenApi = (model: ApiModel): string => {
  const paths: Record<string, Record<string, JsonSchema>> = {};
  for (const resource of model.resources) {
    for (const endpoint of resource.endpoints) {
      const item = paths[endpoint.pathTemplate] ?? {};
      item[endpoint.method.toLowerCase()] = buildOperation(
        endpoint,
        resource.name,
      );
      paths[endpoint.pathTemplate] = item;
    }
  }
  const document = {
    info: {
      description: "Reverse-engineered by HARP \uD83E\uDE89.",
      title: `${model.host || "Reverse-engineered"} API`,
      version: "0.1.0",
    },
    openapi: "3.1.0",
    paths,
    servers: model.host
      ? [
          {
            url: `https://${model.host}`,
          },
        ]
      : [],
    tags: model.resources.map((resource) => ({
      name: resource.name,
    })),
  };
  return JSON.stringify(document, null, 2);
};
