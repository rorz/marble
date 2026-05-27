import type { defineTool } from "@earendil-works/pi-coding-agent";
import type { createSupabaseClientRouterClient } from "@marble/api/supabase-client";
import type { MarbleAgentToolName } from "../roles";
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

export type { MarbleAgentHandoffTarget } from "../roles";
export type { ClientAction } from "./browser-navigate";
export type { SkippedTool } from "./contract";
export type { MarbleAgentHandoffRequest } from "./request-handoff";
export { REQUEST_HANDOFF_TOOL_NAME } from "./request-handoff";

type RouterClient = ReturnType<typeof createSupabaseClientRouterClient>;

type ToolBuildOptions = {
  browserRoutePatterns?: readonly string[];
  exaApiKey?: string;
  handoffTargets?: HandoffToolBuildOptions["handoffTargets"];
  onHandoffRequest?: HandoffToolBuildOptions["onHandoffRequest"];
  toolNames?: readonly MarbleAgentToolName[];
};

type ToolBuildReport = {
  skipped: SkippedTool[];
  tools: ReturnType<typeof defineTool>[];
};

const hasDeclaredTool = (
  toolNames: ReadonlySet<string> | undefined,
  toolName: MarbleAgentToolName,
): boolean => !toolNames || toolNames.has(toolName);

export const buildMarbleTools = (
  client: RouterClient,
  options: ToolBuildOptions = {},
): ToolBuildReport => {
  const dispatch = client as unknown as DispatchTable;
  const toolNames = options.toolNames
    ? new Set<string>(options.toolNames)
    : undefined;
  const tools: ReturnType<typeof defineTool>[] = [];

  if (hasDeclaredTool(toolNames, "browser_navigate")) {
    tools.push(
      buildBrowserNavigateTool({
        routePatterns: options.browserRoutePatterns,
      }),
    );
  }

  if (
    hasDeclaredTool(toolNames, "request_handoff") &&
    options.handoffTargets?.length &&
    options.onHandoffRequest
  ) {
    tools.push(
      buildRequestHandoffTool({
        handoffTargets: options.handoffTargets,
        onHandoffRequest: options.onHandoffRequest,
      }),
    );
  }

  if (hasDeclaredTool(toolNames, "web_fetch") && options.exaApiKey) {
    tools.push(
      buildWebFetchTool({
        exaApiKey: options.exaApiKey,
      }),
    );
  }

  if (hasDeclaredTool(toolNames, "web_search") && options.exaApiKey) {
    tools.push(
      buildWebSearchTool({
        exaApiKey: options.exaApiKey,
      }),
    );
  }

  const contractReport = buildContractTools(dispatch, {
    toolNames,
  });
  tools.push(...contractReport.tools);

  return {
    skipped: contractReport.skipped,
    tools,
  };
};
