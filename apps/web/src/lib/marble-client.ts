type MarbleClientMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type CallMarbleClientOptions = {
  allowErrorStatus?: boolean;
  body?: unknown;
  method?: MarbleClientMethod;
  requestId?: string;
};

type ErrorPayload = {
  details?: unknown;
  error?: string;
};

export class MarbleClientError extends Error {
  details?: unknown;
  requestId: string;
  status: number;

  constructor(input: {
    details?: unknown;
    message: string;
    requestId: string;
    status: number;
  }) {
    super(input.message);
    this.details = input.details;
    this.requestId = input.requestId;
    this.status = input.status;
  }
}

function buildApiPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/api${normalizedPath}`;
}

function buildRequestBody(body: unknown) {
  if (body === undefined) {
    return undefined;
  }

  return JSON.stringify(body);
}

function parseErrorPayload(payload: unknown): ErrorPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as ErrorPayload;
}

function logSlowClientMutation(input: {
  durationMs: number;
  method: string;
  path: string;
  requestId: string;
}) {
  if (input.durationMs < 250) {
    return;
  }

  console.warn("[marble] slow client mutation", {
    durationMs: Math.round(input.durationMs),
    method: input.method,
    path: input.path,
    requestId: input.requestId,
  });
}

export async function callMarbleClient<T>(
  path: string,
  options: CallMarbleClientOptions = {},
): Promise<T> {
  const requestId = options.requestId ?? crypto.randomUUID();
  const body = buildRequestBody(options.body);
  const method = options.method ?? (body === undefined ? "GET" : "POST");
  const headers = new Headers({
    "x-marble-request-id": requestId,
  });
  const startedAt = performance.now();

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(buildApiPath(path), {
    body,
    cache: "no-store",
    headers,
    method,
  });
  const text = await response.text();
  const durationMs = performance.now() - startedAt;

  logSlowClientMutation({
    durationMs,
    method,
    path,
    requestId,
  });

  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok && !options.allowErrorStatus) {
    const errorPayload = parseErrorPayload(payload);
    throw new MarbleClientError({
      details: errorPayload.details,
      message:
        errorPayload.error ??
        (text || `Request failed with status ${response.status}`),
      requestId,
      status: response.status,
    });
  }

  return payload as T;
}
