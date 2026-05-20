import {
  MarbleBadge,
  MarbleTextarea,
  MarbleWorkbenchResizeHandle,
  MarbleWorkbenchSection,
} from "@marble/ui";
import { CodeIcon, FileTextIcon } from "@phosphor-icons/react/dist/ssr";
import {
  stackedWorkbenchBodyClassName,
  stackedWorkbenchHeaderClassName,
  stackedWorkbenchSectionClassName,
} from "./constants";
import type { ProgramEditorViewModel } from "./types";

export const InputSchemaPanel = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <MarbleWorkbenchSection
    badge={
      !model.viewingHistoricalVersion &&
      model.inputSchemaStr !== model.latestInputSchemaStr ? (
        <MarbleBadge tone="warning">Draft</MarbleBadge>
      ) : null
    }
    bodyClassName={stackedWorkbenchBodyClassName}
    bodyStyle={{
      height: model.rightPanelHeights.inputSchema,
    }}
    className={stackedWorkbenchSectionClassName}
    collapsed={model.rightPanelCollapsed.inputSchema}
    collapsible
    headerClassName={stackedWorkbenchHeaderClassName}
    icon={
      <FileTextIcon
        className="text-amber-600"
        size={16}
      />
    }
    onToggleCollapsed={() =>
      model.setRightPanelCollapsed((current) => ({
        ...current,
        inputSchema: !current.inputSchema,
      }))
    }
    title="Input Schema"
  >
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 p-2">
        <MarbleTextarea
          className="h-full min-h-full resize-none leading-5"
          monospace
          onChange={(event) => model.setInputSchemaStr(event.target.value)}
          readOnly={!model.canEditWorkspace}
          size="xs"
          value={model.visibleInputSchemaStr}
          wrapperClassName="flex h-full w-full flex-1"
        />
      </div>
      <MarbleWorkbenchResizeHandle
        active={model.activeResizePanel === "inputSchema"}
        aria-label="Resize input schema"
        onKeyDown={model.handlePanelResizeKeyDown("inputSchema")}
        onPointerCancel={model.finishPanelResize}
        onPointerDown={model.handlePanelResizeStart("inputSchema", 1)}
        onPointerMove={model.handlePanelResizeMove}
        onPointerUp={model.finishPanelResize}
        title="Resize input schema"
      />
    </div>
  </MarbleWorkbenchSection>
);

export const OutputConfigPanel = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <MarbleWorkbenchSection
    badge={
      !model.viewingHistoricalVersion &&
      model.outputConfigStr !== model.latestOutputConfigStr ? (
        <MarbleBadge tone="warning">Draft</MarbleBadge>
      ) : null
    }
    bodyClassName={stackedWorkbenchBodyClassName}
    bodyStyle={{
      height: model.rightPanelHeights.outputConfig,
    }}
    className={stackedWorkbenchSectionClassName}
    collapsed={model.rightPanelCollapsed.outputConfig}
    collapsible
    headerClassName={stackedWorkbenchHeaderClassName}
    icon={
      <CodeIcon
        className="text-sky-600"
        size={16}
      />
    }
    onToggleCollapsed={() =>
      model.setRightPanelCollapsed((current) => ({
        ...current,
        outputConfig: !current.outputConfig,
      }))
    }
    title="Output Config"
  >
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 p-2">
        <MarbleTextarea
          className="h-full min-h-full resize-none leading-5"
          monospace
          onChange={(event) => model.setOutputConfigStr(event.target.value)}
          readOnly={!model.canEditWorkspace}
          size="xs"
          value={model.visibleOutputConfigStr}
          wrapperClassName="flex h-full w-full flex-1"
        />
      </div>
      <MarbleWorkbenchResizeHandle
        active={model.activeResizePanel === "outputConfig"}
        aria-label="Resize output config"
        onKeyDown={model.handlePanelResizeKeyDown("outputConfig")}
        onPointerCancel={model.finishPanelResize}
        onPointerDown={model.handlePanelResizeStart("outputConfig", 1)}
        onPointerMove={model.handlePanelResizeMove}
        onPointerUp={model.finishPanelResize}
        title="Resize output config"
      />
    </div>
  </MarbleWorkbenchSection>
);
