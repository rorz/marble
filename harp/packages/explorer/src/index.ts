import type { ApiModel, CoverageMap } from "@harp/core";
import type { LogEntry } from "./log";
import type { ExplorerProvider, ExplorerVariant } from "./models";
import { runExplore } from "./session";
import {
  createExplorerState,
  type ExplorerPolicy,
  finalizeModel,
  type ProbeExecutor,
} from "./state";

export type { LogEntry, LogEntryKind } from "./log";
export {
  type ExplorerProvider,
  type ExplorerVariant,
  resolveExplorerModel,
} from "./models";
export type { ExplorerPolicy, ProbeExecutor, ProbeResult } from "./state";
export { throttleProbes } from "./throttle";

export type ExploreOptions = {
  apiKey: string;
  baseUrl: string;
  executor: ProbeExecutor;
  message?: string;
  model: ApiModel;
  onLog?: (entry: LogEntry) => void;
  onProgress?: (coverage: CoverageMap) => void;
  policy?: Partial<ExplorerPolicy>;
  provider: ExplorerProvider;
  variant?: ExplorerVariant;
};

export type ExploreResult = {
  model: ApiModel;
  probeLog: Array<{
    method: string;
    path: string;
    status: number;
  }>;
};

/**
 * Reverse-engineering by active exploration: takes the deterministic seed model
 * + a probe executor (the extension's in-page "hands"), runs the Pi agent loop
 * to confirm holes / enrich schemas / fix mislabels, and returns the refined
 * model. Read-only by default; mutations require `policy.allowMutations`.
 */
export const explore = async (
  options: ExploreOptions,
): Promise<ExploreResult> => {
  const host = new URL(options.baseUrl).host;
  const state = createExplorerState({
    baseUrl: options.baseUrl,
    model: options.model,
    policy: {
      allowedHosts: options.policy?.allowedHosts ?? [
        host,
      ],
      allowMutations: options.policy?.allowMutations ?? false,
    },
  });
  await runExplore({
    apiKey: options.apiKey,
    executor: options.executor,
    message: options.message,
    mode: "explore",
    onLog: options.onLog,
    onProgress: options.onProgress,
    provider: options.provider,
    state,
    variant: options.variant,
  });
  return {
    model: finalizeModel(state),
    probeLog: state.probeLog,
  };
};

export type RefineOptions = {
  apiKey: string;
  model: ApiModel;
  onLog?: (entry: LogEntry) => void;
  onProgress?: (coverage: CoverageMap) => void;
  provider: ExplorerProvider;
  variant?: ExplorerVariant;
};

/**
 * A naming & cleanup pass with NO probing — the agent only reads the model and
 * makes it elite via renaming, de-duplicating, restructuring, and pruning. No
 * browser hands required, so it runs anywhere a model key is available.
 */
export const refine = async (
  options: RefineOptions,
): Promise<ExploreResult> => {
  const state = createExplorerState({
    baseUrl: `https://${options.model.host || "localhost"}`,
    model: options.model,
    policy: {
      allowedHosts: [],
      allowMutations: false,
    },
  });
  await runExplore({
    apiKey: options.apiKey,
    mode: "refine",
    onLog: options.onLog,
    onProgress: options.onProgress,
    provider: options.provider,
    state,
    variant: options.variant,
  });
  return {
    model: finalizeModel(state),
    probeLog: state.probeLog,
  };
};
