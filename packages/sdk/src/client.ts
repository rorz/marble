import { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import type { MarbleContract } from "@marble/contracts";
import { trimTrailingSlash } from "@marble/lib/string";
import type { SupabaseClient } from "@marble/supabase";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

export type MarbleClientDriver =
  | {
      apiKey?: string;
      apiUrl: string;
      type: "api";
    }
  | {
      client: SupabaseClient;
      type: "supabase";
    };

export type MarbleClientOptions = {
  driver: MarbleClientDriver;
};

function createHostedApiClient(options: { apiKey?: string; apiUrl: string }) {
  const link = new RPCLink({
    headers: () => ({
      ...(options.apiKey
        ? {
            Authorization: `Bearer ${options.apiKey}`,
          }
        : {}),
      "x-marble-actor-source": "SDK",
    }),
    url: `${trimTrailingSlash(options.apiUrl)}/rpc`,
  });

  return createORPCClient(link) as ContractRouterClient<MarbleContract>;
}

export class MarbleClient {
  readonly pipes: ContractRouterClient<MarbleContract>["pipes"];
  readonly projects: ContractRouterClient<MarbleContract>["projects"];
  readonly sourceEvents: ContractRouterClient<MarbleContract>["sourceEvents"];
  readonly sources: ContractRouterClient<MarbleContract>["sources"];
  readonly tables: ContractRouterClient<MarbleContract>["tables"];

  constructor(options: MarbleClientOptions) {
    const rpcClient =
      options.driver.type === "api"
        ? createHostedApiClient(options.driver)
        : (createSupabaseClientRouterClient({
            supabase: options.driver.client,
          }) as ContractRouterClient<MarbleContract>);

    this.pipes = rpcClient.pipes;
    this.projects = rpcClient.projects;
    this.sourceEvents = rpcClient.sourceEvents;
    this.sources = rpcClient.sources;
    this.tables = rpcClient.tables;
  }
}
