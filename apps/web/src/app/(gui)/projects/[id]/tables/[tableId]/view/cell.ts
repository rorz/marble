import { parseProgramConfigFromFiles } from "@marble/contracts";
import type { Cell, Column } from "./types";

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

const getProgramFiles = (
  programVersion: unknown,
): Array<{
  content: string;
  filename: string;
}> => {
  if (!programVersion || typeof programVersion !== "object") return [];
  const record = programVersion as Record<string, unknown>;
  const files = record.programFiles;

  if (!Array.isArray(files)) {
    return [];
  }

  return files.flatMap((file) => {
    if (!file || typeof file !== "object") {
      return [];
    }

    const entry = file as Record<string, unknown>;

    return typeof entry.content === "string" &&
      typeof entry.filename === "string"
      ? [
          {
            content: entry.content,
            filename: entry.filename,
          },
        ]
      : [];
  });
};

const getProgramConfig = (
  source: unknown,
): {
  inputSchema: Record<string, unknown>;
  outputConfig: Record<string, unknown>;
} | null => {
  try {
    return parseProgramConfigFromFiles(getProgramFiles(source));
  } catch (error) {
    void error;
    return null;
  }
};

export const getProgramOutputConfig = (
  source: unknown,
): Record<string, unknown> | null => {
  return getProgramConfig(source)?.outputConfig ?? null;
};

export const getProgramInputSchema = (
  source: unknown,
): Record<string, unknown> | null => {
  return getProgramConfig(source)?.inputSchema ?? null;
};

export const isManualInputColumn = (column: Column): boolean => {
  const config = getProgramOutputConfig(column.programVersion) as {
    flags?: {
      allowManualInput?: boolean;
    };
  } | null;
  return config?.flags?.allowManualInput === true;
};
