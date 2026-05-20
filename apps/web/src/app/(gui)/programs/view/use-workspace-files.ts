import { getErrorMessage } from "@marble/lib/result";
import { type DragEvent as ReactDragEvent, useState } from "react";
import { getProgramFiletype, getSuggestedFileName, isFileDrag } from "./files";
import { countLabel } from "./programs";
import type { EditableProgramFile } from "./types";

export const useWorkspaceFiles = ({
  addLog,
  canEditWorkspace,
}: {
  addLog: (message: string) => void;
  canEditWorkspace: boolean;
}) => {
  const [files, setFiles] = useState<EditableProgramFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [importingFiles, setImportingFiles] = useState(false);
  const [workspaceDragDepth, setWorkspaceDragDepth] = useState(0);
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileError, setNewFileError] = useState<string | null>(null);

  const openNewFileModal = () => {
    if (!canEditWorkspace) {
      return;
    }

    setNewFileName(getSuggestedFileName(files));
    setNewFileError(null);
    setIsNewFileModalOpen(true);
  };

  const closeNewFileModal = () => {
    setIsNewFileModalOpen(false);
    setNewFileError(null);
  };

  const handleCreateFile = () => {
    if (!canEditWorkspace) {
      return;
    }

    const nextFilename = newFileName.trim();

    if (!nextFilename) {
      setNewFileError("Filename is required.");
      return;
    }

    if (files.some((file) => file.filename === nextFilename)) {
      setNewFileError(`"${nextFilename}" already exists in this program.`);
      return;
    }

    setFiles((current) => [
      ...current,
      {
        content: "",
        filename: nextFilename,
        filetype: getProgramFiletype(nextFilename),
      },
    ]);
    setOpenTabs((current) =>
      current.includes(nextFilename)
        ? current
        : [
            ...current,
            nextFilename,
          ],
    );
    setActiveFile(nextFilename);
    closeNewFileModal();
  };

  const handleImportFiles = async (
    incomingFiles: File[],
    options?: {
      closeModalAfterImport?: boolean;
    },
  ) => {
    if (!canEditWorkspace || incomingFiles.length === 0) {
      return;
    }

    setImportingFiles(true);
    addLog(`Importing ${countLabel(incomingFiles.length, "file")}...`);

    try {
      const importedFiles = await Promise.all(
        incomingFiles.map(async (file) => ({
          content: await file.text(),
          filename: file.name,
          filetype: getProgramFiletype(file.name),
        })),
      );

      const duplicateNames: string[] = [];
      let firstAcceptedFilename: null | string = null;
      let importedCount = 0;

      setFiles((current) => {
        const existingNames = new Set(current.map((file) => file.filename));
        const acceptedFiles: EditableProgramFile[] = [];

        for (const file of importedFiles) {
          if (existingNames.has(file.filename)) {
            duplicateNames.push(file.filename);
            continue;
          }

          existingNames.add(file.filename);
          acceptedFiles.push(file);
        }

        importedCount = acceptedFiles.length;
        firstAcceptedFilename = acceptedFiles[0]?.filename ?? null;

        return acceptedFiles.length > 0
          ? [
              ...current,
              ...acceptedFiles,
            ]
          : current;
      });

      if (firstAcceptedFilename) {
        const acceptedFilename = firstAcceptedFilename;
        setOpenTabs((current) =>
          current.includes(acceptedFilename)
            ? current
            : [
                ...current,
                acceptedFilename,
              ],
        );
        setActiveFile(acceptedFilename);
      }

      if (importedCount > 0) {
        addLog(`✓ Imported ${countLabel(importedCount, "file")}.`);

        if (options?.closeModalAfterImport) {
          closeNewFileModal();
        }
      }

      if (duplicateNames.length > 0) {
        addLog(
          `✗ Skipped duplicate ${countLabel(duplicateNames.length, "file")}: ${duplicateNames.join(", ")}`,
        );
      }
    } catch (error) {
      addLog(`✗ File import failed: ${getErrorMessage(error)}`);
    } finally {
      setImportingFiles(false);
      setWorkspaceDragDepth(0);
    }
  };

  const handleWorkspaceDragEnter = (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => {
    if (
      !canEditWorkspace ||
      importingFiles ||
      !isFileDrag(event.dataTransfer)
    ) {
      return;
    }

    event.preventDefault();
    setWorkspaceDragDepth((current) => current + 1);
  };

  const handleWorkspaceDragLeave = (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => {
    if (!isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setWorkspaceDragDepth((current) => Math.max(0, current - 1));
  };

  const handleWorkspaceDragOver = (
    event: ReactDragEvent<HTMLFieldSetElement>,
  ) => {
    if (
      !canEditWorkspace ||
      importingFiles ||
      !isFileDrag(event.dataTransfer)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleWorkspaceDrop = (event: ReactDragEvent<HTMLFieldSetElement>) => {
    if (!canEditWorkspace || !isFileDrag(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setWorkspaceDragDepth(0);
  };

  const handleCodeChange = (newCode: string) => {
    if (!canEditWorkspace || !activeFile) {
      return;
    }

    setFiles((current) =>
      current.map((file) =>
        file.filename === activeFile
          ? {
              ...file,
              content: newCode,
            }
          : file,
      ),
    );
  };

  const handleSelectFile = (filename: string) => {
    setOpenTabs((current) =>
      current.includes(filename)
        ? current
        : [
            ...current,
            filename,
          ],
    );
    setActiveFile(filename);
  };

  const handleCloseTab = (filename: string) => {
    setOpenTabs((current) => {
      const currentIndex = current.indexOf(filename);

      if (currentIndex === -1) {
        return current;
      }

      const nextTabs = current.filter((tab) => tab !== filename);

      setActiveFile((currentActiveFile) =>
        currentActiveFile === filename
          ? (nextTabs[currentIndex] ?? nextTabs[currentIndex - 1] ?? null)
          : currentActiveFile,
      );

      return nextTabs;
    });
  };

  return {
    activeFile,
    closeNewFileModal,
    files,
    handleCloseTab,
    handleCodeChange,
    handleCreateFile,
    handleImportFiles,
    handleSelectFile,
    handleWorkspaceDragEnter,
    handleWorkspaceDragLeave,
    handleWorkspaceDragOver,
    handleWorkspaceDrop,
    importingFiles,
    isNewFileModalOpen,
    newFileError,
    newFileName,
    openNewFileModal,
    openTabs,
    setActiveFile,
    setFiles,
    setIsNewFileModalOpen,
    setNewFileError,
    setNewFileName,
    setOpenTabs,
    setWorkspaceDragDepth,
    workspaceDragDepth,
  };
};
