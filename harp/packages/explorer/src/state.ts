import {
  type ApiModel,
  buildApiModel,
  buildCoverage,
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
  dropped: Set<string>;
  merges: Map<string, string>;
  model: ApiModel;
  operationNames: Map<string, string>;
  policy: ExplorerPolicy;
  probeLog: Array<{
    method: string;
    path: string;
    status: number;
  }>;
  renames: Map<string, string>;
};

const overrideKey = (method: string, path: string) =>
  `${method.toUpperCase()} ${path}`;

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
  dropped: new Set(),
  merges: new Map(),
  model: options.model,
  operationNames: new Map(),
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
  // A probe is the agent deliberately confirming a surface. Any response from a
  // real endpoint grows the model — an HTML or otherwise-opaque body still
  // proves the endpoint exists and pins its path + query shape. The response
  // *body* schema is merged on top only when it actually parses (JSON). Only a
  // hard "not here" (404/410) or a request that never landed (status 0) is
  // skipped, so the agent's exploration is never silently lost.
  const reachedEndpoint =
    result.status > 0 && result.status !== 404 && result.status !== 410;
  if (reachedEndpoint) {
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

  const outcome =
    responseBody !== undefined
      ? " (schema merged)"
      : reachedEndpoint
        ? " (endpoint added)"
        : " (not added — no endpoint there)";
  return {
    status: result.status,
    summary: `${method} ${input.path} → ${result.status}${outcome}`,
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

export const recordOperationName = (
  state: ExplorerState,
  method: string,
  path: string,
  name: string,
) => {
  state.operationNames.set(overrideKey(method, path), name);
};

export const recordDrop = (
  state: ExplorerState,
  method: string,
  path: string,
) => {
  state.dropped.add(overrideKey(method, path));
};

/** Store the cap'n's inferred authentication notes on the model. */
export const recordAuth = (state: ExplorerState, notes: string) => {
  state.model = {
    ...state.model,
    auth: notes,
  };
};

/**
 * Declare an endpoint into the model WITHOUT probing it — for writes and other
 * endpoints the user knows exist but that can't be safely hit (the agent only
 * probes GETs). The path is treated as a literal template, so `{id}` segments
 * survive. Returns false for an unknown HTTP method.
 */
export const recordAddedEndpoint = (
  state: ExplorerState,
  method: string,
  path: string,
): boolean => {
  const parsedMethod = httpMethodSchema.safeParse(method.toUpperCase());
  if (!parsedMethod.success) {
    return false;
  }
  const [rawPath, rawQuery] = path.split("?");
  const pathname = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const query: Record<string, string> = {};
  for (const part of rawQuery ? rawQuery.split("&") : []) {
    const [key, value] = part.split("=");
    if (key) {
      query[key] = value ?? "";
    }
  }
  const sample: RequestSample = {
    host: state.model.host,
    method: parsedMethod.data,
    pathname,
    query,
    requestBody: undefined,
    requestContentType: null,
    responseBody: undefined,
    responseContentType: null,
    responseStatus: 0,
    startedDateTime: new Date().toISOString(),
    url: `https://${state.model.host}${pathname}`,
    viaProbe: false,
  };
  state.model = mergeApiModel(
    state.model,
    buildApiModel([
      sample,
    ]),
  );
  return true;
};

const applyOverrides = (state: ExplorerState): ApiModel => {
  const resolveName = (name: string) => {
    const merged = state.merges.get(name) ?? name;
    return state.renames.get(merged) ?? merged;
  };
  const groups = new Map<string, Map<string, EndpointModel>>();
  for (const resource of state.model.resources) {
    const name = resolveName(resource.name);
    const bucket = groups.get(name) ?? new Map<string, EndpointModel>();
    for (const endpoint of resource.endpoints) {
      const key = overrideKey(endpoint.method, endpoint.pathTemplate);
      if (state.dropped.has(key)) {
        continue;
      }
      const renamed = state.operationNames.get(key);
      bucket.set(
        endpoint.id,
        renamed
          ? {
              ...endpoint,
              operationName: renamed,
            }
          : endpoint,
      );
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
    .filter((resource) => resource.endpoints.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    ...state.model,
    resources,
  };
};

export const finalizeModel = (state: ExplorerState): ApiModel =>
  applyOverrides(state);

/**
 * The surface names currently in the model (post-overrides) — i.e. exactly what
 * `read_model` shows. Used to validate the agent's edits so a rename/name/drop
 * against a surface it merely *assumes* exists fails honestly instead of
 * silently no-op'ing (which makes the log claim changes the model never got).
 */
export const currentSurfaceNames = (state: ExplorerState): string[] =>
  finalizeModel(state).resources.map((resource) => resource.name);

export const hasSurface = (state: ExplorerState, name: string): boolean =>
  finalizeModel(state).resources.some((resource) => resource.name === name);

export const hasEndpoint = (
  state: ExplorerState,
  method: string,
  path: string,
): boolean => {
  const wanted = method.toUpperCase();
  return finalizeModel(state).resources.some((resource) =>
    resource.endpoints.some(
      (endpoint) =>
        endpoint.method === wanted && endpoint.pathTemplate === path,
    ),
  );
};

export const summarizeModel = (state: ExplorerState): string => {
  const model = finalizeModel(state);
  const lines = [
    `Host: ${model.host || "unknown"}`,
    "",
  ];
  for (const resource of model.resources) {
    const counts = new Map<string, number>();
    for (const endpoint of resource.endpoints) {
      counts.set(
        endpoint.operationName,
        (counts.get(endpoint.operationName) ?? 0) + 1,
      );
    }
    lines.push(`# ${resource.name}`);
    for (const endpoint of resource.endpoints) {
      const response =
        endpoint.responseBody && endpoint.responseBody.kind !== "unknown"
          ? "has-response"
          : "needs-probe";
      const duplicate =
        (counts.get(endpoint.operationName) ?? 0) > 1
          ? " ⚠ DUPLICATE NAME — rename"
          : "";
      lines.push(
        `  ${endpoint.operationName}  [${endpoint.method} ${endpoint.pathTemplate}] — ${endpoint.sampleCount} sample(s), ${response}${duplicate}`,
      );
    }
  }
  return lines.join("\n");
};

/**
 * Concrete probe suggestions: the standard REST holes HARP hypothesises around
 * the observed surfaces (a list beside a detail, a detail beside a write, etc.).
 * Surfaced in `read_model` so the agent has explicit, deterministic targets to
 * confirm or fill — discovery hints it doesn't have to invent.
 */
export const probeTargets = (state: ExplorerState): string => {
  const coverage = buildCoverage(finalizeModel(state));
  const holes = coverage.surfaces.flatMap((surface) =>
    surface.tiles
      .filter((tile) => tile.state === "hole")
      .map((tile) => `  ${tile.method} ${tile.path}`),
  );
  if (holes.length === 0) {
    return "";
  }
  return `\n\nHoles HARP hypothesises — probe to confirm + fill, or drop if absent:\n${holes.join("\n")}`;
};
