import type { Cell, Column } from "./types";

export { getErrorMessage } from "@marble/lib/result";

type CellState =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      error: unknown;
      message: string;
    }
  | {
      ok: null;
    }
  | null;

export const getCellState = (cell: Cell | undefined): CellState => {
  if (!cell) return null;
  return cell.state as CellState;
};

export const isTerminalCellState = (state: CellState) => {
  return state?.ok === true || state?.ok === false;
};

export const isRunningCellState = (state: CellState) => {
  return state?.ok === null;
};

export const displayCellValue = (cell: Cell | undefined): string => {
  const state = getCellState(cell);
  if (!state) return cell?.manualInput ?? "";
  if (state.ok === null) return "⏳";
  if (state.ok === true) {
    const v = state.value;
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  }
  if (state.ok === false) return `⚠ ${state.message}`;
  return cell?.manualInput ?? "";
};

export const describeRunOutput = (output: unknown) => {
  if (!output || typeof output !== "object") {
    return JSON.stringify(output);
  }

  const record = output as {
    message?: unknown;
    value?: unknown;
  };

  if (typeof record.message === "string") {
    return record.message;
  }

  return JSON.stringify(record.value ?? output);
};

export const getProgramOutputConfig = (
  programVersion: unknown,
): Record<string, unknown> | null => {
  if (!programVersion || typeof programVersion !== "object") return null;
  const record = programVersion as Record<string, unknown>;
  const config = record.outputConfig;
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  return config as Record<string, unknown>;
};

export const getProgramInputSchema = (
  programVersion: unknown,
): Record<string, unknown> | null => {
  if (!programVersion || typeof programVersion !== "object") return null;
  const record = programVersion as Record<string, unknown>;
  const schema = record.inputSchema;
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return null;
  return schema as Record<string, unknown>;
};

export const isManualInputColumn = (column: Column): boolean => {
  const config = getProgramOutputConfig(column.programVersion) as {
    flags?: {
      allowManualInput?: boolean;
    };
  } | null;
  return config?.flags?.allowManualInput === true;
};
