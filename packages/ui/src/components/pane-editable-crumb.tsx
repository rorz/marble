"use client";

import {
  MarbleEditableText,
  type MarbleEditableTextProps,
} from "./editable-text";
import { marblePaneInteractiveCrumbClassName } from "./pane";

export function MarblePaneEditableCrumb(props: MarbleEditableTextProps) {
  return (
    <MarbleEditableText
      {...props}
      className={marblePaneInteractiveCrumbClassName}
    />
  );
}
