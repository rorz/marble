import {
  cx,
  MarbleAlert,
  MarblePane,
  MarblePaneEditableCrumb,
} from "@marble/ui";
import { EditorCenterPanel } from "./center-panel";
import { EditorLeftPanel } from "./left-panel";
import { NewFileModal } from "./new-file-modal";
import { EditorRightPanel } from "./right-panel";
import type { ProgramEditorViewModel } from "./types";

export const ProgramEditorView = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <MarblePane
    crumbs={[
      {
        href: "/programs",
        id: "programs",
        label: "Programs",
      },
      {
        id: "program-name",
        label:
          !model.isDraftProgram && model.selectedProgram ? (
            <MarblePaneEditableCrumb
              disabled={model.isSystemProgram}
              editing={model.editingSurface === "crumb"}
              onCancel={() => {
                model.setEditingSurface(null);
                model.setProgName(model.selectedProgram?.name ?? "");
              }}
              onChange={model.setProgName}
              onCommit={() => void model.persistProgramName()}
              onEdit={() => model.setEditingSurface("crumb")}
              value={model.progName || "Untitled Program"}
            />
          ) : (
            "New Program"
          ),
      },
    ]}
    frame="none"
  >
    <div className="space-y-4 size-full">
      {model.renameError ? (
        <MarbleAlert tone="error">{model.renameError}</MarbleAlert>
      ) : null}

      <div
        className={cx(
          "flex size-full min-h-0 overflow-hidden rounded-md border border-taupe-400 bg-workbench-surface text-zinc-800",
          "rounded-t-none",
        )}
      >
        <EditorLeftPanel model={model} />
        <EditorCenterPanel model={model} />
        <EditorRightPanel model={model} />
      </div>
    </div>

    <NewFileModal model={model} />
  </MarblePane>
);
