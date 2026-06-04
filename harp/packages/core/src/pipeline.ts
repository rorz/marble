import { generateAuthDoc } from "./codegen/auth";
import { generateCli } from "./codegen/cli";
import { generateContract } from "./codegen/contract";
import { generateOpenApi } from "./codegen/openapi";
import { generateSdk } from "./codegen/sdk";
import {
  buildCoverage,
  type CoverageDelta,
  type CoverageMap,
  diffCoverage,
} from "./coverage";
import { parseHar } from "./har";
import { buildApiModel, mergeApiModel } from "./infer/endpoint";
import type { ApiModel } from "./model";

export type GeneratedArtifacts = {
  auth: string;
  cli: string;
  contract: string;
  openapi: string;
  sdk: string;
};

/**
 * The full generated artifact set for a model: the oRPC contract, a typed SDK, a
 * CLI, an OpenAPI 3.1 document, and the cap'n's inferred auth notes (all derived
 * from the same model, so they agree).
 */
export const generateArtifacts = (model: ApiModel): GeneratedArtifacts => ({
  auth: generateAuthDoc(model),
  cli: generateCli(model),
  contract: generateContract(model),
  openapi: generateOpenApi(model),
  sdk: generateSdk(model),
});

/**
 * The end-to-end reverse-engineering pipeline: a HAR (plus any prior state)
 * becomes a merged {@link ApiModel}, a refreshed {@link CoverageMap}, the
 * generated oRPC contract source, and a {@link CoverageDelta} describing what
 * this capture newly unlocked.
 */

export type IngestInput = {
  har: unknown;
  previousCoverage?: CoverageMap | null;
  previousModel?: ApiModel | null;
};

export type IngestResult = {
  contractSource: string;
  coverage: CoverageMap;
  delta: CoverageDelta;
  model: ApiModel;
  sampleCount: number;
};

export const ingestHar = (input: IngestInput): IngestResult => {
  const samples = parseHar(input.har);
  const incoming = buildApiModel(samples);
  const model = input.previousModel
    ? mergeApiModel(input.previousModel, incoming)
    : incoming;
  const coverage = buildCoverage(model);
  const delta = diffCoverage(input.previousCoverage ?? null, coverage);
  const contractSource = generateContract(model);
  return {
    contractSource,
    coverage,
    delta,
    model,
    sampleCount: samples.length,
  };
};
