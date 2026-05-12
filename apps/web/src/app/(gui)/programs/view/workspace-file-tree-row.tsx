import { cx } from "@marble/ui";
import { FileTextIcon } from "@phosphor-icons/react/dist/ssr";

import { getChangeTargetProps } from "../../change-spotlight";
import {
  compactSidebarRowActiveClassName,
  compactSidebarRowClassName,
  compactSidebarRowIdleClassName,
} from "./constants";
import { getFileAccent } from "./files";
import type { EditableProgramFile } from "./types";

export function WorkspaceFileTreeRow({
  active,
  dirty,
  file,
  onSelect,
  targetKey,
}: Readonly<{
  active: boolean;
  dirty: boolean;
  file: EditableProgramFile;
  onSelect: () => void;
  targetKey?: string;
}>) {
  return (
    <button
      className={cx(
        compactSidebarRowClassName,
        active
          ? compactSidebarRowActiveClassName
          : compactSidebarRowIdleClassName,
      )}
      onClick={onSelect}
      type="button"
      {...(targetKey ? getChangeTargetProps(targetKey) : {})}
    >
      <FileTextIcon
        className={cx("shrink-0", getFileAccent(file.filename))}
        size={14}
      />
      <span className="min-w-0 flex-1 truncate">{file.filename}</span>
      {dirty ? <span className="size-1.5 rounded-full bg-orange-500" /> : null}
    </button>
  );
}
