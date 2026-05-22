import {
  cx,
  MarbleBadge,
  MarbleCard,
  MarbleCardContent,
  MarbleCardHeader,
  MarbleCardTitle,
} from "@marble/ui";
import { laneStyles } from "./constants";
import {
  formatJson,
  formatMs,
  getLatestWallEntry,
  orderTimingEntriesForDisplay,
  shortId,
} from "./timing";
import type { LaneConfig, LaneState, TimingEntry } from "./types";

const Metric = ({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) => {
  return (
    <div className="min-w-0">
      <div className="font-medium text-eyebrow-xs text-taupe-500">{label}</div>
      <div className="truncate font-mono text-sm text-taupe-950">{value}</div>
    </div>
  );
};

const TimingList = ({
  entries,
}: Readonly<{
  entries: TimingEntry[];
}>) => {
  const orderedEntries = orderTimingEntriesForDisplay(entries);

  if (entries.length === 0) {
    return (
      <p className="border-t border-taupe-200 pt-3 text-sm text-taupe-500">
        No timings yet.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-taupe-200 border-t border-taupe-200 font-mono text-[11px]">
      {orderedEntries.map((entry) => (
        <li
          className={cx(
            "grid grid-cols-[minmax(0,1fr)_4.75rem] gap-2 py-2",
            entry.kind === "wall" ? "bg-taupe-100/70 px-2" : "",
          )}
          key={entry.key}
        >
          <div className="min-w-0">
            <div
              className={cx(
                "truncate",
                entry.kind === "wall" ? "font-semibold" : "",
                entry.status === "error" ? "text-red-700" : "text-taupe-800",
              )}
            >
              {entry.label}
            </div>
            {entry.detail ? (
              <div
                className={cx(
                  "break-words text-taupe-500",
                  entry.status === "error" ? "text-red-600" : "",
                )}
              >
                {entry.detail}
              </div>
            ) : null}
            {entry.runId ? (
              <div className="text-taupe-400">run {shortId(entry.runId)}</div>
            ) : null}
          </div>
          <div
            className={cx(
              "text-right tabular-nums",
              entry.kind === "wall" ? "font-semibold" : "",
              entry.status === "error" ? "text-red-700" : "text-taupe-950",
            )}
          >
            <div>{formatMs(entry.durationMs)}</div>
            {entry.kind === "wall" ? (
              <div className="font-medium text-eyebrow-xs text-taupe-500">
                wall
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
};

export const LanePanel = ({
  lane,
  state,
}: Readonly<{
  lane: LaneConfig;
  state: LaneState;
}>) => {
  const styles = laneStyles[lane.captureKind];
  const latestWall = getLatestWallEntry(state.timings);

  return (
    <MarbleCard className="min-h-[27rem]">
      <MarbleCardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <MarbleCardTitle className="text-sm">{lane.label}</MarbleCardTitle>
            <p
              className={cx(
                "flex items-center gap-1 font-medium text-[11px]",
                styles.textClassName,
              )}
            >
              <span
                className={cx("size-1.5 rounded-full", styles.dotClassName)}
              />
              {lane.createKind === "sdk" ? "new sdk" : "supabase js"} /{" "}
              {lane.captureKind}
            </p>
          </div>
          <MarbleBadge
            tone={state.error ? "error" : state.ready ? "success" : "warning"}
          >
            {state.error ? "Error" : state.status}
          </MarbleBadge>
        </div>
      </MarbleCardHeader>
      <MarbleCardContent className="space-y-4">
        {state.error ? (
          <p
            className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <div className="grid grid-cols-3 gap-3 border-t border-taupe-200 pt-4">
          <Metric
            label="Last event"
            value={state.latestEvent ? shortId(state.latestEvent.id) : "none"}
          />
          <Metric
            label="Last update"
            value={latestWall ? formatMs(latestWall.durationMs) : "none"}
          />
          <Metric
            label="Timings"
            value={String(state.timings.length)}
          />
        </div>

        <div className="space-y-2">
          <div className="font-medium text-eyebrow-xs text-taupe-500">
            Payload
          </div>
          <pre className="min-h-32 overflow-auto rounded-sm border border-taupe-200 bg-white p-3 font-mono text-[11px] text-taupe-800 leading-5">
            {state.latestEvent
              ? formatJson(state.latestEvent.rawPayload)
              : "No event captured yet."}
          </pre>
        </div>

        <TimingList entries={state.timings} />
      </MarbleCardContent>
    </MarbleCard>
  );
};

export const TimingPanel = ({
  entries,
}: Readonly<{
  entries: TimingEntry[];
}>) => {
  if (entries.length === 0) {
    return null;
  }

  return (
    <MarbleCard>
      <MarbleCardHeader>
        <MarbleCardTitle>Combined timeline</MarbleCardTitle>
      </MarbleCardHeader>
      <MarbleCardContent>
        <ol className="space-y-1 font-mono text-[11px] text-taupe-600">
          {entries.map((entry) => (
            <li
              className="grid grid-cols-[4rem_9rem_minmax(0,1fr)_4.5rem] gap-2"
              key={entry.key}
            >
              <span className="tabular-nums">+{formatMs(entry.elapsedMs)}</span>
              <span className="truncate font-medium">{entry.laneId}</span>
              <span
                className={cx(
                  "truncate",
                  entry.status === "error" ? "text-red-700" : "",
                )}
              >
                {entry.label}
              </span>
              <span className="text-right tabular-nums">
                {formatMs(entry.durationMs)}
              </span>
            </li>
          ))}
        </ol>
      </MarbleCardContent>
    </MarbleCard>
  );
};
