import { MarbleInput } from "./input";

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

export function MarbleEditableText({
  className,
  disabled = false,
  editing,
  onCancel,
  onChange,
  onCommit,
  onEdit,
  value,
}: MarbleEditableTextProps) {
  if (editing) {
    return (
      <MarbleInput
        autoFocus
        className={className}
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
        value={value}
      />
    );
  }

  return (
    <button
      className={className}
      disabled={disabled}
      onClick={onEdit}
      type="button"
    >
      {value}
    </button>
  );
}
