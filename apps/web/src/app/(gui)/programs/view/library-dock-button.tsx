import { cx } from "@marble/ui";
import type { ReactNode } from "react";

export function LibraryDockButton({
  active,
  count,
  icon,
  label,
  onClick,
  subtitle,
}: Readonly<{
  active: boolean;
  count?: number;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  subtitle: string;
}>) {
  return (
    <button
      className={cx(
        "group flex w-[7.25rem] flex-col items-center rounded-[1.25rem] border px-3 py-3 text-center transition-all",
        active
          ? "border-orange-300 bg-orange-50/80 shadow-[0_18px_34px_rgba(154,87,19,0.12)]"
          : "border-taupe-300 bg-white/90 shadow-[0_14px_28px_rgba(84,57,26,0.08)] hover:-translate-y-0.5 hover:border-orange-200",
      )}
      onClick={onClick}
      type="button"
    >
      <div
        className={cx(
          "mb-3 flex size-12 items-center justify-center rounded-2xl border transition-transform group-hover:-translate-y-0.5",
          active
            ? "border-orange-200 bg-white text-orange-600"
            : "border-taupe-200 bg-taupe-50 text-taupe-700",
        )}
      >
        {icon}
      </div>
      <span className="font-medium text-[13px] text-taupe-950">{label}</span>
      <span className="mt-1 text-[11px] text-taupe-500">{subtitle}</span>
      {count !== undefined ? (
        <span className="mt-3 rounded-full border border-taupe-200 bg-white px-2 py-0.5 font-mono text-[11px] text-taupe-700">
          {count}
        </span>
      ) : null}
    </button>
  );
}
