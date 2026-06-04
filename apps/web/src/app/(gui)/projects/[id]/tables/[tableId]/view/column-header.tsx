"use client";

import { PlayIcon } from "@phosphor-icons/react/ssr";
import type { IHeaderParams } from "ag-grid-community";

import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../../../change-spotlight";

import type { GridContext } from "./types";

export const ColumnHeader = (props: IHeaderParams) => {
  const ctx = props.context as GridContext;
  const columnId = props.column.getColId();
  const isActive = ctx.activeColumnId === columnId;

  return (
    <div
      className="group/header flex h-full w-full select-none items-center"
      {...getChangeTargetProps(changeTargetKey.column(columnId))}
    >
      <button
        className={`flex h-full min-w-0 flex-1 cursor-pointer items-center border-none bg-transparent p-0 text-left text-inherit transition-colors ${
          isActive ? "font-semibold text-orange-700" : ""
        }`}
        onClick={() => ctx.onHeaderClick(columnId)}
        onContextMenu={(e) => {
          e.preventDefault();
          ctx.onHeaderContextMenu(columnId, e.clientX, e.clientY);
        }}
        type="button"
      >
        <span className="truncate">{props.displayName}</span>
      </button>

      <div className="ml-1 hidden shrink-0 items-stretch overflow-hidden rounded-sm border border-zinc-200 bg-white text-[9px] leading-none group-hover/header:flex">
        <button
          className="flex cursor-pointer items-center gap-0.5 border-zinc-200 border-r px-1 py-0.5 text-orange-600 transition-colors hover:bg-orange-50"
          onClick={(e) => {
            e.stopPropagation();
            ctx.requestRunColumnCount(columnId);
          }}
          title="Run the first N cells"
          type="button"
        >
          <PlayIcon
            size={8}
            weight="fill"
          />
          N
        </button>
        <button
          className="cursor-pointer border-zinc-200 border-r px-1 py-0.5 text-orange-600 transition-colors hover:bg-orange-50"
          onClick={(e) => {
            e.stopPropagation();
            ctx.runColumnTen(columnId);
          }}
          title="Run the first 10 cells"
          type="button"
        >
          10
        </button>
        <button
          className="cursor-pointer px-1 py-0.5 text-orange-600 transition-colors hover:bg-orange-50"
          onClick={(e) => {
            e.stopPropagation();
            ctx.requestRunColumnAll(columnId);
          }}
          title="Run every cell"
          type="button"
        >
          All
        </button>
      </div>
    </div>
  );
};

// ── Add Column Button (rendered as a header) ────────────

export const AddColumnButton = (props: IHeaderParams) => {
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
};

// ── Cell Renderer ───────────────────────────────────────
