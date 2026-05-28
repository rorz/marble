"use client";

import Prism from "prismjs";
import { useMemo } from "react";
import Editor from "react-simple-code-editor";
import type { ReferenceableColumn } from "./types";

export const escapeChangeTargetSelector = (value: string) => {
  if (typeof window !== "undefined" && window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return value.replaceAll('"', '\\"');
};

// ── Components ──────────────────────────────────────────

export const InterpolationEditor = ({
  value,
  onChange,
  placeholder,
  currentTableId,
  referenceColumns,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  currentTableId?: string;
  referenceColumns: ReferenceableColumn[];
}) => {
  const validTokens = useMemo(
    () =>
      new Set(
        referenceColumns.flatMap((column) =>
          column.tableId === currentTableId
            ? [
                column.label,
                column.name,
                `col.${column.id}`,
              ]
            : [
                column.label,
                `col.${column.id}`,
              ],
        ),
      ),
    [
      currentTableId,
      referenceColumns,
    ],
  );

  // Custom prism grammar for our interpolation tags
  const grammar = useMemo(() => {
    return {
      interpolation: {
        inside: {
          "col-name": {
            alias: "keyword",
            // Match the column name component (which may include spaces)
            // It stops at the first unescaped dot, square bracket, or the opening/closing braces.
            pattern:
              /^col\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|^([^{}.[\]]+)/i,
          },
          "col-path": {
            alias: "property",
            // Match the property path dot-notation or array indexing
            pattern: /^[.[][^\s}]+/,
          },
          "invalid-text": {
            alias: "invalid",
            pattern: /[^}]+/,
          },
          "tag-close": {
            alias: "punctuation",
            pattern: /\}\}$/,
          },
          "tag-open": {
            alias: "punctuation",
            pattern: /^\{\{/,
          },
        },
        pattern: /\{\{[^}]+\}\}/,
      },
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded border border-zinc-300 bg-white text-xs transition-all focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500">
      <Editor
        className="min-h-[40px] font-mono"
        highlight={(code) => {
          let html = Prism.highlight(code, grammar, "interpolation");

          // Post-process the generated HTML to validate column names visually
          // Prism produces tokens like: <span class="token keyword col-name">Project / Table / Column</span>
          const regex = /<span class="token keyword col-name">([^<]+)<\/span>/g;
          html = html.replace(regex, (match, name) => {
            const isValid = validTokens.has(name);
            if (!isValid) {
              return `<span class="token keyword col-name invalid" title="Unrecognized column name">${name}</span>`;
            }
            return match;
          });

          return html;
        }}
        onValueChange={onChange}
        padding={8}
        placeholder={placeholder}
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
        }}
        textareaClassName="focus:outline-none"
        value={value}
      />
      <style>{`
        /* Custom Prism styles for interpolation. Colors map to Tailwind tokens. */
        .token.interpolation {
          color: var(--color-orange-600);
          background: var(--color-orange-50);
          border-radius: 2px;
          padding: 0 2px;
        }
        .token.tag-open, .token.tag-close { opacity: 0.5; }
        .token.col-name { font-weight: 600; }
        .token.col-name.invalid, .token.invalid-text {
          color: var(--color-zinc-400);
          font-weight: normal;
          text-decoration: underline dotted var(--color-red-400);
        }
        .token.col-path { color: var(--color-orange-800) !important; }
      `}</style>
    </div>
  );
};

// ── Component ───────────────────────────────────────────
