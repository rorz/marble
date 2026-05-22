import type { ProbeKind } from "./types";

export const probeStyles = {
  broadcast: {
    dbStateClassName: "border-emerald-300 bg-emerald-50/70",
    dotClassName: "bg-emerald-500",
    label: "Broadcast",
    shortLabel: "broadcast",
    telemetryClassName: "border-emerald-400",
    textClassName: "text-emerald-700",
  },
  postgres: {
    dbStateClassName: "border-sky-300 bg-sky-50/70",
    dotClassName: "bg-sky-500",
    label: "Postgres Changes",
    shortLabel: "postgres",
    telemetryClassName: "border-sky-400",
    textClassName: "text-sky-700",
  },
} satisfies Record<
  ProbeKind,
  {
    dbStateClassName: string;
    dotClassName: string;
    label: string;
    shortLabel: string;
    telemetryClassName: string;
    textClassName: string;
  }
>;
