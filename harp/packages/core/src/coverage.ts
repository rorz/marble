import { z } from "zod";
import {
  operationVerb,
  pickCollectionTemplate,
  pickItemTemplate,
} from "./infer/path";
import { type ApiModel, type EndpointModel, httpMethodSchema } from "./model";

/**
 * The "swiss-cheese" map. Each resource (surface) is a grid of tiles. Observed
 * endpoints are `unlocked` (richly sampled) or `discovered` (seen but thin);
 * the standard REST operations HARP expects but hasn't captured yet are `hole`s
 * — the gaps you fill by clicking around more of the target product.
 */

const coverageTileStateSchema = z.enum([
  "unlocked",
  "discovered",
  "hole",
]);

export type CoverageTileState = z.infer<typeof coverageTileStateSchema>;

export const coverageTileSchema = z.object({
  key: z.string(),
  label: z.string(),
  method: httpMethodSchema,
  path: z.string(),
  sampleCount: z.number().int(),
  state: coverageTileStateSchema,
});

export type CoverageTile = z.infer<typeof coverageTileSchema>;

export const coverageSurfaceSchema = z.object({
  discoveredCount: z.number().int(),
  holeCount: z.number().int(),
  name: z.string(),
  tiles: z.array(coverageTileSchema),
  totalCount: z.number().int(),
  unlockedCount: z.number().int(),
});

export type CoverageSurface = z.infer<typeof coverageSurfaceSchema>;

export const coverageMapSchema = z.object({
  generatedAt: z.iso.datetime({
    offset: true,
  }),
  host: z.string(),
  stats: z.object({
    coverage: z.number(),
    discovered: z.number().int(),
    holes: z.number().int(),
    total: z.number().int(),
    unlocked: z.number().int(),
  }),
  surfaces: z.array(coverageSurfaceSchema),
});

export type CoverageMap = z.infer<typeof coverageMapSchema>;

export const coverageDeltaSchema = z.object({
  coverage: z.number(),
  newlyUnlocked: z.array(z.string()),
  newTiles: z.array(z.string()),
  total: z.number().int(),
  unlocked: z.number().int(),
});

export type CoverageDelta = z.infer<typeof coverageDeltaSchema>;

const tileKey = (method: string, template: string) => `${method} ${template}`;

const observedTileState = (endpoint: EndpointModel): CoverageTileState => {
  const hasResponse =
    endpoint.responseBody !== null && endpoint.responseBody.kind !== "unknown";
  return endpoint.sampleCount >= 2 && hasResponse ? "unlocked" : "discovered";
};

type Hypothesis = {
  method: EndpointModel["method"];
  template: string;
};

const hypotheses = (
  collection: string | null,
  item: string | null,
): Hypothesis[] => {
  const result: Hypothesis[] = [];
  if (collection) {
    result.push({
      method: "GET",
      template: collection,
    });
    result.push({
      method: "POST",
      template: collection,
    });
  }
  if (item) {
    result.push({
      method: "GET",
      template: item,
    });
    result.push({
      method: "PATCH",
      template: item,
    });
    result.push({
      method: "DELETE",
      template: item,
    });
  }
  return result;
};

const buildSurface = (
  name: string,
  endpoints: EndpointModel[],
): CoverageSurface => {
  const templates = endpoints.map((endpoint) => endpoint.pathTemplate);
  const collection = pickCollectionTemplate(templates);
  const item = pickItemTemplate(templates, collection);
  const observed = new Set<string>();
  const tiles: CoverageTile[] = endpoints.map((endpoint) => {
    const key = tileKey(endpoint.method, endpoint.pathTemplate);
    observed.add(key);
    return {
      key,
      label: operationVerb(
        endpoint.method,
        endpoint.pathTemplate,
        collection,
        item,
      ),
      method: endpoint.method,
      path: endpoint.pathTemplate,
      sampleCount: endpoint.sampleCount,
      state: observedTileState(endpoint),
    };
  });
  for (const hypothesis of hypotheses(collection, item)) {
    const key = tileKey(hypothesis.method, hypothesis.template);
    if (observed.has(key)) {
      continue;
    }
    observed.add(key);
    tiles.push({
      key,
      label: operationVerb(
        hypothesis.method,
        hypothesis.template,
        collection,
        item,
      ),
      method: hypothesis.method,
      path: hypothesis.template,
      sampleCount: 0,
      state: "hole",
    });
  }
  tiles.sort((left, right) => left.key.localeCompare(right.key));
  return {
    discoveredCount: tiles.filter((tile) => tile.state === "discovered").length,
    holeCount: tiles.filter((tile) => tile.state === "hole").length,
    name,
    tiles,
    totalCount: tiles.length,
    unlockedCount: tiles.filter((tile) => tile.state === "unlocked").length,
  };
};

export const buildCoverage = (model: ApiModel): CoverageMap => {
  const surfaces = model.resources.map((resource) =>
    buildSurface(resource.name, resource.endpoints),
  );
  const unlocked = surfaces.reduce((sum, s) => sum + s.unlockedCount, 0);
  const discovered = surfaces.reduce((sum, s) => sum + s.discoveredCount, 0);
  const holes = surfaces.reduce((sum, s) => sum + s.holeCount, 0);
  const total = unlocked + discovered + holes;
  return {
    generatedAt: new Date().toISOString(),
    host: model.host,
    stats: {
      coverage: total === 0 ? 0 : unlocked / total,
      discovered,
      holes,
      total,
      unlocked,
    },
    surfaces,
  };
};

export const diffCoverage = (
  previous: CoverageMap | null,
  next: CoverageMap,
): CoverageDelta => {
  const previousStates = new Map<string, CoverageTileState>();
  for (const surface of previous?.surfaces ?? []) {
    for (const tile of surface.tiles) {
      previousStates.set(tile.key, tile.state);
    }
  }
  const newlyUnlocked: string[] = [];
  const newTiles: string[] = [];
  for (const surface of next.surfaces) {
    for (const tile of surface.tiles) {
      const before = previousStates.get(tile.key);
      if (before === undefined) {
        newTiles.push(tile.key);
      }
      if (tile.state === "unlocked" && before !== "unlocked") {
        newlyUnlocked.push(tile.key);
      }
    }
  }
  return {
    coverage: next.stats.coverage,
    newlyUnlocked,
    newTiles,
    total: next.stats.total,
    unlocked: next.stats.unlocked,
  };
};
