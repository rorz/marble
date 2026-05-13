"use client";

import { MarbleEditableText } from "@marble/ui";

export const EditableName = ({
  className,
  disabled,
  editing,
  name,
  onCancel,
  onChange,
  onCommit,
  onEdit,
}: {
  className: string;
  disabled: boolean;
  editing: boolean;
  name: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onCommit: () => void;
  onEdit: () => void;
}) => {
  return (
    <MarbleEditableText
      className={className}
      disabled={disabled}
      editing={editing}
      onCancel={onCancel}
      onChange={onChange}
      onCommit={onCommit}
      onEdit={onEdit}
      value={name}
    />
  );
};
