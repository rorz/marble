import type { RequestSample } from "../har";
import type {
  ApiModel,
  EndpointModel,
  ResourceModel,
  SchemaNode,
} from "../model";
import { resourceNameFromTemplate, templatizePath } from "./path";
import { inferSchema, mergeSchema } from "./schema";

/**
 * Grouping. Samples sharing a (method, path-template) become one
 * {@link EndpointModel} with merged param/query/body/response shapes; endpoints
 * sharing a leading resource segment become one {@link ResourceModel}.
 * {@link mergeApiModel} folds a freshly-parsed capture into an existing model so
 * coverage accumulates capture after capture.
 */

const hashId = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const isSuccess = (status: number) => status >= 200 && status < 300;

const maxIso = (left: string, right: string) => (left > right ? left : right);

const mergeNullable = (
  left: SchemaNode | null,
  right: SchemaNode | null,
): SchemaNode | null => {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  return mergeSchema(left, right);
};

type Aggregate = {
  contentTypes: {
    request: string | null;
    response: string | null;
  };
  host: string;
  method: EndpointModel["method"];
  params: Map<string, SchemaNode>;
  query: SchemaNode;
  requestBody: SchemaNode | null;
  responseBody: SchemaNode | null;
  sampleCount: number;
  seenAt: string;
  statuses: Set<number>;
  template: string;
};

const queryNode = (query: Record<string, string>): SchemaNode => ({
  fields: Object.keys(query)
    .sort()
    .map((key) => ({
      key,
      optional: false,
      schema: inferSchema(query[key]),
    })),
  kind: "object",
  nullable: false,
});

const addSample = (aggregate: Aggregate, sample: RequestSample) => {
  for (const param of templatizePath(sample.pathname).params) {
    const schema = inferSchema(param.value);
    const existing = aggregate.params.get(param.name);
    aggregate.params.set(
      param.name,
      existing ? mergeSchema(existing, schema) : schema,
    );
  }
  aggregate.query = mergeSchema(aggregate.query, queryNode(sample.query));
  if (sample.requestBody !== undefined) {
    aggregate.requestBody = mergeNullable(
      aggregate.requestBody,
      inferSchema(sample.requestBody),
    );
  }
  if (isSuccess(sample.responseStatus) && sample.responseBody !== undefined) {
    aggregate.responseBody = mergeNullable(
      aggregate.responseBody,
      inferSchema(sample.responseBody),
    );
  }
  aggregate.statuses.add(sample.responseStatus);
  aggregate.contentTypes.request ??= sample.requestContentType;
  aggregate.contentTypes.response ??= sample.responseContentType;
  aggregate.sampleCount += 1;
  aggregate.seenAt = maxIso(aggregate.seenAt, sample.startedDateTime);
};

const finalize = (aggregate: Aggregate): EndpointModel => ({
  contentTypes: aggregate.contentTypes,
  host: aggregate.host,
  id: hashId(`${aggregate.method} ${aggregate.template}`),
  lastSeenAt: aggregate.seenAt,
  method: aggregate.method,
  pathParams: [
    ...aggregate.params.entries(),
  ].map(([name, schema]) => ({
    name,
    schema,
  })),
  pathTemplate: aggregate.template,
  query:
    aggregate.query.kind === "object" && aggregate.query.fields.length === 0
      ? null
      : aggregate.query,
  requestBody: aggregate.requestBody,
  responseBody: aggregate.responseBody,
  responseStatuses: [
    ...aggregate.statuses,
  ].sort((left, right) => left - right),
  sampleCount: aggregate.sampleCount,
});

const buildEndpoints = (samples: RequestSample[]): EndpointModel[] => {
  const aggregates = new Map<string, Aggregate>();
  for (const sample of samples) {
    const template = templatizePath(sample.pathname).template;
    const key = `${sample.method} ${template}`;
    const existing = aggregates.get(key);
    if (existing) {
      addSample(existing, sample);
      continue;
    }
    const aggregate: Aggregate = {
      contentTypes: {
        request: null,
        response: null,
      },
      host: sample.host,
      method: sample.method,
      params: new Map(),
      query: {
        fields: [],
        kind: "object",
        nullable: false,
      },
      requestBody: null,
      responseBody: null,
      sampleCount: 0,
      seenAt: sample.startedDateTime,
      statuses: new Set(),
      template,
    };
    addSample(aggregate, sample);
    aggregates.set(key, aggregate);
  }
  return [
    ...aggregates.values(),
  ].map(finalize);
};

const mostCommonHost = (endpoints: EndpointModel[]): string => {
  const counts = new Map<string, number>();
  for (const endpoint of endpoints) {
    counts.set(endpoint.host, (counts.get(endpoint.host) ?? 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  for (const [host, count] of counts.entries()) {
    if (count > bestCount) {
      best = host;
      bestCount = count;
    }
  }
  return best;
};

const groupResources = (endpoints: EndpointModel[]): ResourceModel[] => {
  const groups = new Map<string, EndpointModel[]>();
  for (const endpoint of endpoints) {
    const name = resourceNameFromTemplate(endpoint.pathTemplate);
    const bucket = groups.get(name) ?? [];
    bucket.push(endpoint);
    groups.set(name, bucket);
  }
  return [
    ...groups.entries(),
  ]
    .map(([name, bucket]) => ({
      endpoints: bucket.sort(
        (left, right) =>
          left.pathTemplate.localeCompare(right.pathTemplate) ||
          left.method.localeCompare(right.method),
      ),
      name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const buildApiModel = (samples: RequestSample[]): ApiModel => {
  const endpoints = buildEndpoints(samples);
  return {
    generatedAt: new Date().toISOString(),
    host: mostCommonHost(endpoints),
    resources: groupResources(endpoints),
  };
};

const flattenEndpoints = (model: ApiModel): EndpointModel[] =>
  model.resources.flatMap((resource) => resource.endpoints);

const mergeParams = (
  left: EndpointModel["pathParams"],
  right: EndpointModel["pathParams"],
): EndpointModel["pathParams"] => {
  const map = new Map<string, SchemaNode>();
  for (const param of [
    ...left,
    ...right,
  ]) {
    const existing = map.get(param.name);
    map.set(
      param.name,
      existing ? mergeSchema(existing, param.schema) : param.schema,
    );
  }
  return [
    ...map.entries(),
  ].map(([name, schema]) => ({
    name,
    schema,
  }));
};

const mergeEndpoint = (
  left: EndpointModel,
  right: EndpointModel,
): EndpointModel => ({
  contentTypes: {
    request: left.contentTypes.request ?? right.contentTypes.request,
    response: left.contentTypes.response ?? right.contentTypes.response,
  },
  host: left.host,
  id: left.id,
  lastSeenAt: maxIso(left.lastSeenAt, right.lastSeenAt),
  method: left.method,
  pathParams: mergeParams(left.pathParams, right.pathParams),
  pathTemplate: left.pathTemplate,
  query: mergeNullable(left.query, right.query),
  requestBody: mergeNullable(left.requestBody, right.requestBody),
  responseBody: mergeNullable(left.responseBody, right.responseBody),
  responseStatuses: [
    ...new Set([
      ...left.responseStatuses,
      ...right.responseStatuses,
    ]),
  ].sort((first, second) => first - second),
  sampleCount: left.sampleCount + right.sampleCount,
});

export const mergeApiModel = (
  existing: ApiModel,
  incoming: ApiModel,
): ApiModel => {
  const byId = new Map<string, EndpointModel>();
  for (const endpoint of flattenEndpoints(existing)) {
    byId.set(endpoint.id, endpoint);
  }
  for (const endpoint of flattenEndpoints(incoming)) {
    const previous = byId.get(endpoint.id);
    byId.set(
      endpoint.id,
      previous ? mergeEndpoint(previous, endpoint) : endpoint,
    );
  }
  const endpoints = [
    ...byId.values(),
  ];
  return {
    generatedAt: new Date().toISOString(),
    host: mostCommonHost(endpoints),
    resources: groupResources(endpoints),
  };
};
