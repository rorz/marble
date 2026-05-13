import { cx, MarbleBadge } from "@marble/ui";

import { getChangeTargetProps } from "../../change-spotlight";
import { DATE_TIME_FORMATTER } from "./constants";
import { countLabel } from "./programs";
import type { ProgramVersionWithFiles } from "./types";

export const VersionHistoryRow = ({
  active,
  activeBadge,
  onSelect,
  targetKey,
  version,
}: Readonly<{
  active: boolean;
  activeBadge?: string;
  onSelect?: () => void;
  targetKey?: string;
  version: ProgramVersionWithFiles;
}>) => {
  return (
    <button
      className={cx(
        "w-full border-b border-taupe-400/80 px-3 py-2 text-left transition-colors last:border-b-0",
        active
          ? "bg-white/85 text-taupe-950"
          : "bg-transparent text-taupe-800 hover:bg-white/60",
      )}
      onClick={onSelect}
      type="button"
      {...(targetKey ? getChangeTargetProps(targetKey) : {})}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-taupe-900">
            v{version.version}
          </span>
          {active ? (
            <MarbleBadge
              caps
              tone="warning"
            >
              {activeBadge ?? "Viewing"}
            </MarbleBadge>
          ) : null}
        </div>
        <span className="text-[11px] text-taupe-500">
          {DATE_TIME_FORMATTER.format(new Date(version.updatedAt))}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-taupe-600">
        {countLabel(version.programFiles.length, "file")} in this snapshot
      </div>
    </button>
  );
};
