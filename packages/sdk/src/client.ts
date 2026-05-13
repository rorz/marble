import { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import type { MarbleContract } from "@marble/contracts";
import { trimTrailingSlash } from "@marble/lib/string";
import type { SupabaseClient } from "@marble/supabase";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

type RpcLinkOptions = ConstructorParameters<typeof RPCLink>[0];
type MarbleApiFetch = RpcLinkOptions["fetch"];
type MarbleApiHeaders = RpcLinkOptions["headers"];
type MarbleActorSource = "CLI" | "RAW_API" | "WEB_APP";

export type MarbleClientDriver =
  | {
      actorSource?: MarbleActorSource;
      apiKey: string;
      apiUrl: string;
      fetch?: MarbleApiFetch;
      headers?: MarbleApiHeaders;
      type: "api";
    }
  | {
      actorSource?: MarbleActorSource;
      apiUrl: string;
      fetch?: MarbleApiFetch;
      headers?: MarbleApiHeaders;
      profileId?: string;
      type: "web-session";
    }
  | {
      client: SupabaseClient;
      profileId?: string;
      type: "supabase";
    };

export type MarbleClientOptions = {
  driver: MarbleClientDriver;
};

function resolveHostedApiUrl(apiUrl: string) {
  const trimmedApiUrl = trimTrailingSlash(apiUrl);

  try {
    return trimTrailingSlash(new URL(trimmedApiUrl).toString());
  } catch (error) {
    throw new Error("Marble API URLs must be absolute.", {
      cause: error,
    });
  }
}

function resolveHostedApiRpcUrl(apiUrl: string) {
  return `${resolveHostedApiUrl(apiUrl)}/rpc`;
}

function createHostedApiClient(options: {
  actorSource?: MarbleActorSource;
  apiKey?: string;
  apiUrl: string;
  fetch?: MarbleApiFetch;
  headers?: MarbleApiHeaders;
  profileId?: string;
}) {
  const link = new RPCLink({
    fetch: options.fetch,
    headers: async (clientOptions, path, input) => {
      const extraHeaders =
        typeof options.headers === "function"
          ? await options.headers(clientOptions, path, input)
          : options.headers;
      const headers = new Headers(extraHeaders as HeadersInit | undefined);

      if (options.apiKey) {
        headers.set("Authorization", `Bearer ${options.apiKey}`);
      }

      if (options.profileId) {
        headers.set("x-marble-profile-id", options.profileId);
      }

      if (options.actorSource) {
        headers.set("x-marble-actor-source", options.actorSource);
      }

      return headers;
    },
    url: () => resolveHostedApiRpcUrl(options.apiUrl),
  });

  return createORPCClient(link) as ContractRouterClient<MarbleContract>;
}

// MarbleClient is a thin façade over `ContractRouterClient<MarbleContract>`
// that adds zero behavior — every resource property is just `rpcClient.<name>`.
// We use the declaration-merging pattern so the surface is derived from the
// contract type (no per-resource list to keep in sync) while still preserving
// the named-class JSDoc/intellisense agents expect from `MarbleClient`.
type MarbleRpcClient = ContractRouterClient<MarbleContract>;

export interface MarbleClient extends MarbleRpcClient {}

export class MarbleClient {
  constructor(options: MarbleClientOptions) {
    const rpcClient: MarbleRpcClient =
      options.driver.type === "supabase"
        ? (createSupabaseClientRouterClient({
            profileId: options.driver.profileId,
            supabase: options.driver.client,
          }) as MarbleRpcClient)
        : createHostedApiClient({
            ...options.driver,
            profileId:
              options.driver.type === "web-session"
                ? options.driver.profileId
                : undefined,
          });

    Object.assign(this, rpcClient);
  }
}
