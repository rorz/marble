import type { HarpContract } from "@harp/contracts";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { ContractRouterClient } from "@orpc/contract";

type RpcLinkOptions = ConstructorParameters<typeof RPCLink>[0];
type HarpFetch = RpcLinkOptions["fetch"];
type HarpHeaders = RpcLinkOptions["headers"];

export type HarpClientOptions = {
  baseUrl: string;
  fetch?: HarpFetch;
  headers?: HarpHeaders;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const resolveRpcUrl = (baseUrl: string) => {
  const trimmed = trimTrailingSlash(baseUrl);
  try {
    return `${trimTrailingSlash(new URL(trimmed).toString())}/rpc`;
  } catch (error) {
    throw new Error("HARP base URLs must be absolute.", {
      cause: error,
    });
  }
};

/**
 * Typed client for the HARP control plane. One field per contract resource,
 * each backed by a single oRPC RPC link — the same shape as `MarbleClient`, so
 * agents and the CLI drive HARP exactly the way they drive Marble.
 */
export class HarpClient {
  readonly captures: ContractRouterClient<HarpContract>["captures"];
  readonly contract: ContractRouterClient<HarpContract>["contract"];
  readonly coverage: ContractRouterClient<HarpContract>["coverage"];
  readonly model: ContractRouterClient<HarpContract>["model"];
  readonly projects: ContractRouterClient<HarpContract>["projects"];

  constructor(options: HarpClientOptions) {
    const link = new RPCLink({
      fetch: options.fetch,
      headers: options.headers,
      url: () => resolveRpcUrl(options.baseUrl),
    });
    const client = createORPCClient(link) as ContractRouterClient<HarpContract>;
    this.captures = client.captures;
    this.contract = client.contract;
    this.coverage = client.coverage;
    this.model = client.model;
    this.projects = client.projects;
  }
}
