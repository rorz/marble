"use client";

import { cx } from "@marble/ui";
import type { CustomCellRendererProps } from "ag-grid-react";

import {
  changeTargetKey,
  getChangeTargetProps,
} from "../../../../../change-spotlight";

import { isRunningCellState } from "./cell";
import type { CellState, GridContext } from "./types";

export const RowNumberCell = (props: CustomCellRendererProps) => {
  const rowId = props.data?._rowId as string | undefined;

  return (
    <div
      className="flex h-full items-center"
      {...(rowId ? getChangeTargetProps(changeTargetKey.row(rowId)) : {})}
    >
      {props.valueFormatted ?? props.value}
    </div>
  );
};

const CellRunningIndicator = () => {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-0 overflow-hidden bg-zinc-100/80 inset-shadow-sm"
      style={{
        left: "calc(var(--marble-table-cell-padding-inline, 0px) * -1)",
        right: "calc(var(--marble-table-cell-padding-inline, 0px) * -1)",
      }}
    >
      <style>{`
        @keyframes motlo-breathe {
          0%, 100% { opacity: 0.18; }
          50% { opacity: 0.24; }
        }
      `}</style>

      <div
        className="absolute inset-0"
        style={{
          animation: "motlo-breathe 5.6s ease-in-out infinite",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.2) 48%, rgba(255,255,255,0.1) 100%)",
        }}
      />

      <div
        className="absolute inset-0 overflow-hidden opacity-[0.07] mix-blend-overlay"
        style={{
          animation: "motlo-breathe 6.8s ease-in-out infinite",
        }}
      >
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "6px 6px",
          }}
        />
      </div>

      <div className="absolute inset-x-0 top-0 h-px bg-white/55" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-200/65" />
    </div>
  );
};

export const CellWithRunButton = (props: CustomCellRendererProps) => {
  const columnId = props.colDef?.field;
  const rowId = props.data?._rowId as string | undefined;
  const ctx = props.context as GridContext;

  const state = columnId
    ? (props.data?.[`_state:${columnId}`] as CellState)
    : null;
  const isLoading = isRunningCellState(state);
  const isFailed = state?.ok === false;
  const isNull = !state;

  return (
    <div
      className="group/cell relative flex h-full w-full items-center"
      {...(columnId && rowId
        ? getChangeTargetProps(changeTargetKey.cell(rowId, columnId))
        : {})}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center bg-taupe-50"
        style={{
          left: "calc(var(--marble-table-cell-padding-inline, 0px) * -1)",
          width: "var(--marble-table-cell-led-gutter-width, 0px)",
        }}
      >
        <div className="flex w-full h-full flex-col items-center justify-evenly gap-[3px]">
          <span
            className={cx(
              "block size-1 rounded-[1px] bg-amber-200/20 transition-all",
              isLoading &&
                "animate-blink duration-75 bg-amber-400 shadow-[0_0_2px_rgba(251,146,60,0.55)]",
            )}
          />
          <span
            className={cx(
              "block size-1 rounded-[1px] bg-zinc-300/20 transition-all",
              state?.ok === true &&
                "bg-green-300 shadow-[0_0_2px_oklch(89.7%_0.196_126.665)]",
              isFailed && "bg-red-400 shadow-[0_0_2px_rgba(239,68,68,0.55)]",
            )}
          />
        </div>
      </div>
      {isLoading ? <CellRunningIndicator /> : null}
      <div
        className="relative z-10 flex min-w-0 flex-1 items-center"
        style={{
          paddingLeft: "var(--marble-table-cell-content-padding-left, 0px)",
        }}
      >
        {isFailed ? (
          <span
            className="block min-w-0 overflow-hidden text-ellipsis text-red-500 text-xs"
            title={state.message}
          >
            ⚠ {state.message}
          </span>
        ) : isNull ? (
          <span className="text-xs text-zinc-300">—</span>
        ) : isLoading ? null : (
          <span className="block min-w-0 overflow-hidden text-ellipsis">
            {props.valueFormatted ?? props.value}
          </span>
        )}
      </div>
      {columnId && rowId && !isLoading && (
        <button
          className="absolute top-1/2 right-0.5 z-30 hidden h-[18px] w-[18px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm border border-zinc-200 bg-white text-[8px] text-orange-600 leading-none group-hover/cell:flex"
          onClick={(e) => {
            e.stopPropagation();
            ctx.runCell?.(columnId, rowId);
          }}
          title="Run this cell"
          type="button"
        >
          ▶
        </button>
      )}
    </div>
  );
};
