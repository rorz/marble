import { cx } from "@marble/ui";
import { probeStyles } from "./styles";
import { formatMs } from "./timing";
import type { MixedTelemetryEntry, ProbeState } from "./types";

export const ProbeDbState = ({
  probe,
}: Readonly<{
  probe: ProbeState;
}>) => {
  const styles = probeStyles[probe.kind];

  return (
    <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-start gap-2">
      <span
        className={cx(
          "flex items-center justify-end gap-1 pt-2 font-medium text-xs",
          styles.textClassName,
        )}
      >
        <span className={cx("size-1.5 rounded-full", styles.dotClassName)} />
        {styles.shortLabel}
      </span>
      <p
        className={cx(
          "min-h-9 rounded-sm border border-dashed px-2 py-1.5 text-base text-neutral-900",
          styles.dbStateClassName,
        )}
      >
        {probe.dbValue}
      </p>
      {probe.error ? (
        <p
          className="col-start-2 text-sm text-red-700"
          role="alert"
        >
          {probe.error}
        </p>
      ) : null}
    </div>
  );
};

export const MixedTelemetry = ({
  entries,
}: Readonly<{
  entries: MixedTelemetryEntry[];
}>) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <ol className="space-y-1 border-neutral-200 border-t pt-3 font-mono text-[11px] leading-4 text-neutral-500">
      {entries.map((entry) => {
        const styles = probeStyles[entry.kind];

        return (
          <li
            className="grid grid-cols-[4rem_5.75rem_minmax(0,1fr)_4rem] gap-2"
            key={entry.key}
          >
            <span className="tabular-nums">+{formatMs(entry.elapsedMs)}</span>
            <span
              className={cx(
                "flex items-center gap-1 font-medium",
                styles.textClassName,
              )}
            >
              <span
                className={cx("size-1.5 rounded-full", styles.dotClassName)}
              />
              {styles.shortLabel}
            </span>
            <span>{entry.label}</span>
            <span className="text-right tabular-nums">
              {typeof entry.durationMs === "number"
                ? formatMs(entry.durationMs)
                : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
