"use client";

import type { IHeaderParams } from "ag-grid-community";

import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../../../change-spotlight";

import type { GridContext } from "./types";

export function ColumnHeader(props: IHeaderParams) {
  const ctx = props.context as GridContext;
  const columnId = props.column.getColId();
  const isActive = ctx.activeColumnId === columnId;

  return (
    <button
      className={`flex h-full w-full cursor-pointer select-none items-center border-none bg-transparent p-0 text-left text-inherit transition-colors ${
        isActive ? "font-semibold text-orange-700" : ""
      }`}
      onClick={() => ctx.onHeaderClick(columnId)}
      onContextMenu={(e) => {
        e.preventDefault();
        ctx.onHeaderContextMenu(columnId, e.clientX, e.clientY);
      }}
      type="button"
      {...getChangeTargetProps(changeTargetKey.column(columnId))}
    >
      <span className="truncate">{props.displayName}</span>
    </button>
  );
}

// ── Add Column Button (rendered as a header) ────────────

export function AddColumnButton(props: IHeaderParams) {
  const ctx = props.context as GridContext;

  return (
    <button
      className="group/add flex h-full w-full cursor-pointer items-center justify-center border-none bg-transparent p-0"
      onClick={() => ctx.openCreateColumn()}
      type="button"
    >
      <span className="font-medium text-sm text-zinc-400 leading-none transition-colors group-hover/add:text-orange-600">
        +
      </span>
    </button>
  );
}

// ── Cell Renderer ───────────────────────────────────────
