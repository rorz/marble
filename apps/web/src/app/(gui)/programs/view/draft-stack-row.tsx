import { MarbleBadge } from "@marble/ui";

import type { PendingChange } from "./types";

export const DraftStackRow = ({
  change,
}: Readonly<{
  change: PendingChange;
}>) => {
  const toneClassName =
    change.badgeTone === "info"
      ? {
          badge: "info" as const,
          text: "text-sky-700",
        }
      : change.badgeTone === "warning"
        ? {
            badge: "warning" as const,
            text: "text-amber-700",
          }
        : {
            badge: "neutral" as const,
            text: "text-taupe-600",
          };

  return (
    <div className="border-b border-taupe-400/80 px-3 py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 font-medium text-[12px] text-taupe-950">
          {change.label}
        </div>
        <MarbleBadge
          className={toneClassName.text}
          tone={toneClassName.badge}
        >
          {change.tag}
        </MarbleBadge>
      </div>
      <div className="mt-1 text-[11px] leading-4 text-taupe-600">
        {change.summary}
      </div>
    </div>
  );
};
