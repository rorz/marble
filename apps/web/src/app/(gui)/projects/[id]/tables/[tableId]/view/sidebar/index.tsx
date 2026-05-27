"use client";

import { getErrorMessage } from "@marble/lib/result";
import { MarbleAlert } from "@marble/ui";
import { XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { getProgramInputSchema, getProgramOutputConfig } from "../cell";
import {
  buildFieldsFromSchema,
  parseTemplateToFieldValues,
  secretBindingMapToEntries,
} from "../schema-fields";
import type {
  Column,
  ColumnSecretBindingMap,
  Program,
  ProgramSecretBindingMap,
  ProgramSecretDeclarationsByProgramId,
  ReferenceableColumn,
  SecretBindingInput,
  SecretRecord,
} from "../types";
import { ColumnBasics } from "./basics";
import { SidebarFooter } from "./footer";
import { InputTemplate } from "./input-template";
import { SecretOverrides } from "./secret-overrides";
import {
  buildColumnInputTemplate,
  buildDefaultFieldValues,
  validateColumnInputTemplate,
} from "./template";
import type { ColumnFieldValues } from "./types";

type ColumnSidebarProps = {
  columnSecretBindings: ColumnSecretBindingMap;
  columns: Column[];
  currentTableId: string;
  mode:
    | {
        kind: "create";
      }
    | {
        columnId: string;
        kind: "edit";
      };
  onClose: () => void;
  onCreateColumn: (input: {
    inputTemplate: string;
    name: string;
    programVersionId: string;
    runCondition: boolean;
  }) => Promise<void>;
  onOpenSecrets: () => void;
  onUpdateColumn: (input: {
    columnId: string;
    inputTemplate?: string;
    name?: string;
    programVersionId?: string;
    runCondition?: boolean;
    secretBindings?: SecretBindingInput[];
  }) => Promise<void>;
  programs: Program[];
  programSecretBindings: ProgramSecretBindingMap;
  programSecretDeclarations: ProgramSecretDeclarationsByProgramId;
  referenceColumns: ReferenceableColumn[];
  secrets: SecretRecord[];
};

export const ColumnSidebar = ({
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
}: ColumnSidebarProps) => {
  const editingColumn =
    mode.kind === "edit"
      ? (columns.find((column) => column.id === mode.columnId) ?? null)
      : null;
  const initFieldValues = (): ColumnFieldValues => {
    if (!editingColumn) {
      return {};
    }

    const programVersion = programs.find(
      (program) => program.id === editingColumn.programVersion?.programId,
    )?.programVersions?.[0];

    if (!programVersion) {
      return {};
    }

    const schema = getProgramInputSchema(programVersion);
    const fields = schema ? buildFieldsFromSchema(schema) : [];
    return parseTemplateToFieldValues(
      editingColumn.inputTemplate ?? "{}",
      fields,
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
  const [saveError, setSaveError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const initialProgramId = useRef(programId);
  const selectedProgram = programs.find((program) => program.id === programId);
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
    if (programId === initialProgramId.current) {
      return;
    }

    initialProgramId.current = programId;
    const program = programs.find((entry) => entry.id === programId);

    if (!program) {
      setFieldValues({});
      return;
    }

    const version = program.programVersions?.length
      ? (program.programVersions
          .filter((entry) => entry.version !== null)
          .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0] ?? null)
      : null;
    const schema = getProgramInputSchema(version);
    const fields = schema ? buildFieldsFromSchema(schema) : [];
    setFieldValues(buildDefaultFieldValues(fields));
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

  const buildTemplate = () =>
    buildColumnInputTemplate({
      currentTableId,
      fields,
      fieldValues,
      referenceColumns,
    });
  const validationError = validateColumnInputTemplate({
    currentTableId,
    fieldValues,
    referenceColumns,
  });
  const secretBindingsForSave = Object.fromEntries(
    Object.entries(secretBindings).filter(([envName]) =>
      selectedProgramSecretDeclarations.some(
        (declaration) => declaration.env === envName,
      ),
    ),
  );
  const handleSave = async () => {
    if (!name.trim() || !programId || validationError || !latestVersion) {
      return;
    }

    setSaving(true);
    setSaveError(null);
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
    } catch (error) {
      setSaveError(getErrorMessage(error));
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
          <XIcon
            size={16}
            weight="bold"
          />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-auto px-4 py-4">
          <ColumnBasics
            hasManualInput={hasManualInput}
            name={name}
            onNameChange={setName}
            onProgramIdChange={setProgramId}
            onRunConditionEnabledChange={setRunConditionEnabled}
            programId={programId}
            programs={programs}
            runConditionEnabled={runConditionEnabled}
          />

          {!programId ? null : isCreate ? (
            <MarbleAlert
              size="sm"
              tone="neutral"
            >
              Program defaults apply automatically. Column-specific overrides
              appear after the column exists.
            </MarbleAlert>
          ) : (
            <SecretOverrides
              declarations={selectedProgramSecretDeclarations}
              onOpenSecrets={onOpenSecrets}
              programId={programId}
              programSecretBindings={programSecretBindings}
              secretBindings={secretBindings}
              secrets={secrets}
              setSecretBindings={setSecretBindings}
            />
          )}

          {saveError ? (
            <MarbleAlert
              size="sm"
              tone="error"
            >
              {saveError}
            </MarbleAlert>
          ) : null}

          <InputTemplate
            currentTableId={currentTableId}
            fields={fields}
            fieldValues={fieldValues}
            referenceColumns={referenceColumns}
            setFieldValues={setFieldValues}
          />
        </div>

        <SidebarFooter
          isCreate={isCreate}
          name={name}
          onSave={() => {
            void handleSave();
          }}
          programId={programId}
          saving={saving}
          validationError={validationError}
        />
      </div>
    </aside>
  );
};
