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

export type MarbleClientDriver =
  | {
      apiKey?: string;
      apiUrl: string;
      fetch?: MarbleApiFetch;
      headers?: MarbleApiHeaders;
      type: "api";
    }
  | {
      client: SupabaseClient;
      profileId?: string;
      serviceClient?: SupabaseClient;
      type: "supabase";
      userId?: string;
    };

export type MarbleClientOptions = {
  driver: MarbleClientDriver;
};

function createHostedApiClient(options: {
  apiKey?: string;
  apiUrl: string;
  fetch?: MarbleApiFetch;
  headers?: MarbleApiHeaders;
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

      headers.set("x-marble-actor-source", "SDK");

      return headers;
    },
    url: `${trimTrailingSlash(options.apiUrl)}/rpc`,
  });

  return createORPCClient(link) as ContractRouterClient<MarbleContract>;
}

export class MarbleClient {
  readonly cells: ContractRouterClient<MarbleContract>["cells"];
  readonly columns: ContractRouterClient<MarbleContract>["columns"];
  readonly events: ContractRouterClient<MarbleContract>["events"];
  readonly keys: ContractRouterClient<MarbleContract>["keys"];
  readonly pipes: ContractRouterClient<MarbleContract>["pipes"];
  readonly programFiles: ContractRouterClient<MarbleContract>["programFiles"];
  readonly programs: ContractRouterClient<MarbleContract>["programs"];
  readonly programVersions: ContractRouterClient<MarbleContract>["programVersions"];
  readonly profiles: ContractRouterClient<MarbleContract>["profiles"];
  readonly projects: ContractRouterClient<MarbleContract>["projects"];
  readonly rows: ContractRouterClient<MarbleContract>["rows"];
  readonly secrets: ContractRouterClient<MarbleContract>["secrets"];
  readonly secretBindings: ContractRouterClient<MarbleContract>["secretBindings"];
  readonly sidebar: ContractRouterClient<MarbleContract>["sidebar"];
  readonly sourceEvents: ContractRouterClient<MarbleContract>["sourceEvents"];
  readonly sources: ContractRouterClient<MarbleContract>["sources"];
  readonly tables: ContractRouterClient<MarbleContract>["tables"];

  constructor(options: MarbleClientOptions) {
    const rpcClient =
      options.driver.type === "api"
        ? createHostedApiClient(options.driver)
        : (createSupabaseClientRouterClient({
            profileId: options.driver.profileId,
            serviceSupabase: options.driver.serviceClient,
            supabase: options.driver.client,
            userId: options.driver.userId,
          }) as ContractRouterClient<MarbleContract>);

    this.cells = rpcClient.cells;
    this.columns = rpcClient.columns;
    this.events = rpcClient.events;
    this.keys = rpcClient.keys;
    this.pipes = rpcClient.pipes;
    this.programFiles = rpcClient.programFiles;
    this.programs = rpcClient.programs;
    this.programVersions = rpcClient.programVersions;
    this.profiles = rpcClient.profiles;
    this.projects = rpcClient.projects;
    this.rows = rpcClient.rows;
    this.secrets = rpcClient.secrets;
    this.secretBindings = rpcClient.secretBindings;
    this.sidebar = rpcClient.sidebar;
    this.sourceEvents = rpcClient.sourceEvents;
    this.sources = rpcClient.sources;
    this.tables = rpcClient.tables;
  }
}
