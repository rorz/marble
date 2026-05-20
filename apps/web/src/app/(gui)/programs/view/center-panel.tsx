import {
  cx,
  MarbleBadge,
  MarbleButton,
  MarbleEditableText,
  MarbleFieldLabel,
  MarbleWorkbenchTab,
  MarbleWorkbenchTabs,
} from "@marble/ui";
import { FileTextIcon, GitBranchIcon } from "@phosphor-icons/react/dist/ssr";
import { changeTargetKey, getChangeTargetProps } from "../../change-spotlight";
import {
  editorTabActiveClassName,
  editorTabBaseClassName,
  editorTabIdleClassName,
  MonacoEditor,
  monacoEditorOptions,
} from "./constants";
import { getFileAccent } from "./files";
import { getMonacoLanguage, getMonacoModelPath } from "./monaco";
import { countLabel } from "./programs";
import type { ProgramEditorViewModel } from "./types";

export const EditorCenterPanel = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <div className="flex min-w-0 flex-1 flex-col bg-taupe-50">
    <div className="border-b border-taupe-200 bg-linear-to-r from-taupe-100 via-taupe-50 to-white px-4 py-3">
      <div
        className="flex items-start justify-between gap-4"
        {...getChangeTargetProps(
          changeTargetKey.program(model.activeProgramTargetId),
        )}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <MarbleEditableText
            className="-mx-1 rounded-sm px-1 text-left text-3xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
            disabled={!model.canEditWorkspace}
            editing={model.editingSurface === "title"}
            onCancel={() => {
              model.setEditingSurface(null);
              model.setProgName(model.selectedProgram?.name ?? model.progName);
            }}
            onChange={model.setProgName}
            onCommit={() => void model.persistProgramName()}
            onEdit={() => model.setEditingSurface("title")}
            value={model.progName || "Untitled Program"}
          />

          <div className="flex flex-wrap items-center gap-2">
            {model.selectedProgram?.firstParty ? (
              <MarbleBadge
                caps
                tone="info"
              >
                System
              </MarbleBadge>
            ) : (
              <MarbleBadge
                caps
                tone="solid"
              >
                Custom
              </MarbleBadge>
            )}
            {model.viewingHistoricalVersion &&
            model.selectedHistoricalVersion ? (
              <MarbleBadge tone="neutral">
                Viewing v{model.selectedHistoricalVersion.version}
              </MarbleBadge>
            ) : model.draftVersion && model.latestPublishedVersion ? (
              <MarbleBadge tone="warning">
                Draft from v{model.latestPublishedVersion.version}
              </MarbleBadge>
            ) : model.draftVersion ? (
              <MarbleBadge tone="warning">Draft</MarbleBadge>
            ) : model.latestPublishedVersion ? (
              <MarbleBadge className="font-mono">
                Published v{model.latestPublishedVersion.version}
              </MarbleBadge>
            ) : null}
            {model.visibleFiles.length > 0 ? (
              <MarbleBadge>
                {countLabel(model.visibleFiles.length, "file")}
              </MarbleBadge>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {model.draftBootstrapPending ||
          model.draftSyncPending ||
          model.historicalDraftPending ? (
            <span className="text-[11px] text-taupe-500">Syncing draft...</span>
          ) : model.draftSyncBlockedReason &&
            model.canEditWorkspace &&
            model.hasUnsavedChanges ? (
            <span className="text-[11px] text-amber-700">
              Draft sync paused
            </span>
          ) : null}

          {model.viewingHistoricalVersion && model.draftVersion ? (
            <MarbleButton
              onClick={() => model.setSelectedVersionView("current")}
              size="sm"
              type="button"
            >
              Return to draft
            </MarbleButton>
          ) : null}

          {model.viewingHistoricalVersion &&
          !model.draftVersion &&
          !model.isSystemProgram &&
          model.selectedHistoricalVersion ? (
            <MarbleButton
              disabled={model.historicalDraftPending}
              onClick={() =>
                void model.handleCreateDraftFromHistoricalVersion()
              }
              size="sm"
              type="button"
            >
              {model.historicalDraftPending
                ? "Creating draft..."
                : `Create draft from v${model.selectedHistoricalVersion.version}`}
            </MarbleButton>
          ) : null}

          <MarbleButton
            disabled={
              !model.canEditWorkspace ||
              model.viewingHistoricalVersion ||
              model.saving ||
              !model.progName.trim() ||
              model.files.length === 0 ||
              !model.hasUnsavedChanges
            }
            onClick={() => void model.handleSave()}
            size="sm"
            type="button"
            variant="orange"
          >
            {model.saving ? "Publishing..." : "Publish version"}
          </MarbleButton>
          {model.selectedProgram?.firstParty ? (
            <MarbleButton
              disabled={model.forkingProgramId === model.selectedProgram.id}
              iconLeft={GitBranchIcon}
              onClick={() => {
                if (!model.selectedProgram) {
                  return;
                }

                void model.handleForkProgram(model.selectedProgram);
              }}
              size="sm"
              type="button"
            >
              {model.forkingProgramId === model.selectedProgram.id
                ? "Forking..."
                : "Fork program"}
            </MarbleButton>
          ) : null}
        </div>
      </div>
    </div>

    <MarbleWorkbenchTabs>
      {model.openTabFiles.length > 0 ? (
        model.openTabFiles.map((file) => (
          <MarbleWorkbenchTab
            active={model.activeFile === file.filename}
            className={cx(
              editorTabBaseClassName,
              model.activeFile === file.filename
                ? editorTabActiveClassName
                : editorTabIdleClassName,
            )}
            dirty={model.dirtyFiles.has(file.filename)}
            icon={
              <FileTextIcon
                className={getFileAccent(file.filename)}
                size={16}
              />
            }
            key={file.filename}
            label={file.filename}
            onClose={() => model.handleCloseTab(file.filename)}
            onSelect={() => model.setActiveFile(file.filename)}
          />
        ))
      ) : (
        <div className="flex h-9 items-center px-3 text-[11px] text-taupe-500">
          Select a file from the workspace to open a tab.
        </div>
      )}
    </MarbleWorkbenchTabs>

    <div className="relative flex-1 overflow-hidden bg-white">
      {model.activeFileObj ? (
        <div className="absolute inset-0">
          <MonacoEditor
            height="100%"
            language={getMonacoLanguage(model.activeFileObj)}
            loading={
              <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
                Loading Monaco...
              </div>
            }
            onChange={(value) => model.handleCodeChange(value ?? "")}
            options={{
              ...monacoEditorOptions,
              readOnly: !model.canEditWorkspace,
            }}
            path={getMonacoModelPath(
              model.viewingHistoricalVersion
                ? (model.selectedHistoricalVersion?.id ??
                    model.initialProgramId ??
                    null)
                : (model.initialProgramId ?? null),
              model.activeFileObj.filename,
            )}
            theme="vs"
            value={model.activeFileObj.content}
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-taupe-500 text-xs">
          Select or create a file to open a tab.
        </div>
      )}
    </div>

    <div className="flex h-36 shrink-0 flex-col border-t border-taupe-200 bg-linear-to-b from-taupe-50 to-white">
      <div className="flex items-center justify-between border-b border-taupe-200 px-3 py-2">
        <MarbleFieldLabel className="mb-0 text-taupe-600">
          Output Log
        </MarbleFieldLabel>
        {model.log.length > 0 ? (
          <MarbleBadge>
            {countLabel(model.log.length, "entry", "entries")}
          </MarbleBadge>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-5">
        {model.log.length === 0 ? (
          <span className="text-taupe-500">No output yet...</span>
        ) : (
          model.log.map((entry, index) => (
            <div
              className={cx(
                entry.includes("✗")
                  ? "text-red-600"
                  : entry.includes("✓")
                    ? "text-emerald-700"
                    : "text-taupe-800",
              )}
              // biome-ignore lint/suspicious/noArrayIndexKey: log entries are append-only UI state
              key={`${index}-${entry.slice(0, 16)}`}
            >
              {entry}
            </div>
          ))
        )}
      </div>
    </div>
  </div>
);
