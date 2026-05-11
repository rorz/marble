import { cx } from "../utils/cx";

type MarbleBrandMarkProps = {
  className?: string;
};

export function MarbleBrandMark({ className }: MarbleBrandMarkProps) {
  return (
    <div
      className={cx(
        "relative flex size-8 shrink-0 items-center justify-center rounded-xs border border-orange-200/80 bg-white shadow-marble-highlight-strong",
        className,
      )}
    >
      <div className="size-4 rounded-full border border-taupe-500 bg-taupe-100" />
      <div className="absolute top-1.5 right-1.5 size-2 rounded-full border border-white bg-orange-400" />
    </div>
  );
}
