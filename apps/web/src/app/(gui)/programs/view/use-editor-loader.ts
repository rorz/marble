import { safeStringify } from "@marble/lib/json";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { createDefaultDraftFiles, normalizeProgramFiles } from "./files";
import { createEditableProgramSecretDeclarations } from "./secret-config";
import type {
  EditableProgramFile,
  EditableProgramSecretDeclaration,
  FullProgram,
  ProgramTestResult,
  ProgramVersionWithFiles,
} from "./types";
import { buildFieldsFromSchema } from "./workbench";

type UseEditorLoaderInput = {
  editingSurface: null | "crumb" | "title";
  isEditorRoute: boolean;
  isLocalDraftProgram: boolean;
  latestVersionInputSchema: unknown;
  selectedProgram: FullProgram | undefined;
  setActiveFile: Dispatch<SetStateAction<null | string>>;
  setEditingSurface: Dispatch<SetStateAction<null | "crumb" | "title">>;
  setFiles: Dispatch<SetStateAction<EditableProgramFile[]>>;
  setInputValues: Dispatch<SetStateAction<Record<string, string>>>;
  setIsNewFileModalOpen: Dispatch<SetStateAction<boolean>>;
  setLog: Dispatch<SetStateAction<string[]>>;
  setManualInput: Dispatch<SetStateAction<string>>;
  setNewFileError: Dispatch<SetStateAction<null | string>>;
  setOpenTabs: Dispatch<SetStateAction<string[]>>;
  setProgName: Dispatch<SetStateAction<string>>;
  setRenameError: Dispatch<SetStateAction<null | string>>;
  setResult: Dispatch<SetStateAction<ProgramTestResult | null>>;
  setSecretConfigDraft: Dispatch<
    SetStateAction<EditableProgramSecretDeclaration[]>
  >;
  setSelectedVersionView: Dispatch<SetStateAction<"current" | string>>;
  setWorkspaceDragDepth: Dispatch<SetStateAction<number>>;
  testInputResetKey: string;
  visibleFiles: EditableProgramFile[];
  workingVersion: ProgramVersionWithFiles | null;
};

export const useEditorLoader = ({
  editingSurface,
  isEditorRoute,
  isLocalDraftProgram,
  latestVersionInputSchema,
  selectedProgram,
  setActiveFile,
  setEditingSurface,
  setFiles,
  setInputValues,
  setIsNewFileModalOpen,
  setLog,
  setManualInput,
  setNewFileError,
  setOpenTabs,
  setProgName,
  setRenameError,
  setResult,
  setSecretConfigDraft,
  setSelectedVersionView,
  setWorkspaceDragDepth,
  testInputResetKey,
  visibleFiles,
  workingVersion,
}: UseEditorLoaderInput) => {
  const loadedProgramIdRef = useRef<null | string>(null);
  const loadedTestInputKeyRef = useRef<null | string>(null);

  useEffect(() => {
    if (!isEditorRoute) {
      loadedProgramIdRef.current = null;
      return;
    }

    const programIdentity =
      selectedProgram?.id ?? (isLocalDraftProgram ? "__draft__" : null);

    if (
      programIdentity === null ||
      loadedProgramIdRef.current === programIdentity
    ) {
      return;
    }

    loadedProgramIdRef.current = programIdentity;
    setSelectedVersionView("current");
    setRenameError(null);
    setEditingSurface(null);
    setResult(null);
    setLog([]);
    setWorkspaceDragDepth(0);
    setIsNewFileModalOpen(false);
    setNewFileError(null);
    setManualInput("");

    if (isLocalDraftProgram) {
      const draftFiles = createDefaultDraftFiles();
      setProgName("Untitled Program");
      setFiles(draftFiles);
      setSecretConfigDraft([]);
      setActiveFile(draftFiles[0]?.filename ?? null);
      setOpenTabs(
        draftFiles[0]?.filename
          ? [
              draftFiles[0].filename,
            ]
          : [],
      );
      return;
    }

    if (workingVersion) {
      const nextFiles = normalizeProgramFiles(workingVersion.programFiles);

      setProgName(selectedProgram?.name ?? "Untitled Program");
      setFiles(nextFiles);
      setSecretConfigDraft(
        createEditableProgramSecretDeclarations(workingVersion.secretConfig),
      );
      setActiveFile(nextFiles[0]?.filename ?? null);
      setOpenTabs(
        nextFiles[0]?.filename
          ? [
              nextFiles[0].filename,
            ]
          : [],
      );
      return;
    }

    setProgName(selectedProgram?.name ?? "Untitled Program");
    setFiles([]);
    setSecretConfigDraft([]);
    setActiveFile(null);
    setOpenTabs([]);
  }, [
    isEditorRoute,
    isLocalDraftProgram,
    selectedProgram?.id,
    selectedProgram?.name,
    setActiveFile,
    setEditingSurface,
    setFiles,
    setIsNewFileModalOpen,
    setLog,
    setManualInput,
    setNewFileError,
    setOpenTabs,
    setProgName,
    setRenameError,
    setResult,
    setSecretConfigDraft,
    setSelectedVersionView,
    setWorkspaceDragDepth,
    workingVersion,
  ]);

  useEffect(() => {
    const visibleFileNames = new Set(visibleFiles.map((file) => file.filename));

    setOpenTabs((current) => {
      const nextTabs = current.filter((filename) =>
        visibleFileNames.has(filename),
      );
      const resolvedTabs =
        nextTabs.length > 0
          ? nextTabs
          : visibleFiles[0]?.filename
            ? [
                visibleFiles[0].filename,
              ]
            : [];

      if (
        current.length === resolvedTabs.length &&
        current.every((filename, index) => filename === resolvedTabs[index])
      ) {
        return current;
      }

      return resolvedTabs;
    });

    setActiveFile((current) =>
      current && visibleFileNames.has(current)
        ? current
        : (visibleFiles[0]?.filename ?? null),
    );
  }, [
    setActiveFile,
    setOpenTabs,
    visibleFiles,
  ]);

  useEffect(() => {
    if (isLocalDraftProgram || editingSurface !== null || !selectedProgram) {
      return;
    }

    setProgName(selectedProgram.name);
  }, [
    editingSurface,
    isLocalDraftProgram,
    selectedProgram,
    setProgName,
  ]);

  useEffect(() => {
    if (!latestVersionInputSchema) {
      const resetKey = `${testInputResetKey}:no-schema`;

      if (loadedTestInputKeyRef.current === resetKey) {
        return;
      }

      loadedTestInputKeyRef.current = resetKey;
      setInputValues({});
      setManualInput("");
      setResult(null);
      return;
    }

    const schema = latestVersionInputSchema as Record<string, unknown>;
    const resetKey = `${testInputResetKey}:${safeStringify(schema)}`;

    if (loadedTestInputKeyRef.current === resetKey) {
      return;
    }

    loadedTestInputKeyRef.current = resetKey;
    const defaults: Record<string, string> = {};

    for (const field of buildFieldsFromSchema(schema)) {
      defaults[field.key] = field.defaultValue ?? field.enumValues?.[0] ?? "";
    }

    setInputValues(defaults);
    setManualInput("");
    setResult(null);
  }, [
    latestVersionInputSchema,
    setInputValues,
    setManualInput,
    setResult,
    testInputResetKey,
  ]);
};
