"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type {
  InputHTMLAttributes,
  DragEvent as ReactDragEvent,
  ReactNode,
} from "react";
import { useId, useRef, useState } from "react";
import { cx } from "../utils/cx";

const marbleDropzoneVariants = cva(
  "group/dropzone relative isolate flex w-full flex-col items-center justify-center overflow-hidden rounded-xs border border-dashed text-center outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-orange-400/60",
  {
    defaultVariants: {
      size: "md",
      tone: "neutral",
    },
    variants: {
      disabled: {
        false: "cursor-pointer",
        true: "cursor-not-allowed opacity-60",
      },
      size: {
        md: "min-h-40 gap-3 px-5 py-6",
        sm: "min-h-28 gap-2 px-4 py-4",
      },
      tone: {
        neutral:
          "border-taupe-300 bg-linear-to-b from-white via-white to-taupe-50 text-taupe-800",
        orange:
          "border-orange-200 bg-linear-to-br from-orange-50/90 via-white to-taupe-50 text-taupe-900",
      },
    },
  },
);

const marbleDropzoneIconVariants = cva(
  "flex items-center justify-center rounded-xs border transition-colors",
  {
    defaultVariants: {
      size: "md",
      tone: "neutral",
    },
    variants: {
      size: {
        md: "size-11",
        sm: "size-9",
      },
      tone: {
        neutral: "border-taupe-200 bg-taupe-50 text-orange-600",
        orange: "border-orange-200 bg-orange-50 text-orange-700",
      },
    },
  },
);

function isFileDrag(dataTransfer: DataTransfer | null | undefined) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}

function normalizeFiles(files: FileList | null | undefined) {
  return files ? Array.from(files) : [];
}

export type MarbleDropzoneProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "className" | "onKeyDown" | "size" | "type" | "value"
> &
  VariantProps<typeof marbleDropzoneVariants> & {
    className?: string;
    description?: ReactNode;
    hint?: ReactNode;
    icon?: ReactNode;
    onFilesChange?: (files: File[]) => void;
    title: ReactNode;
  };

export function MarbleDropzone({
  className,
  description,
  disabled = false,
  hint,
  icon,
  id,
  multiple,
  onChange,
  onFilesChange,
  size,
  title,
  tone,
  ...inputProps
}: MarbleDropzoneProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const isDragging = dragDepth > 0;

  const handleFiles = (files: File[]) => {
    if (disabled || files.length === 0) {
      return;
    }

    onFilesChange?.(files);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleDragEnter = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (disabled || !isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setDragDepth((current) => current + 1);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (disabled || !isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setDragDepth((current) => Math.max(0, current - 1));
  };

  const handleDragOver = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (disabled || !isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: ReactDragEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    setDragDepth(0);
    handleFiles(normalizeFiles(event.dataTransfer.files));
  };

  return (
    <div className="w-full">
      <input
        {...inputProps}
        className="sr-only"
        disabled={disabled}
        id={inputId}
        multiple={multiple}
        onChange={(event) => {
          onChange?.(event);
          handleFiles(normalizeFiles(event.target.files));
        }}
        ref={inputRef}
        type="file"
      />

      <button
        aria-controls={inputId}
        className={cx(
          marbleDropzoneVariants({
            disabled,
            size,
            tone,
          }),
          isDragging && "border-orange-400 bg-orange-50/90 text-orange-900",
          className,
        )}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        type="button"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(140%_120%_at_0%_0%,rgba(255,255,255,0.75)_0%,rgba(255,255,255,0)_52%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,245,238,0.92)_100%)] opacity-80"
        />
        <div
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-150",
            isDragging ? "bg-orange-100/55 opacity-100" : "opacity-0",
          )}
        />

        <div className="relative z-10 flex max-w-sm flex-col items-center gap-2">
          {icon ? (
            <div
              className={cx(
                marbleDropzoneIconVariants({
                  size,
                  tone,
                }),
                isDragging && "border-orange-300 bg-white text-orange-700",
              )}
            >
              {icon}
            </div>
          ) : null}

          <div className="space-y-1">
            <p className="font-semibold text-current text-sm">{title}</p>
            {description ? (
              <p className="text-sm text-taupe-600">{description}</p>
            ) : null}
            <p
              className={cx(
                "font-medium text-eyebrow",
                disabled ? "text-taupe-400" : "text-orange-600",
              )}
            >
              {disabled
                ? "Uploads unavailable"
                : multiple
                  ? "Drop files or click to browse"
                  : "Drop a file or click to browse"}
            </p>
            {hint ? <p className="text-taupe-500 text-xs">{hint}</p> : null}
          </div>
        </div>
      </button>
    </div>
  );
}
