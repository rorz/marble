import type { defineTool } from "@earendil-works/pi-coding-agent";
import type { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import { buildBrowserNavigateTool } from "./browser-navigate";
import {
  buildContractTools,
  type DispatchTable,
  type SkippedTool,
} from "./contract";
import {
  buildRequestHandoffTool,
  type HandoffToolBuildOptions,
} from "./request-handoff";
import { buildWebFetchTool } from "./web-fetch";
import { buildWebSearchTool } from "./web-search";

export type { ClientAction } from "./browser-navigate";
export type { SkippedTool } from "./contract";
export type {
  MarbleAgentHandoffRequest,
  MarbleAgentHandoffTarget,
} from "./request-handoff";
export { REQUEST_HANDOFF_TOOL_NAME } from "./request-handoff";

type RouterClient = ReturnType<typeof createSupabaseClientRouterClient>;

type ToolBuildOptions = {
  browserRoutePatterns?: readonly string[];
  exaApiKey?: string;
  handoffTargets?: HandoffToolBuildOptions["handoffTargets"];
  onHandoffRequest?: HandoffToolBuildOptions["onHandoffRequest"];
};

type ToolBuildReport = {
  skipped: SkippedTool[];
  tools: ReturnType<typeof defineTool>[];
};

export const buildMarbleTools = (
  client: RouterClient,
  options: ToolBuildOptions = {},
): ToolBuildReport => {
  const dispatch = client as unknown as DispatchTable;
  const tools: ReturnType<typeof defineTool>[] = [
    buildBrowserNavigateTool({
      routePatterns: options.browserRoutePatterns,
    }),
  ];

  if (options.handoffTargets?.length && options.onHandoffRequest) {
    tools.push(
      buildRequestHandoffTool({
        handoffTargets: options.handoffTargets,
        onHandoffRequest: options.onHandoffRequest,
      }),
    );
  }

  if (options.exaApiKey) {
    tools.push(
      buildWebFetchTool({
        exaApiKey: options.exaApiKey,
      }),
    );
    tools.push(
      buildWebSearchTool({
        exaApiKey: options.exaApiKey,
      }),
    );
  }

  const contractReport = buildContractTools(dispatch);
  tools.push(...contractReport.tools);

  return {
    skipped: contractReport.skipped,
    tools,
  };
};
