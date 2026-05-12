import { cx, MarbleBadge } from "@marble/ui";

import { DATE_TIME_FORMATTER } from "./constants";
import type {
  ProgramVersionWithFiles,
  PublishedProgramVersionWithFiles,
} from "./types";

export function CurrentWorkspaceRow({
  active,
  draftVersion,
  latestPublishedVersion,
  onSelect,
}: Readonly<{
  active: boolean;
  draftVersion: ProgramVersionWithFiles | null;
  latestPublishedVersion: PublishedProgramVersionWithFiles | null;
  onSelect: () => void;
}>) {
  const timestamp =
    draftVersion?.updatedAt ?? latestPublishedVersion?.updatedAt;

  return (
    <button
      className={cx(
        "w-full border-b border-taupe-400/80 px-3 py-2 text-left transition-colors",
        active
          ? "bg-white/85 text-taupe-950"
          : "bg-transparent text-taupe-800 hover:bg-white/60",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-taupe-900">
            {draftVersion ? "Draft" : "Current"}
          </span>
          <MarbleBadge
            caps
            tone={draftVersion ? "warning" : "neutral"}
          >
            {draftVersion ? "Editable" : "Live"}
          </MarbleBadge>
        </div>
        {timestamp ? (
          <span className="text-[11px] text-taupe-500">
            {DATE_TIME_FORMATTER.format(new Date(timestamp))}
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-[11px] text-taupe-600">
        {draftVersion && latestPublishedVersion
          ? `Draft workspace forked from v${latestPublishedVersion.version}.`
          : latestPublishedVersion
            ? `Published v${latestPublishedVersion.version} is currently live.`
            : "Unsaved workspace."}
      </div>
    </button>
  );
}
