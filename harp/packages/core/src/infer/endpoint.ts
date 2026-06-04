import type { RequestSample } from "../har";
import type {
  ApiModel,
  EndpointModel,
  ResourceModel,
  SchemaNode,
} from "../model";
import {
  operationVerb,
  pickCollectionTemplate,
  pickItemTemplate,
  resourceNameFromTemplate,
  templatizePath,
} from "./path";
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
  probed: boolean;
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
  if (sample.viaProbe) {
    aggregate.probed = true;
  }
  aggregate.sampleCount += 1;
  aggregate.seenAt = maxIso(aggregate.seenAt, sample.startedDateTime);
};

const finalize = (aggregate: Aggregate): EndpointModel => ({
  contentTypes: aggregate.contentTypes,
  host: aggregate.host,
  id: hashId(`${aggregate.method} ${aggregate.template}`),
  lastSeenAt: aggregate.seenAt,
  method: aggregate.method,
  operationName: "",
  pathParams: [
    ...aggregate.params.entries(),
  ].map(([name, schema]) => ({
    name,
    schema,
  })),
  pathTemplate: aggregate.template,
  probed: aggregate.probed,
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
      probed: sample.viaProbe === true,
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

const capitalize = (value: string) =>
  value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;

const pascalParam = (paramName: string) =>
  capitalize(paramName.replace(/Id$/i, "") || paramName);

/**
 * A unique, meaningful operation name within a resource. Starts from the
 * conventional verb (list/get/create/update/delete or a sub-resource name) and
 * disambiguates collisions with the deepest path param (`getByVersion`) before
 * falling back to a numeric suffix. The agent can override this with a more
 * elite name via `name_operation`.
 */
const uniqueOperationName = (
  endpoint: EndpointModel,
  collection: string | null,
  item: string | null,
  used: Set<string>,
): string => {
  const base = operationVerb(
    endpoint.method,
    endpoint.pathTemplate,
    collection,
    item,
  );
  let candidate = base;
  if (used.has(candidate)) {
    const deepestParam = endpoint.pathParams.at(-1)?.name;
    candidate = deepestParam ? `${base}By${pascalParam(deepestParam)}` : base;
  }
  if (used.has(candidate)) {
    let suffix = 2;
    while (used.has(`${base}${suffix}`)) {
      suffix += 1;
    }
    candidate = `${base}${suffix}`;
  }
  used.add(candidate);
  return candidate;
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
    .map(([name, bucket]) => {
      const sorted = bucket.sort(
        (left, right) =>
          left.pathTemplate.localeCompare(right.pathTemplate) ||
          left.method.localeCompare(right.method),
      );
      const templates = sorted.map((endpoint) => endpoint.pathTemplate);
      const collection = pickCollectionTemplate(templates);
      const item = pickItemTemplate(templates, collection);
      const used = new Set<string>();
      const named = sorted.map((endpoint) => ({
        ...endpoint,
        operationName: uniqueOperationName(endpoint, collection, item, used),
      }));
      return {
        endpoints: named,
        name,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
};

/**
 * Heal a model whose endpoints predate `operationName` (or were persisted before
 * naming ran). Existing non-empty names — including elite names the agent chose
 * — are preserved; only blank names are filled, uniquely, from path conventions.
 * Idempotent: a fully-named model passes through untouched.
 */
export const fillOperationNames = (model: ApiModel): ApiModel => ({
  ...model,
  resources: model.resources.map((resource) => {
    if (resource.endpoints.every((endpoint) => endpoint.operationName !== "")) {
      return resource;
    }
    const templates = resource.endpoints.map(
      (endpoint) => endpoint.pathTemplate,
    );
    const collection = pickCollectionTemplate(templates);
    const item = pickItemTemplate(templates, collection);
    const used = new Set(
      resource.endpoints
        .map((endpoint) => endpoint.operationName)
        .filter((name) => name !== ""),
    );
    return {
      ...resource,
      endpoints: resource.endpoints.map((endpoint) =>
        endpoint.operationName === ""
          ? {
              ...endpoint,
              operationName: uniqueOperationName(
                endpoint,
                collection,
                item,
                used,
              ),
            }
          : endpoint,
      ),
    };
  }),
});

export const buildApiModel = (samples: RequestSample[]): ApiModel => {
  const endpoints = buildEndpoints(samples);
  return {
    auth: "",
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
  operationName: "",
  pathParams: mergeParams(left.pathParams, right.pathParams),
  pathTemplate: left.pathTemplate,
  probed: left.probed || right.probed,
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
    auth: existing.auth || incoming.auth,
    generatedAt: new Date().toISOString(),
    host: mostCommonHost(endpoints),
    resources: groupResources(endpoints),
  };
};
