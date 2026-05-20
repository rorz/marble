import {
  MarbleButton,
  MarbleDropzone,
  MarbleFieldLabel,
  MarbleInput,
  MarbleModal,
  MarbleModalClose,
  MarbleModalContent,
  MarbleModalDescription,
  MarbleModalFooter,
  MarbleModalHeader,
  MarbleModalTitle,
} from "@marble/ui";
import { FilePlusIcon } from "@phosphor-icons/react/dist/ssr";
import { importAccept } from "./constants";
import type { ProgramEditorViewModel } from "./types";

export const NewFileModal = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) =>
  model.isNewFileModalOpen ? (
    <MarbleModal
      ariaLabel="Create a new program file"
      onClose={model.closeNewFileModal}
      size="sm"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          model.handleCreateFile();
        }}
      >
        <MarbleModalHeader>
          <MarbleModalTitle>New file</MarbleModalTitle>
          <MarbleModalClose onClick={model.closeNewFileModal} />
        </MarbleModalHeader>
        <MarbleModalContent className="space-y-4">
          <MarbleModalDescription>
            Add another source file to the current program version.
          </MarbleModalDescription>

          <div className="space-y-1.5">
            <MarbleFieldLabel>Import existing files</MarbleFieldLabel>
            <MarbleDropzone
              accept={importAccept}
              description="Drop code or config files here to add them directly to this program."
              disabled={model.importingFiles}
              hint="Supports .ts, .json, .md, and plain-text helpers."
              icon={<FilePlusIcon size={20} />}
              multiple
              onFilesChange={(incomingFiles) => {
                void model.handleImportFiles(incomingFiles, {
                  closeModalAfterImport: true,
                });
              }}
              size="sm"
              title={
                model.importingFiles
                  ? "Importing files..."
                  : "Drop files here or click to browse"
              }
              tone="orange"
            />
          </div>

          <div className="space-y-1.5">
            <MarbleFieldLabel>Filename</MarbleFieldLabel>
            <MarbleInput
              aria-label="Filename"
              autoFocus
              onChange={(event) => {
                model.setNewFileName(event.target.value);
                if (model.newFileError) {
                  model.setNewFileError(null);
                }
              }}
              placeholder="utils.ts"
              size="sm"
              type="text"
              value={model.newFileName}
              wrapperClassName="w-full"
            />
          </div>

          {model.newFileError ? (
            <p className="text-red-600 text-sm">{model.newFileError}</p>
          ) : null}
        </MarbleModalContent>
        <MarbleModalFooter>
          <MarbleButton
            onClick={model.closeNewFileModal}
            size="sm"
            type="button"
          >
            Cancel
          </MarbleButton>
          <MarbleButton
            size="sm"
            type="submit"
            variant="orange"
          >
            Create File
          </MarbleButton>
        </MarbleModalFooter>
      </form>
    </MarbleModal>
  ) : null;
