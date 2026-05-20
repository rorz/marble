import {
  cx,
  MarbleBadge,
  MarbleButton,
  MarbleDropzone,
  MarbleWorkbenchResizeHandle,
  MarbleWorkbenchSection,
} from "@marble/ui";
import {
  ClockIcon,
  FilePlusIcon,
  FolderOpenIcon,
  GitBranchIcon,
} from "@phosphor-icons/react/dist/ssr";
import { changeTargetKey } from "../../change-spotlight";
import { importAccept, shellPanelClassName } from "./constants";
import { CurrentWorkspaceRow } from "./current-workspace-row";
import { DraftStackRow } from "./draft-stack-row";
import { countLabel } from "./programs";
import type { ProgramEditorViewModel } from "./types";
import { VersionHistoryRow } from "./version-history-row";
import { WorkspaceFileTreeRow } from "./workspace-file-tree-row";

export const EditorLeftPanel = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <div
    className={cx("flex w-60 shrink-0 flex-col border-r", shellPanelClassName)}
  >
    <MarbleWorkbenchSection
      actions={
        <MarbleButton
          disabled={!model.canEditWorkspace}
          iconLeft={FilePlusIcon}
          onClick={model.openNewFileModal}
          size="xs"
          type="button"
        >
          New
        </MarbleButton>
      }
      badge={
        <MarbleBadge className="font-mono">
          {model.visibleFiles.length}
        </MarbleBadge>
      }
      bodyClassName="bg-transparent"
      className="flex min-h-0 flex-1 flex-col rounded-none border-0 border-b border-taupe-400 bg-transparent shadow-none"
      headerClassName="px-2 py-1.5"
      icon={<FolderOpenIcon size={16} />}
      title="Workspace"
    >
      <fieldset
        aria-label="Program workspace files"
        className="relative flex-1 overflow-hidden border-0 p-0"
        onDragEnter={model.handleWorkspaceDragEnter}
        onDragLeave={model.handleWorkspaceDragLeave}
        onDragOver={model.handleWorkspaceDragOver}
        onDrop={model.handleWorkspaceDrop}
      >
        <div className="h-full overflow-y-auto p-1.5">
          {model.visibleFiles.length > 0 ? (
            <div className="space-y-px">
              {model.visibleFiles.map((file) => (
                <WorkspaceFileTreeRow
                  active={model.activeFile === file.filename}
                  dirty={model.dirtyFiles.has(file.filename)}
                  file={file}
                  key={file.filename}
                  onSelect={() => model.handleSelectFile(file.filename)}
                  targetKey={changeTargetKey.programFile(
                    model.activeProgramTargetId,
                    file.filename,
                  )}
                />
              ))}
            </div>
          ) : (
            <div className="px-2 py-3 text-[11px] text-taupe-600 italic">
              No files in this version.
            </div>
          )}
        </div>

        {model.isWorkspaceDropzoneVisible ? (
          <div className="absolute inset-0 z-10 border-t border-taupe-400 bg-taupe-300/88 p-3 backdrop-blur-[1px]">
            <MarbleDropzone
              accept={importAccept}
              className="h-full min-h-0"
              description="Import code or config files into this workspace."
              disabled={model.importingFiles}
              hint="Release to add files to the current program."
              icon={<FilePlusIcon size={20} />}
              multiple
              onFilesChange={(incomingFiles) => {
                void model.handleImportFiles(incomingFiles);
              }}
              title={
                model.importingFiles
                  ? "Importing files..."
                  : "Drop files to import"
              }
              tone="orange"
            />
          </div>
        ) : null}
      </fieldset>
    </MarbleWorkbenchSection>

    <div className="relative shrink-0">
      {model.draftStackCollapsed ? null : (
        <MarbleWorkbenchResizeHandle
          active={model.activeResizePanel === "draftStack"}
          aria-label="Resize draft stack panel"
          className="absolute inset-x-0 top-0"
          onKeyDown={model.handlePanelResizeKeyDown("draftStack")}
          onPointerCancel={model.finishPanelResize}
          onPointerDown={model.handlePanelResizeStart("draftStack", -1)}
          onPointerMove={model.handlePanelResizeMove}
          onPointerUp={model.finishPanelResize}
          title="Resize draft stack panel"
        />
      )}

      <MarbleWorkbenchSection
        actions={
          model.pendingChanges.length > 0 ? (
            <MarbleBadge tone="warning">
              {countLabel(model.pendingChanges.length, "change")}
            </MarbleBadge>
          ) : null
        }
        badge={
          model.draftVersion ? (
            <MarbleBadge tone="warning">Draft</MarbleBadge>
          ) : model.latestPublishedVersion ? (
            <MarbleBadge className="font-mono">
              v{model.nextVersionNumber}
            </MarbleBadge>
          ) : null
        }
        bodyClassName="bg-transparent"
        bodyStyle={{
          height: model.draftStackHeight,
        }}
        className="shrink-0 rounded-none border-0 border-b border-taupe-400 bg-transparent shadow-none"
        collapsed={model.draftStackCollapsed}
        collapsible
        headerClassName="px-2 py-1.5"
        icon={
          <GitBranchIcon
            className="text-taupe-700"
            size={16}
            weight="regular"
          />
        }
        onToggleCollapsed={() =>
          model.setDraftStackCollapsed((current) => !current)
        }
        title="Draft Stack"
      >
        <div className="h-full overflow-y-auto overscroll-contain bg-transparent">
          {model.draftStackCards.map((change) => (
            <DraftStackRow
              change={change}
              key={change.id}
            />
          ))}
        </div>
      </MarbleWorkbenchSection>
    </div>

    <div className="relative shrink-0">
      {model.versionsCollapsed ? null : (
        <MarbleWorkbenchResizeHandle
          active={model.activeResizePanel === "versions"}
          aria-label="Resize versions panel"
          className="absolute inset-x-0 top-0"
          onKeyDown={model.handlePanelResizeKeyDown("versions")}
          onPointerCancel={model.finishPanelResize}
          onPointerDown={model.handlePanelResizeStart("versions", -1)}
          onPointerMove={model.handlePanelResizeMove}
          onPointerUp={model.finishPanelResize}
          title="Resize versions panel"
        />
      )}

      <MarbleWorkbenchSection
        badge={
          model.latestPublishedVersion ? (
            <MarbleBadge className="font-mono">
              v{model.latestPublishedVersion.version}
            </MarbleBadge>
          ) : null
        }
        bodyClassName="bg-transparent"
        bodyStyle={{
          height: model.versionsHeight,
        }}
        className="shrink-0 rounded-none border-0 bg-transparent shadow-none"
        collapsed={model.versionsCollapsed}
        collapsible
        headerClassName="px-2 py-1.5"
        icon={<ClockIcon size={16} />}
        onToggleCollapsed={() =>
          model.setVersionsCollapsed((current) => !current)
        }
        title="Versions"
      >
        <div className="h-full overflow-y-auto overscroll-contain bg-transparent">
          {model.programVersions.length > 0 ? (
            <>
              {model.draftVersion ? (
                <CurrentWorkspaceRow
                  active={model.selectedVersionView === "current"}
                  draftVersion={model.draftVersion}
                  latestPublishedVersion={model.latestPublishedVersion}
                  onSelect={() => model.setSelectedVersionView("current")}
                />
              ) : null}
              {model.programVersions.map((version) => (
                <VersionHistoryRow
                  active={
                    model.selectedVersionView === version.id ||
                    (!model.draftVersion &&
                      model.selectedVersionView === "current" &&
                      version.id === model.latestPublishedVersion?.id)
                  }
                  activeBadge={
                    !model.draftVersion &&
                    model.selectedVersionView === "current" &&
                    version.id === model.latestPublishedVersion?.id
                      ? "Live"
                      : "Viewing"
                  }
                  key={version.id}
                  onSelect={() =>
                    model.setSelectedVersionView(
                      !model.draftVersion &&
                        version.id === model.latestPublishedVersion?.id
                        ? "current"
                        : version.id,
                    )
                  }
                  targetKey={changeTargetKey.programVersion(version.id)}
                  version={version}
                />
              ))}
            </>
          ) : (
            <div className="px-3 py-4 text-taupe-600 text-xs italic">
              {model.isDraftProgram
                ? "Save the draft to start version history."
                : "No saved versions yet."}
            </div>
          )}
        </div>
      </MarbleWorkbenchSection>
    </div>
  </div>
);
