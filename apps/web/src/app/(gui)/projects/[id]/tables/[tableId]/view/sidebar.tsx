"use client";

// harness-ignore: max-file-lines -- single dense component: ColumnSidebar manages column type/output/secrets/binding editor state via 20+ useState hooks sharing handlers; lifting would obscure dataflow

import {
  cx,
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleField,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
  MarbleTextarea,
} from "@marble/ui";
import { useEffect, useRef, useState } from "react";

import { updateProgramOutputSchema } from "../actions";
import { getProgramInputSchema, getProgramOutputConfig } from "./cell";
import { InterpolationEditor } from "./interpolation-editor";
import {
  buildFieldsFromSchema,
  coerceFieldValue,
  describeColumnSecretResolution,
  parseTemplateToFieldValues,
  resolveReferenceColumnToken,
  secretBindingMapToEntries,
} from "./schema-fields";
import type {
  Column,
  ColumnSecretBindingMap,
  Program,
  ProgramSecretBindingMap,
  ProgramSecretDeclarationsByProgramId,
  ReferenceableColumn,
  SecretBindingInput,
  SecretRecord,
} from "./types";

export function ColumnSidebar({
  columnSecretBindings,
  mode,
  columns,
  currentTableId,
  onOpenSecrets,
  programs,
  programSecretBindings,
  programSecretDeclarations,
  onCreateColumn,
  onUpdateColumn,
  onClose,
  referenceColumns,
  secrets,
}: {
  columnSecretBindings: ColumnSecretBindingMap;
  mode:
    | {
        kind: "create";
      }
    | {
        kind: "edit";
        columnId: string;
      };
  columns: Column[];
  currentTableId: string;
  onOpenSecrets: () => void;
  programs: Program[];
  programSecretBindings: ProgramSecretBindingMap;
  programSecretDeclarations: ProgramSecretDeclarationsByProgramId;
  onCreateColumn: (input: {
    name: string;
    programVersionId: string;
    inputTemplate: string;
    runCondition: boolean;
  }) => Promise<void>;
  onUpdateColumn: (input: {
    columnId: string;
    name?: string;
    programVersionId?: string;
    inputTemplate?: string;
    runCondition?: boolean;
    secretBindings?: SecretBindingInput[];
  }) => Promise<void>;
  onClose: () => void;
  referenceColumns: ReferenceableColumn[];
  secrets: SecretRecord[];
}) {
  const editingColumn =
    mode.kind === "edit"
      ? (columns.find((c) => c.id === mode.columnId) ?? null)
      : null;

  const initFieldValues = (): Record<
    string,
    {
      mode: "static" | "column";
      value: string;
    }
  > => {
    if (!editingColumn) return {};
    const programVersion = programs.find(
      (p) => p.id === editingColumn.programVersion?.programId,
    )?.programVersions?.[0];
    if (!programVersion) return {};
    const s = getProgramInputSchema(programVersion);
    const fs = s ? buildFieldsFromSchema(s) : [];
    return parseTemplateToFieldValues(
      editingColumn.inputTemplate ?? "{}",
      fs,
      referenceColumns,
    );
  };

  const [name, setName] = useState(editingColumn?.name ?? "");
  const [programId, setProgramId] = useState(
    editingColumn?.programVersion?.programId ?? "",
  );
  const [runConditionEnabled, setRunConditionEnabled] = useState(
    editingColumn?.runCondition === true,
  );
  const [secretBindings, setSecretBindings] = useState<Record<string, string>>(
    () => (editingColumn ? (columnSecretBindings[editingColumn.id] ?? {}) : {}),
  );
  const [fieldValues, setFieldValues] = useState(initFieldValues);
  const [saving, setSaving] = useState(false);
  const [outputSchemaOpen, setOutputSchemaOpen] = useState(false);
  const [outputSchemaJson, setOutputSchemaJson] = useState(() => {
    const config = getProgramOutputConfig(editingColumn?.programVersion);
    if (!config) return "{}";
    return JSON.stringify(config, null, 2);
  });
  const [outputSchemaDirty, setOutputSchemaDirty] = useState(false);
  const [savingOutputSchema, setSavingOutputSchema] = useState(false);

  const initialProgramId = useRef(programId);

  const selectedProgram = programs.find((p) => p.id === programId);
  const latestVersion = selectedProgram?.programVersions?.length
    ? (selectedProgram.programVersions
        .filter((version) => version.version !== null)
        .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null)
    : null;

  const selectedSchema = getProgramInputSchema(latestVersion);
  const fields = selectedSchema ? buildFieldsFromSchema(selectedSchema) : [];
  const selectedProgramSecretDeclarations =
    programSecretDeclarations[programId] ?? [];
  const hasManualInput = (() => {
    const config = getProgramOutputConfig(latestVersion) as {
      flags?: {
        allowManualInput?: boolean;
      };
    } | null;
    return config?.flags?.allowManualInput === true;
  })();

  useEffect(() => {
    if (programId === initialProgramId.current) return;
    initialProgramId.current = programId;

    const program = programs.find((p) => p.id === programId);
    if (!program) {
      setFieldValues({});
      return;
    }

    const version = program.programVersions?.length
      ? (program.programVersions
          .filter((entry) => entry.version !== null)
          .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null)
      : null;

    const s = getProgramInputSchema(version);
    const fs = s ? buildFieldsFromSchema(s) : [];
    const defaults: Record<
      string,
      {
        mode: "static" | "column";
        value: string;
      }
    > = {};
    for (const f of fs) {
      defaults[f.key] = {
        mode: "static",
        value: f.defaultValue ?? f.enumValues?.[0] ?? "",
      };
    }
    setFieldValues(defaults);
    setSecretBindings((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([envName]) =>
          selectedProgramSecretDeclarations.some(
            (declaration) => declaration.env === envName,
          ),
        ),
      ),
    );
  }, [
    programId,
    programs,
    selectedProgramSecretDeclarations,
  ]);

  const buildTemplate = (): string => {
    const template: Record<string, unknown> = {};
    for (const [key, fv] of Object.entries(fieldValues)) {
      if (fv.mode === "column") {
        template[`${key}.$`] = `$.columns.${fv.value}.value`;
      } else {
        const field = fields.find((f) => f.key === key);
        if (!field) continue;

        let val = fv.value;
        if (typeof val === "string") {
          val = val.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
            const reference = resolveReferenceColumnToken(
              inner,
              referenceColumns,
              currentTableId,
            );
            if (reference) {
              return `{{$.columns.${reference.column.id}.value${reference.restPath}}}`;
            }
            return match;
          });
        }

        const coerced = coerceFieldValue(field, val);
        if (coerced !== undefined) template[key] = coerced;
      }
    }
    return JSON.stringify(template);
  };

  const validateTemplate = (): string | null => {
    for (const [_key, fv] of Object.entries(fieldValues)) {
      if (fv.mode === "static" && typeof fv.value === "string") {
        const matches = [
          ...fv.value.matchAll(/\{\{([^}]+)\}\}/g),
        ];
        for (const match of matches) {
          const inner = match[1];
          if (
            !resolveReferenceColumnToken(
              inner,
              referenceColumns,
              currentTableId,
            )
          ) {
            return `Unrecognized column in formula: "${inner}". Please check your spelling.`;
          }
        }
      }
    }
    return null;
  };

  const validationError = validateTemplate();
  const secretBindingsForSave = Object.fromEntries(
    Object.entries(secretBindings).filter(([envName]) =>
      selectedProgramSecretDeclarations.some(
        (declaration) => declaration.env === envName,
      ),
    ),
  );

  const handleSave = async () => {
    if (!name.trim() || !programId || validationError || !latestVersion) return;
    setSaving(true);
    try {
      if (mode.kind === "create") {
        await onCreateColumn({
          inputTemplate: buildTemplate(),
          name: name.trim(),
          programVersionId: latestVersion.id,
          runCondition: runConditionEnabled,
        });
        setName("");
        setProgramId("");
        setFieldValues({});
        setRunConditionEnabled(false);
        onClose();
      } else {
        await onUpdateColumn({
          columnId: mode.columnId,
          inputTemplate: buildTemplate(),
          name: name.trim(),
          programVersionId: latestVersion.id,
          runCondition: runConditionEnabled,
          secretBindings: secretBindingMapToEntries(secretBindingsForSave),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const isCreate = mode.kind === "create";

  return (
    <aside className="flex w-80 min-h-0 flex-col overflow-hidden rounded-xs border-l border-taupe-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-taupe-200 px-4 py-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-medium text-taupe-950">
            {isCreate ? "New Column" : "Edit Column"}
          </h2>
          {!isCreate && editingColumn ? (
            <p className="truncate text-xs text-taupe-600">
              {editingColumn.name}
            </p>
          ) : null}
        </div>
        <button
          aria-label="Close column sidebar"
          className="flex size-8 shrink-0 items-center justify-center rounded-sm text-taupe-400 transition-colors hover:bg-taupe-100 hover:text-taupe-900"
          onClick={onClose}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="M4 4L12 12M12 4L4 12"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
          <MarbleField
            label="Name"
            labelClassName="text-taupe-700"
          >
            <MarbleInput
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Uppercased"
              type="text"
              value={name}
              wrapperClassName="w-full"
            />
          </MarbleField>

          <MarbleField
            label="Program"
            labelClassName="text-taupe-700"
          >
            <MarbleSelect
              onChange={(e) => setProgramId(e.target.value)}
              value={programId}
              wrapperClassName="w-full"
            >
              <option value="">Select program...</option>
              {programs.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                >
                  {p.name}
                </option>
              ))}
            </MarbleSelect>
          </MarbleField>

          {hasManualInput && (
            <MarbleAlert
              size="sm"
              tone="warning"
            >
              This program reads from cell.manualInputValue — cells will be
              editable.
            </MarbleAlert>
          )}

          <MarbleField
            description="Auto-run only happens after upstream cells execute and the resolved input validates for this program."
            label="Execution"
            labelClassName="text-taupe-700"
          >
            <MarbleSelect
              onChange={(event) =>
                setRunConditionEnabled(event.target.value === "auto")
              }
              value={runConditionEnabled ? "auto" : "manual"}
              wrapperClassName="w-full"
            >
              <option value="manual">Manual only</option>
              <option value="auto">Auto when ready</option>
            </MarbleSelect>
          </MarbleField>

          {!programId ? null : isCreate ||
            selectedProgramSecretDeclarations.length === 0 ? (
            selectedProgramSecretDeclarations.length === 0 ? (
              <MarbleAlert
                size="sm"
                tone="neutral"
              >
                This program does not declare any named secrets.
              </MarbleAlert>
            ) : (
              <MarbleAlert
                size="sm"
                tone="neutral"
              >
                Program defaults apply automatically. Column-specific overrides
                appear after the column exists.
              </MarbleAlert>
            )
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <MarbleFieldLabel className="text-taupe-700">
                  Secret Overrides
                </MarbleFieldLabel>
                {secrets.length === 0 ? (
                  <MarbleButton
                    onClick={onOpenSecrets}
                    size="xs"
                    variant="light"
                  >
                    Open Secrets
                  </MarbleButton>
                ) : null}
              </div>

              {selectedProgramSecretDeclarations.map((declaration) => {
                const overrideSecretId = secretBindings[declaration.env];
                const resolution = describeColumnSecretResolution(declaration, {
                  overrideSecretId,
                  programDefaultSecretId:
                    programSecretBindings[programId]?.[declaration.env],
                  secrets,
                });

                return (
                  <div
                    className="space-y-3 rounded-xs border border-taupe-200 bg-taupe-50/60 p-3"
                    key={declaration.env}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-taupe-950">
                          {declaration.env}
                        </span>
                        <MarbleBadge tone={resolution.badgeTone}>
                          {resolution.badgeLabel}
                        </MarbleBadge>
                      </div>
                      <div className="text-xs text-taupe-700">
                        {declaration.label}
                      </div>
                      {declaration.description ? (
                        <div className="text-[11px] text-taupe-500">
                          {declaration.description}
                        </div>
                      ) : null}
                    </div>

                    <MarbleSelect
                      onChange={(event) =>
                        setSecretBindings((current) => {
                          const nextBindings = {
                            ...current,
                          };

                          if (event.target.value) {
                            nextBindings[declaration.env] = event.target.value;
                          } else {
                            delete nextBindings[declaration.env];
                          }

                          return nextBindings;
                        })
                      }
                      size="xs"
                      value={overrideSecretId ?? ""}
                      wrapperClassName="w-full"
                    >
                      <option value="">{resolution.inheritedLabel}</option>
                      {overrideSecretId &&
                      !secrets.some(
                        (secret) => secret.id === overrideSecretId,
                      ) ? (
                        <option value={overrideSecretId}>Missing secret</option>
                      ) : null}
                      {secrets.map((secret) => (
                        <option
                          key={secret.id}
                          value={secret.id}
                        >
                          {secret.name}
                        </option>
                      ))}
                    </MarbleSelect>

                    <div className="text-[11px] text-taupe-500">
                      {resolution.helperText}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fields.length > 0 && (
            <div className="space-y-2.5">
              <MarbleFieldLabel className="text-taupe-700">
                Input Template
              </MarbleFieldLabel>
              {fields.map((f) => {
                const fv = fieldValues[f.key] ?? {
                  mode: "static",
                  value: "",
                };
                return (
                  <div
                    className="space-y-2 rounded-xs border border-taupe-200 bg-taupe-50/60 p-3"
                    key={f.key}
                  >
                    <div className="space-y-0.5">
                      <span className="block font-mono text-[11px] text-taupe-950">
                        {f.key}
                      </span>
                      <span className="block text-xs text-taupe-600">
                        {f.title}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-taupe-700">
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          checked={fv.mode === "static"}
                          className="accent-orange-500"
                          name={`mode-${f.key}`}
                          onChange={() =>
                            setFieldValues((prev) => ({
                              ...prev,
                              [f.key]: {
                                mode: "static",
                                value:
                                  f.defaultValue ?? f.enumValues?.[0] ?? "",
                              },
                            }))
                          }
                          type="radio"
                        />
                        Formula
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          checked={fv.mode === "column"}
                          className="accent-orange-500"
                          name={`mode-${f.key}`}
                          onChange={() =>
                            setFieldValues((prev) => ({
                              ...prev,
                              [f.key]: {
                                mode: "column",
                                value: referenceColumns[0]?.id ?? "",
                              },
                            }))
                          }
                          type="radio"
                        />
                        From column
                      </label>
                    </div>
                    {fv.mode === "static" ? (
                      f.enumValues ? (
                        <MarbleSelect
                          onChange={(e) =>
                            setFieldValues((prev) => ({
                              ...prev,
                              [f.key]: {
                                ...fv,
                                value: e.target.value,
                              },
                            }))
                          }
                          size="xs"
                          value={fv.value}
                          wrapperClassName="w-full"
                        >
                          {f.enumValues.map((v) => (
                            <option
                              key={v}
                              value={v}
                            >
                              {v}
                            </option>
                          ))}
                        </MarbleSelect>
                      ) : (
                        <InterpolationEditor
                          currentTableId={currentTableId}
                          onChange={(newVal) =>
                            setFieldValues((prev) => ({
                              ...prev,
                              [f.key]: {
                                ...fv,
                                value: newVal,
                              },
                            }))
                          }
                          placeholder={
                            f.type === "object"
                              ? f.required
                                ? '{"key": "value"}'
                                : "leave blank or JSON"
                              : f.type === "array"
                                ? "[]"
                                : undefined
                          }
                          referenceColumns={referenceColumns}
                          value={fv.value}
                        />
                      )
                    ) : (
                      <MarbleSelect
                        onChange={(e) =>
                          setFieldValues((prev) => ({
                            ...prev,
                            [f.key]: {
                              ...fv,
                              value: e.target.value,
                            },
                          }))
                        }
                        size="xs"
                        value={fv.value}
                        wrapperClassName="w-full"
                      >
                        <option
                          disabled
                          value=""
                        >
                          Pick a column...
                        </option>
                        {referenceColumns.map((col) => (
                          <option
                            key={col.id}
                            value={col.id}
                          >
                            {col.label}
                            {col.allowManualInput ? " (input)" : ""}
                          </option>
                        ))}
                      </MarbleSelect>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {/* Output Config escape hatch — edit mode only */}
          {!isCreate && selectedProgram && (
            <div className="border-t border-taupe-200 pt-4">
              <button
                className="flex w-full items-center gap-1.5 text-left text-[10px] text-taupe-600 uppercase tracking-wider"
                onClick={() => setOutputSchemaOpen((o) => !o)}
                type="button"
              >
                <span
                  className={cx(
                    "text-[8px] transition-transform",
                    outputSchemaOpen && "rotate-90",
                  )}
                >
                  ▶
                </span>
                Output Config
                {outputSchemaDirty && (
                  <span className="text-orange-500 normal-case tracking-normal">
                    (unsaved)
                  </span>
                )}
              </button>
              {outputSchemaOpen && (
                <div className="mt-2 space-y-2">
                  <MarbleTextarea
                    monospace
                    onChange={(e) => {
                      setOutputSchemaJson(e.target.value);
                      setOutputSchemaDirty(true);
                    }}
                    rows={8}
                    size="xs"
                    spellCheck={false}
                    value={outputSchemaJson}
                  />
                  <MarbleButton
                    className="w-full"
                    disabled={
                      !latestVersion || !outputSchemaDirty || savingOutputSchema
                    }
                    onClick={async () => {
                      if (!latestVersion) return;
                      let parsed: unknown;
                      try {
                        parsed = JSON.parse(outputSchemaJson);
                      } catch {
                        return;
                      }
                      setSavingOutputSchema(true);
                      try {
                        await updateProgramOutputSchema(
                          latestVersion.id,
                          parsed,
                        );
                        setOutputSchemaDirty(false);
                      } finally {
                        setSavingOutputSchema(false);
                      }
                    }}
                  >
                    {savingOutputSchema ? "Saving..." : "Save Output Config"}
                  </MarbleButton>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-3 border-t border-taupe-200 bg-taupe-50 px-4 py-2.5">
          {validationError && (
            <MarbleAlert
              size="sm"
              tone="error"
            >
              {validationError}
            </MarbleAlert>
          )}
          <MarbleButton
            className="w-full"
            disabled={!name.trim() || !programId || saving || !!validationError}
            onClick={handleSave}
            variant="orange"
          >
            {saving
              ? isCreate
                ? "Creating..."
                : "Saving..."
              : isCreate
                ? "Create column"
                : "Save Changes"}
          </MarbleButton>
        </div>
      </div>
    </aside>
  );
}
