import {
  type ApiModel,
  buildApiModel,
  type EndpointModel,
  httpMethodSchema,
  type JsonValue,
  mergeApiModel,
  type RequestSample,
} from "@harp/core";

/**
 * The explorer's deterministic working state. The agent drives it through tools,
 * but every mutation here is pure + testable without an LLM: `probeAndMerge`
 * folds a live response into the model, and `applyOverrides` applies the agent's
 * semantic renames/instance-merges as a final view.
 */

export type ProbeResult = {
  body: string;
  contentType: string | null;
  ok: boolean;
  status: number;
};

export type ProbeExecutor = (request: {
  headers?: Record<string, string>;
  method: string;
  url: string;
}) => Promise<ProbeResult>;

export type ExplorerPolicy = {
  allowMutations: boolean;
  allowedHosts: string[];
};

export type ExplorerState = {
  baseUrl: string;
  merges: Map<string, string>;
  model: ApiModel;
  policy: ExplorerPolicy;
  probeLog: Array<{
    method: string;
    path: string;
    status: number;
  }>;
  renames: Map<string, string>;
};

export type ProbeOutcome = {
  blocked?: "host" | "read-only";
  status?: number;
  summary: string;
};

const READ_ONLY_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

const isJson = (contentType: string | null) =>
  contentType !== null && /\bjson\b/i.test(contentType);

const safeParse = (text: string): JsonValue | undefined => {
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    // harness-ignore: no-swallowed-errors -- non-JSON probe bodies are not inferred
    return undefined;
  }
};

const queryRecord = (url: URL): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const [name, value] of url.searchParams.entries()) {
    record[name] = value;
  }
  return record;
};

export const createExplorerState = (options: {
  baseUrl: string;
  model: ApiModel;
  policy: ExplorerPolicy;
}): ExplorerState => ({
  baseUrl: options.baseUrl.replace(/\/+$/, ""),
  merges: new Map(),
  model: options.model,
  policy: options.policy,
  probeLog: [],
  renames: new Map(),
});

export const probeAndMerge = async (
  state: ExplorerState,
  executor: ProbeExecutor,
  input: {
    method: string;
    path: string;
  },
): Promise<ProbeOutcome> => {
  const method = input.method.toUpperCase();
  if (!READ_ONLY_METHODS.has(method) && !state.policy.allowMutations) {
    return {
      blocked: "read-only",
      summary: `Blocked ${method} ${input.path}: mutating requests need confirmation (read-only mode).`,
    };
  }
  let url: URL;
  try {
    url = new URL(input.path, `${state.baseUrl}/`);
  } catch (error) {
    return {
      summary: `Invalid path '${input.path}': ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!state.policy.allowedHosts.includes(url.host)) {
    return {
      blocked: "host",
      summary: `Blocked ${url.host}: not in the allowed host list.`,
    };
  }
  const parsedMethod = httpMethodSchema.safeParse(method);
  if (!parsedMethod.success) {
    return {
      summary: `Unsupported method '${method}'.`,
    };
  }

  const result = await executor({
    method,
    url: url.toString(),
  });
  state.probeLog.push({
    method,
    path: input.path,
    status: result.status,
  });

  const responseBody = isJson(result.contentType)
    ? safeParse(result.body)
    : undefined;
  if (responseBody !== undefined) {
    const sample: RequestSample = {
      host: url.host,
      method: parsedMethod.data,
      pathname: url.pathname,
      query: queryRecord(url),
      requestBody: undefined,
      requestContentType: null,
      responseBody,
      responseContentType: result.contentType,
      responseStatus: result.status,
      startedDateTime: new Date().toISOString(),
      url: url.toString(),
      viaProbe: true,
    };
    state.model = mergeApiModel(
      state.model,
      buildApiModel([
        sample,
      ]),
    );
  }

  return {
    status: result.status,
    summary: `${method} ${input.path} → ${result.status}${responseBody !== undefined ? " (schema merged)" : ""}`,
  };
};

export const recordRename = (
  state: ExplorerState,
  from: string,
  to: string,
) => {
  state.renames.set(from, to);
};

export const recordMerge = (
  state: ExplorerState,
  from: string,
  into: string,
) => {
  state.merges.set(from, into);
};

const applyOverrides = (
  model: ApiModel,
  renames: Map<string, string>,
  merges: Map<string, string>,
): ApiModel => {
  const resolveName = (name: string) => {
    const merged = merges.get(name) ?? name;
    return renames.get(merged) ?? merged;
  };
  const groups = new Map<string, Map<string, EndpointModel>>();
  for (const resource of model.resources) {
    const name = resolveName(resource.name);
    const bucket = groups.get(name) ?? new Map<string, EndpointModel>();
    for (const endpoint of resource.endpoints) {
      bucket.set(endpoint.id, endpoint);
    }
    groups.set(name, bucket);
  }
  const resources = [
    ...groups.entries(),
  ]
    .map(([name, endpoints]) => ({
      endpoints: [
        ...endpoints.values(),
      ],
      name,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    ...model,
    resources,
  };
};

export const finalizeModel = (state: ExplorerState): ApiModel =>
  applyOverrides(state.model, state.renames, state.merges);

export const summarizeModel = (state: ExplorerState): string => {
  const model = finalizeModel(state);
  const lines = [
    `Host: ${model.host || "unknown"}`,
    "",
  ];
  for (const resource of model.resources) {
    lines.push(`# ${resource.name}`);
    for (const endpoint of resource.endpoints) {
      const response =
        endpoint.responseBody && endpoint.responseBody.kind !== "unknown"
          ? "has-response"
          : "no-response";
      lines.push(
        `  ${endpoint.method} ${endpoint.pathTemplate} — ${endpoint.sampleCount} sample(s), ${response}`,
      );
    }
  }
  return lines.join("\n");
};
