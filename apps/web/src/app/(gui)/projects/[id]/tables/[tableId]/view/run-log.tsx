"use client";

import {
  MarbleButton,
  MarbleSheet,
  MarbleSheetClose,
  MarbleSheetContent,
  MarbleSheetDescription,
  MarbleSheetFooter,
  MarbleSheetHeader,
  MarbleSheetTitle,
} from "@marble/ui";

const getRunLogLineClassName = (line: string) => {
  if (line.includes("✗")) {
    return "text-red-400";
  }

  if (line.includes("✓")) {
    return "text-green-600";
  }

  if (line.includes("skip")) {
    return "text-blue-500";
  }

  return "text-zinc-500";
};

export const RunLogSheet = ({
  lines,
  onClear,
  onOpenChange,
  open,
}: {
  lines: string[];
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  return (
    <MarbleSheet
      modal={false}
      onOpenChange={onOpenChange}
      open={open}
    >
      <MarbleSheetContent
        className="border-x-0 border-b-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        showBackdrop={false}
        side="bottom"
      >
        <MarbleSheetHeader className="relative pr-14">
          <MarbleSheetTitle>Run Log</MarbleSheetTitle>
          <MarbleSheetDescription>
            Recent execution output for this table.
          </MarbleSheetDescription>
          <MarbleSheetClose className="absolute top-3 right-3" />
        </MarbleSheetHeader>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {lines.length > 0 ? (
            <pre className="space-y-0.5 font-mono text-xs">
              {lines.map((line, index) => (
                <div
                  className={getRunLogLineClassName(line)}
                  // biome-ignore lint/suspicious/noArrayIndexKey: log
                  key={`${index}-${line.slice(0, 20)}`}
                >
                  {line}
                </div>
              ))}
            </pre>
          ) : (
            <p className="text-sm text-zinc-500">no logs</p>
          )}
        </div>

        <MarbleSheetFooter>
          <MarbleButton onClick={onClear}>Clear</MarbleButton>
          <MarbleSheetClose className="h-auto w-auto rounded-xs border border-taupe-200 px-3 py-1.5 text-sm text-taupe-700">
            Close
          </MarbleSheetClose>
        </MarbleSheetFooter>
      </MarbleSheetContent>
    </MarbleSheet>
  );
};

// ── Custom Column Header ────────────────────────────────
