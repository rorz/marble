import type { MarbleContract } from "@marble/contracts";
import { trimTrailingSlash } from "@marble/lib/string";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

export type MarbleClientOptions = {
  apiKey?: string;
  apiUrl: string;
  fetch?: typeof fetch;
};

export class MarbleClient {
  readonly projects: ContractRouterClient<MarbleContract>["projects"];
  readonly tables: ContractRouterClient<MarbleContract>["tables"];

  constructor(options: MarbleClientOptions) {
    const link = new RPCLink({
      fetch: options.fetch,
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

    const rpcClient = createORPCClient(
      link,
    ) as ContractRouterClient<MarbleContract>;
    this.projects = rpcClient.projects;
    this.tables = rpcClient.tables;
  }
}
