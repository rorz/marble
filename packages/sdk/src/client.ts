import type { MarbleContract } from "@marble/contracts";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

export type MarbleClientOptions = {
  apiKey?: string;
  apiUrl: string;
  fetch?: typeof fetch;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export class MarbleClient {
  readonly projects: ContractRouterClient<MarbleContract>["projects"];
  readonly rpc: ContractRouterClient<MarbleContract>;

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

    this.rpc = createORPCClient(link) as ContractRouterClient<MarbleContract>;
    this.projects = this.rpc.projects;
  }
}

export const createMarbleClient = (options: MarbleClientOptions) =>
  new MarbleClient(options);
