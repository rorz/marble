import { trimTrailingSlash } from "@marble/lib/string";
import type { ResourceActions } from "@marble/store";
import { ORPCError } from "@orpc/server";
import type { ApiActor, MarbleApiRuntime } from "./context";

type ExecutorPayload = Record<string, unknown>;

type ExecutorProxy = (input: {
  body: unknown;
  path: string;
  search?: string;
}) => Promise<{
  payload: ExecutorPayload;
  status: number;
}>;

const getForwardedHeader = (request: Request, name: string) => {
  return request.headers.get(name) ?? undefined;
};

const requireExecutor = (runtime: MarbleApiRuntime) => {
  if (!runtime.executor) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Executor runtime is not configured.",
    });
  }

  return runtime.executor;
};

const executorEndpointUrl = (baseUrl: string, path: string, search = "") => {
  const endpoint = new URL(baseUrl);
  endpoint.pathname = `${trimTrailingSlash(endpoint.pathname)}${path}`;
  endpoint.search = search;
  return endpoint;
};

const executorHeaders = (
  actor: ApiActor,
  request: Request,
  runtime: MarbleApiRuntime,
) => {
  const headers = new Headers();

  headers.set("Content-Type", "application/json");

  if (actor.type === "supabase-session") {
    headers.set("Authorization", `Bearer ${actor.accessToken}`);
  }

  // Prove to the executor that this forwarded-auth request originates from our
  // own API. Paired with Cloudflare Access at the edge — defense in depth.
  if (runtime.executor?.internalSecret) {
    headers.set("x-marble-internal-secret", runtime.executor.internalSecret);
  }

  if (runtime.executor?.accessClientId) {
    headers.set("CF-Access-Client-Id", runtime.executor.accessClientId);
  }

  if (runtime.executor?.accessClientSecret) {
    headers.set("CF-Access-Client-Secret", runtime.executor.accessClientSecret);
  }

  headers.set("x-marble-auth-profile-id", actor.profileId);
  headers.set("x-marble-auth-user-id", actor.userId);

  if (actor.type === "api-key") {
    headers.set("x-marble-auth-key-id", actor.keyId);
  }

  for (const name of [
    "x-marble-actor-source",
    "x-marble-request-id",
  ]) {
    const value = getForwardedHeader(request, name);

    if (value) {
      headers.set(name, value);
    }
  }

  return headers;
};

const readExecutorResponse = async (response: Response) => {
  const text = await response.text();

  try {
    return {
      payload: JSON.parse(text) as ExecutorPayload,
      status: response.status,
    };
  } catch (error) {
    void error;
    return {
      payload: {
        error: true,
        message: text || "Executor returned a non-JSON response.",
        output: null,
        success: false,
      },
      status: response.status,
    };
  }
};

const createExecutorProxy = (
  runtime: MarbleApiRuntime,
  actor: ApiActor,
  request: Request,
): ExecutorProxy => {
  return async (input) => {
    const executor = requireExecutor(runtime);
    const executorRequest = new Request(
      executorEndpointUrl(executor.url, input.path, input.search),
      {
        body: JSON.stringify(input.body),
        headers: executorHeaders(actor, request, runtime),
        method: "POST",
      },
    );
    const response = executor.transport
      ? await executor.transport.fetch(executorRequest)
      : await fetch(executorRequest);

    return readExecutorResponse(response);
  };
};

export const createExecutorActions = (
  runtime: MarbleApiRuntime,
  actor: ApiActor,
  request: Request,
): ResourceActions => {
  const proxyExecutorRequest = createExecutorProxy(runtime, actor, request);

  return {
    executeProgramRun: (input) =>
      proxyExecutorRequest({
        body: {},
        path: "/run",
        search: new URLSearchParams({
          run_id: input.runId,
        }).toString(),
      }),
    executeProgramVersionTest: (input) =>
      proxyExecutorRequest({
        body: input.body,
        path: "/test",
        search: new URLSearchParams({
          programVersionId: input.programVersionId,
        }).toString(),
      }),
  };
};
