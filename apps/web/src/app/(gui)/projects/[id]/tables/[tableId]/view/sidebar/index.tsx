"use client";

import { getErrorMessage } from "@marble/lib/result";
import { MarbleAlert } from "@marble/ui";
import { XIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { getProgramOutputConfig } from "../cell";
import { secretBindingMapToEntries } from "../schema-fields";
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
  buildColumnDraft,
  buildColumnInputTemplate,
  buildProgramDefaultFieldValues,
  buildProgramInputFields,
  getLatestPublishedProgramVersion,
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
  const editingColumnSecretBindings = editingColumn
    ? columnSecretBindings[editingColumn.id]
    : undefined;
  const initialDraft = editingColumn
    ? buildColumnDraft({
        column: editingColumn,
        columnSecretBindings: editingColumnSecretBindings ?? {},
        programs,
        referenceColumns,
      })
    : null;
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [programId, setProgramId] = useState(initialDraft?.programId ?? "");
  const [runConditionEnabled, setRunConditionEnabled] = useState(
    initialDraft?.runConditionEnabled ?? false,
  );
  const [secretBindings, setSecretBindings] = useState<Record<string, string>>(
    () => initialDraft?.secretBindings ?? {},
  );
  const [fieldValues, setFieldValues] = useState<ColumnFieldValues>(
    initialDraft?.fieldValues ?? {},
  );
  const [saveError, setSaveError] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const selectedProgram = programs.find((program) => program.id === programId);
  const latestVersion = getLatestPublishedProgramVersion(selectedProgram);
  const fields = buildProgramInputFields({
    programId,
    programs,
  });
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
    if (!editingColumn) {
      return;
    }

    const draft = buildColumnDraft({
      column: editingColumn,
      columnSecretBindings: editingColumnSecretBindings ?? {},
      programs,
      referenceColumns,
    });

    setName(draft.name);
    setProgramId(draft.programId);
    setRunConditionEnabled(draft.runConditionEnabled);
    setSecretBindings(draft.secretBindings);
    setFieldValues(draft.fieldValues);
    setSaveError(null);
  }, [
    editingColumn,
    editingColumnSecretBindings,
    programs,
    referenceColumns,
  ]);

  const handleProgramIdChange = (nextProgramId: string) => {
    const nextDeclarations = programSecretDeclarations[nextProgramId] ?? [];

    setProgramId(nextProgramId);
    setFieldValues(
      buildProgramDefaultFieldValues({
        programId: nextProgramId,
        programs,
      }),
    );
    setSecretBindings((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([envName]) =>
          nextDeclarations.some((declaration) => declaration.env === envName),
        ),
      ),
    );
  };

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
            onProgramIdChange={handleProgramIdChange}
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
