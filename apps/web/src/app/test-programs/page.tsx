"use client";

import { useCallback, useEffect, useState } from "react";
import * as actions from "./actions";

type Program = Awaited<ReturnType<typeof actions.listPrograms>>[number];

// Win NT style constants
const NT = {
  bg: "#c0c0c0",
  darkEdge: "#808080",
  darkerEdge: "#000000",
  lightEdge: "#dfdfdf",
  lighterEdge: "#ffffff",
  activeTitle: "linear-gradient(90deg, #000080, #1084d0)",
  titleText: "#ffffff",
  fieldBg: "#ffffff",
  fieldText: "#000000",
  buttonFace: "#c0c0c0",
  selectedBg: "#000080",
  selectedText: "#ffffff",
} as const;

function Bevel({
  children,
  inset,
  className = "",
  style,
}: {
  children: React.ReactNode;
  inset?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const outer = inset ? NT.darkEdge : NT.lighterEdge;
  const inner = inset ? NT.darkerEdge : NT.lightEdge;
  const outerB = inset ? NT.lighterEdge : NT.darkEdge;
  const innerB = inset ? NT.lightEdge : NT.darkerEdge;

  return (
    <div
      className={className}
      style={{
        border: `1px solid ${outer}`,
        ...style,
      }}
    >
      <div
        style={{
          border: `1px solid ${inner}`,
          borderBottom: `1px solid ${innerB}`,
          borderRight: `1px solid ${innerB}`,
          height: "100%",
        }}
      >
        <div
          style={{
            border: `1px solid transparent`,
            borderBottom: `1px solid ${outerB}`,
            borderRight: `1px solid ${outerB}`,
            height: "100%",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function NtButton({
  children,
  onClick,
  disabled,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <Bevel>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          background: NT.buttonFace,
          padding: "2px 12px",
          fontFamily: "Tahoma, Geneva, sans-serif",
          fontSize: 11,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
          minWidth: 75,
          ...style,
        }}
      >
        {children}
      </button>
    </Bevel>
  );
}

function buildFieldsFromSchema(schema: Record<string, unknown>): {
  key: string;
  type: string;
  title: string;
  enumValues?: string[];
  defaultValue?: string;
}[] {
  const props = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  return Object.entries(props).map(([key, def]) => ({
    key,
    type: (def.type as string) ?? "string",
    title: (def.title as string) ?? key,
    enumValues: def.enum as string[] | undefined,
    defaultValue: def.default as string | undefined,
  }));
}

export default function TestPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [manualInput, setManualInput] = useState("");
  const [result, setResult] = useState<{
    ok: boolean;
    output: unknown;
    error?: string;
  } | null>(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    actions.listPrograms().then(setPrograms);
  }, []);

  const selected = programs.find((p) => p.id === selectedId);

  const inputSchema = selected
    ? (selected.input_schema as Record<string, unknown>)
    : null;
  const outputConfig = selected
    ? (selected.output_config as Record<string, unknown>)
    : null;
  const fields = inputSchema ? buildFieldsFromSchema(inputSchema) : [];
  const hasManualInput =
    outputConfig &&
    (outputConfig.flags as Record<string, unknown> | undefined)
      ?.allowManualInput === true;

  useEffect(() => {
    if (!selected) {
      setInputValues({});
      return;
    }
    const schema = selected.input_schema as Record<string, unknown>;
    const fs = schema ? buildFieldsFromSchema(schema) : [];
    const defaults: Record<string, string> = {};
    for (const f of fs) {
      defaults[f.key] = f.defaultValue ?? f.enumValues?.[0] ?? "";
    }
    setInputValues(defaults);
    setManualInput("");
    setResult(null);
  }, [
    selected,
  ]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) =>
      [
        `[${ts}] ${msg}`,
        ...prev,
      ].slice(0, 50),
    );
  }, []);

  const handleRun = useCallback(async () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    addLog(`▶ Running "${selected.name}" ...`);

    try {
      const res = await actions.testProgram(
        selected.id,
        inputValues,
        hasManualInput ? manualInput : undefined,
      );
      setResult(res);
      addLog(
        res.ok
          ? `✓ OK → ${JSON.stringify(res.output)}`
          : `✗ FAIL → ${res.error}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({
        ok: false,
        output: null,
        error: msg,
      });
      addLog(`✗ EXCEPTION → ${msg}`);
    } finally {
      setRunning(false);
    }
  }, [
    selected,
    inputValues,
    manualInput,
    hasManualInput,
    addLog,
  ]);

  return (
    <div
      style={{
        background: NT.bg,
        minHeight: "100vh",
        fontFamily: "Tahoma, Geneva, sans-serif",
        fontSize: 11,
        color: NT.fieldText,
        padding: 8,
      }}
    >
      {/* Window */}
      <Bevel
        style={{
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: NT.activeTitle,
            padding: "3px 4px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              color: NT.titleText,
              fontWeight: "bold",
              fontSize: 11,
              flex: 1,
            }}
          >
            marble — Program Test Bench
          </span>
          <Bevel>
            <div
              style={{
                width: 14,
                height: 14,
                background: NT.buttonFace,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: "bold",
              }}
            >
              ×
            </div>
          </Bevel>
        </div>

        {/* Menu bar */}
        <div
          style={{
            padding: "2px 6px",
            borderBottom: `1px solid ${NT.darkEdge}`,
            display: "flex",
            gap: 12,
            fontSize: 11,
          }}
        >
          <span
            style={{
              textDecoration: "underline",
            }}
          >
            File
          </span>
          <span
            style={{
              textDecoration: "underline",
            }}
          >
            Edit
          </span>
          <span
            style={{
              textDecoration: "underline",
            }}
          >
            Help
          </span>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 8,
            display: "flex",
            gap: 8,
            minHeight: 400,
          }}
        >
          {/* Left: Program list */}
          <div
            style={{
              width: 200,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: 11,
                marginBottom: 2,
                fontWeight: "bold",
              }}
            >
              Programs:
            </div>
            <Bevel
              inset
              style={{
                flex: 1,
              }}
            >
              <div
                style={{
                  background: NT.fieldBg,
                  height: "100%",
                  overflowY: "auto",
                }}
              >
                {programs.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setSelectedId(p.id);
                    }}
                    role="option"
                    tabIndex={0}
                    aria-selected={p.id === selectedId}
                    style={{
                      padding: "2px 4px",
                      cursor: "pointer",
                      background:
                        p.id === selectedId ? NT.selectedBg : "transparent",
                      color:
                        p.id === selectedId ? NT.selectedText : NT.fieldText,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.name} [{p.runtime}]
                  </div>
                ))}
              </div>
            </Bevel>
          </div>

          {/* Right: Config + Run */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {selected ? (
              <>
                {/* Program info group box */}
                <fieldset
                  style={{
                    border: `1px solid ${NT.darkEdge}`,
                    padding: "6px 8px",
                    margin: 0,
                  }}
                >
                  <legend
                    style={{
                      fontSize: 11,
                      padding: "0 4px",
                    }}
                  >
                    {selected.name}
                  </legend>
                  <div
                    style={{
                      fontFamily: "Courier New, monospace",
                      fontSize: 10,
                      whiteSpace: "pre-wrap",
                      maxHeight: 80,
                      overflow: "auto",
                      background: NT.fieldBg,
                      padding: 4,
                      border: `1px inset ${NT.darkEdge}`,
                    }}
                  >
                    {selected.code}
                  </div>
                </fieldset>

                {/* Input config group box */}
                <fieldset
                  style={{
                    border: `1px solid ${NT.darkEdge}`,
                    padding: "6px 8px",
                    margin: 0,
                  }}
                >
                  <legend
                    style={{
                      fontSize: 11,
                      padding: "0 4px",
                    }}
                  >
                    Input Config
                  </legend>
                  {fields.length === 0 && (
                    <div
                      style={{
                        color: NT.darkEdge,
                        fontStyle: "italic",
                      }}
                    >
                      No input fields.
                    </div>
                  )}
                  {fields.map((f) => (
                    <div
                      key={f.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <label
                        htmlFor={`field-${f.key}`}
                        style={{
                          width: 100,
                          textAlign: "right",
                        }}
                      >
                        {f.title}:
                      </label>
                      {f.enumValues ? (
                        <Bevel inset>
                          <select
                            id={`field-${f.key}`}
                            value={inputValues[f.key] ?? ""}
                            onChange={(e) =>
                              setInputValues((p) => ({
                                ...p,
                                [f.key]: e.target.value,
                              }))
                            }
                            style={{
                              background: NT.fieldBg,
                              border: "none",
                              fontFamily: "Tahoma, Geneva, sans-serif",
                              fontSize: 11,
                              padding: "1px 2px",
                            }}
                          >
                            {f.enumValues.map((v) => (
                              <option
                                key={v}
                                value={v}
                              >
                                {v}
                              </option>
                            ))}
                          </select>
                        </Bevel>
                      ) : (
                        <Bevel
                          inset
                          style={{
                            flex: 1,
                          }}
                        >
                          <input
                            id={`field-${f.key}`}
                            type="text"
                            value={inputValues[f.key] ?? ""}
                            onChange={(e) =>
                              setInputValues((p) => ({
                                ...p,
                                [f.key]: e.target.value,
                              }))
                            }
                            style={{
                              background: NT.fieldBg,
                              border: "none",
                              fontFamily: "Tahoma, Geneva, sans-serif",
                              fontSize: 11,
                              padding: "1px 4px",
                              width: "100%",
                              outline: "none",
                            }}
                          />
                        </Bevel>
                      )}
                    </div>
                  ))}

                  {hasManualInput && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 4,
                        paddingTop: 4,
                        borderTop: `1px solid ${NT.darkEdge}`,
                      }}
                    >
                      <label
                        htmlFor="manual-input"
                        style={{
                          width: 100,
                          textAlign: "right",
                        }}
                      >
                        Cell Value:
                      </label>
                      <Bevel
                        inset
                        style={{
                          flex: 1,
                        }}
                      >
                        <input
                          id="manual-input"
                          type="text"
                          value={manualInput}
                          onChange={(e) => setManualInput(e.target.value)}
                          placeholder="manual input value..."
                          style={{
                            background: NT.fieldBg,
                            border: "none",
                            fontFamily: "Tahoma, Geneva, sans-serif",
                            fontSize: 11,
                            padding: "1px 4px",
                            width: "100%",
                            outline: "none",
                          }}
                        />
                      </Bevel>
                    </div>
                  )}
                </fieldset>

                {/* Run button */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <NtButton
                    onClick={handleRun}
                    disabled={running}
                  >
                    {running ? "Running..." : "▶ Run Program"}
                  </NtButton>
                  {running && (
                    <span
                      style={{
                        color: NT.darkEdge,
                      }}
                    >
                      ⏳ Executing...
                    </span>
                  )}
                </div>

                {/* Result */}
                {result && (
                  <fieldset
                    style={{
                      border: `1px solid ${NT.darkEdge}`,
                      padding: "6px 8px",
                      margin: 0,
                    }}
                  >
                    <legend
                      style={{
                        fontSize: 11,
                        padding: "0 4px",
                      }}
                    >
                      Result{" "}
                      <span
                        style={{
                          color: result.ok ? "#008000" : "#c00000",
                        }}
                      >
                        [{result.ok ? "OK" : "FAIL"}]
                      </span>
                    </legend>
                    <div
                      style={{
                        fontFamily: "Courier New, monospace",
                        fontSize: 10,
                        whiteSpace: "pre-wrap",
                        background: NT.fieldBg,
                        padding: 4,
                        border: `1px inset ${NT.darkEdge}`,
                        maxHeight: 120,
                        overflow: "auto",
                      }}
                    >
                      {result.ok
                        ? JSON.stringify(result.output, null, 2)
                        : result.error}
                    </div>
                  </fieldset>
                )}
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: NT.darkEdge,
                }}
              >
                ← Select a program to test
              </div>
            )}
          </div>
        </div>

        {/* Status bar / log */}
        <Bevel inset>
          <div
            style={{
              background: NT.fieldBg,
              padding: 4,
              maxHeight: 100,
              overflow: "auto",
              fontFamily: "Courier New, monospace",
              fontSize: 10,
            }}
          >
            {log.length === 0 ? (
              <span
                style={{
                  color: NT.darkEdge,
                }}
              >
                Ready.
              </span>
            ) : (
              log.map((line, i) => (
                <div
                  key={`${i}-${line.slice(0, 16)}`}
                  style={{
                    color: line.includes("✗")
                      ? "#c00000"
                      : line.includes("✓")
                        ? "#008000"
                        : NT.fieldText,
                  }}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </Bevel>
      </Bevel>
    </div>
  );
}
