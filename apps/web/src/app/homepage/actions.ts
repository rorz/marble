"use server";

import "server-only";
import { createServiceRoleClient } from "../../lib/supabase/service-role";
import type { MarketingSkyscraperProps } from "./ui/skyline";

/**
 * Server-side platform metrics for the marketing homepage. Counts are
 * pulled with the service-role client (RLS bypassed) since this page is
 * public and the numbers shown are intentionally non-sensitive
 * aggregate signals.
 *
 * No new API resource is introduced — this is a route-boundary
 * helper. If we ever need to expose stats externally we can promote
 * these queries to a proper `stats` resource (contracts + router +
 * store).
 */

export type MarketingMetrics = {
  cells: number;
  runs: number;
  programs: number;
  agents: number;
  projects: number;
  sourceEvents: number;
  /** Top program names (most recently created), used to seed the skyline. */
  programNames: string[];
};

const FALLBACK_METRICS: MarketingMetrics = {
  agents: 0,
  cells: 0,
  programNames: [],
  programs: 0,
  projects: 0,
  runs: 0,
  sourceEvents: 0,
};

export async function getMarketingMetrics(): Promise<MarketingMetrics> {
  try {
    const supabase = createServiceRoleClient();

    const [
      cells,
      runs,
      programs,
      agents,
      projects,
      sourceEvents,
      programNames,
    ] = await Promise.all([
      supabase.from("cell").select("*", {
        count: "exact",
        head: true,
      }),
      supabase.from("program_run").select("*", {
        count: "exact",
        head: true,
      }),
      supabase.from("program").select("*", {
        count: "exact",
        head: true,
      }),
      supabase
        .from("profile")
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("type", "Agent"),
      supabase.from("project").select("*", {
        count: "exact",
        head: true,
      }),
      supabase.from("source_event").select("*", {
        count: "exact",
        head: true,
      }),
      supabase
        .from("program")
        .select("name")
        .order("created_at", {
          ascending: false,
        })
        .limit(12),
    ]);

    return {
      agents: agents.count ?? 0,
      cells: cells.count ?? 0,
      programNames: (programNames.data ?? []).map((row) => row.name),
      programs: programs.count ?? 0,
      projects: projects.count ?? 0,
      runs: runs.count ?? 0,
      sourceEvents: sourceEvents.count ?? 0,
    };
  } catch (_err) {
    // Marketing page must never break. Quietly degrade to zeros and
    // let the demo skyline render synthetic content.
    return FALLBACK_METRICS;
  }
}

/**
 * Convert real program names into a deterministic skyline. If we have
 * fewer than 12 real programs, pad with demo names so the silhouette
 * still reads as a full city.
 */

const PAD_PROGRAM_NAMES = [
  "lead_score",
  "enrich",
  "summarize",
  "qualify",
  "web_research",
  "classify",
  "extract",
  "translate",
  "annotate",
  "email_draft",
  "score",
  "dedupe",
] as const;

export async function getMarketingSkyline(
  metrics: MarketingMetrics,
): Promise<MarketingSkyscraperProps[]> {
  const names = [
    ...metrics.programNames,
    ...PAD_PROGRAM_NAMES,
  ].slice(0, 12);

  return names.map((name, index) => {
    const seed = hashName(name);
    const rows = 12 + (seed % 18); // 12..29 rows tall
    const widthSeed = seed % 7;
    const width: MarketingSkyscraperProps["width"] =
      widthSeed < 2 ? "sm" : widthSeed > 5 ? "lg" : "md";
    const cellCount =
      // If we have a real total, distribute roughly proportional to
      // tower height so taller towers carry more cells. Add jitter so
      // counts look organic.
      metrics.cells > 0
        ? Math.max(12, Math.floor(metrics.cells * (rows / 250) + (seed % 64)))
        : 200 + (seed % 1800);
    const status: MarketingSkyscraperProps["status"] =
      // Most are running, occasional queued/idle for visual texture.
      seed % 11 === 0 ? "queued" : seed % 17 === 0 ? "idle" : "running";

    return {
      cellCount,
      code: `C${index + 1}`,
      name,
      rows,
      status,
      width,
    };
  });
}

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash;
}
