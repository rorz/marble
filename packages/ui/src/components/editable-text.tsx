import { useEffect, useRef } from "react";
import { cx } from "../utils/cx";

export type MarbleEditableTextProps = {
  className?: string;
  disabled?: boolean;
  editing: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onEdit: () => void;
  value: string;
};

export const MarbleEditableText = ({
  className,
  disabled = false,
  editing,
  onCancel,
  onChange,
  onCommit,
  onEdit,
  value,
}: MarbleEditableTextProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [
    editing,
  ]);

  return (
    <span
      className={cx(
        "inline-grid min-w-[1ch] max-w-full align-top",
        disabled ? "cursor-not-allowed opacity-50" : "",
        className,
        editing
          ? "bg-white/90 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-orange-500)_24%,transparent)]"
          : "",
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none invisible col-start-1 row-start-1 whitespace-pre"
      >
        {value || " "}
      </span>

      {editing ? (
        <input
          className="col-start-1 row-start-1 w-full min-w-0 appearance-none border-0 bg-transparent text-inherit outline-none ring-0 [font:inherit] [letter-spacing:inherit]"
          disabled={disabled}
          onBlur={onCommit}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit();
            }

            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          ref={inputRef}
          spellCheck={false}
          value={value}
        />
      ) : (
        <button
          className="col-start-1 row-start-1 min-w-0 cursor-text bg-transparent text-inherit [font:inherit] [letter-spacing:inherit]"
          disabled={disabled}
          onClick={onEdit}
          type="button"
        >
          {value}
        </button>
      )}
    </span>
  );
};
