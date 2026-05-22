import { cx } from "@marble/ui";
import { RobotIcon } from "@phosphor-icons/react";
import { formatUnreadCount } from "./event-snapshot";

export const ChangeRadarTrigger = ({
  className,
  onToggleSidebar,
  unreadCount,
}: Readonly<{
  className?: string;
  onToggleSidebar?: () => void;
  unreadCount: number;
}>) => {
  return (
    <button
      aria-label={`Expand agent sidebar${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      className={cx(
        "relative flex size-9 items-center justify-center rounded-full border border-taupe-300/80 bg-white/95 text-taupe-600 shadow-[0_8px_18px_rgba(84,57,26,0.14)] transition-[background-color,color,box-shadow,transform] hover:bg-white hover:text-taupe-950 hover:shadow-[0_12px_24px_rgba(84,57,26,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300",
        className,
      )}
      onClick={onToggleSidebar}
      title="Expand agent sidebar"
      type="button"
    >
      <RobotIcon
        aria-hidden="true"
        className="size-5"
        weight={unreadCount > 0 ? "fill" : "regular"}
      />
      {unreadCount > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-white bg-orange-500 px-1 font-mono text-[9px] leading-4 text-white shadow-[0_6px_12px_rgba(84,57,26,0.16)]">
          {formatUnreadCount(unreadCount)}
        </span>
      ) : null}
    </button>
  );
};
