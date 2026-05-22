import {
  cx,
  MarbleBadge,
  MarbleButton,
  MarbleInput,
  MarbleWorkbenchResizeHandle,
  MarbleWorkbenchSection,
  MarbleWorkbenchTab,
  MarbleWorkbenchTabs,
} from "@marble/ui";
import {
  CodeIcon,
  FileTextIcon,
  FolderOpenIcon,
  PlayIcon,
  SparkleIcon,
} from "@phosphor-icons/react/ssr";
import { useState } from "react";

export const WorkbenchDemo = () => {
  const [workbenchTabs, setWorkbenchTabs] = useState([
    "input-schema.json",
    "main.ts",
    "package.json",
  ]);
  const [activeWorkbenchTab, setActiveWorkbenchTab] =
    useState("input-schema.json");
  const [isWorkbenchVersionsCollapsed, setIsWorkbenchVersionsCollapsed] =
    useState(false);
  const [isWorkbenchDraftCollapsed, setIsWorkbenchDraftCollapsed] =
    useState(false);

  const handleWorkbenchTabClose = (filename: string) => {
    setWorkbenchTabs((current) => {
      const currentIndex = current.indexOf(filename);

      if (currentIndex === -1) {
        return current;
      }

      const nextTabs = current.filter((tab) => tab !== filename);

      setActiveWorkbenchTab((currentActiveTab) =>
        currentActiveTab === filename
          ? (nextTabs[currentIndex] ?? nextTabs[currentIndex - 1] ?? "")
          : currentActiveTab,
      );

      return nextTabs;
    });
  };

  return (
    <div className="overflow-hidden rounded-sm border border-taupe-200 bg-workbench-surface p-2 shadow-sm">
      <div className="grid gap-2 lg:grid-cols-[12rem_minmax(0,1fr)_15rem]">
        <div className="flex min-h-0 flex-col rounded-sm border border-taupe-300 bg-taupe-100/70">
          <MarbleWorkbenchSection
            badge={<MarbleBadge className="font-mono">3 files</MarbleBadge>}
            bodyClassName="bg-transparent"
            className="flex min-h-0 flex-1 flex-col rounded-none border-0 border-b border-taupe-300 bg-transparent shadow-none"
            headerClassName="px-2 py-2"
            icon={<FolderOpenIcon size={16} />}
            title="Workspace"
          >
            <div className="space-y-px p-1.5 font-mono text-[11px]">
              {[
                "input-schema.json",
                "main.ts",
                "package.json",
              ].map((filename) => (
                <button
                  className={cx(
                    "flex h-7 w-full items-center gap-2 rounded-sm px-1.5 text-left transition-colors",
                    activeWorkbenchTab === filename
                      ? "bg-white text-taupe-950 shadow-marble-stripe-left"
                      : "text-taupe-700 hover:bg-white/70 hover:text-taupe-950",
                  )}
                  key={filename}
                  onClick={() => {
                    if (!workbenchTabs.includes(filename)) {
                      setWorkbenchTabs((current) => [
                        ...current,
                        filename,
                      ]);
                    }

                    setActiveWorkbenchTab(filename);
                  }}
                  type="button"
                >
                  <FileTextIcon
                    className="shrink-0 text-amber-600"
                    size={14}
                  />
                  <span className="truncate">{filename}</span>
                </button>
              ))}
            </div>
          </MarbleWorkbenchSection>

          {isWorkbenchVersionsCollapsed ? null : (
            <MarbleWorkbenchResizeHandle title="Resize preview" />
          )}

          <MarbleWorkbenchSection
            badge={<MarbleBadge className="font-mono">v8</MarbleBadge>}
            bodyStyle={{
              height: 118,
            }}
            className="shrink-0 rounded-none border-0 bg-transparent shadow-none"
            collapsed={isWorkbenchVersionsCollapsed}
            collapsible
            headerClassName="px-2 py-2"
            icon={<SparkleIcon size={16} />}
            onToggleCollapsed={() =>
              setIsWorkbenchVersionsCollapsed((current) => !current)
            }
            title="Versions"
          >
            <div className="h-full space-y-px overflow-y-auto bg-transparent p-1.5">
              {[
                "v8 · Latest",
                "v7 · 3 files",
                "v6 · 2 files",
              ].map((label) => (
                <div
                  className="rounded-sm border border-taupe-200 bg-white/85 px-2 py-2 font-mono text-[11px] text-taupe-700"
                  key={label}
                >
                  {label}
                </div>
              ))}
            </div>
          </MarbleWorkbenchSection>
        </div>

        <div className="overflow-hidden rounded-sm border border-taupe-300 bg-white">
          <MarbleWorkbenchTabs>
            {workbenchTabs.map((filename) => (
              <MarbleWorkbenchTab
                active={activeWorkbenchTab === filename}
                dirty={filename === "main.ts"}
                icon={
                  <FileTextIcon
                    className="text-sky-600"
                    size={16}
                  />
                }
                key={filename}
                label={filename}
                onClose={() => handleWorkbenchTabClose(filename)}
                onSelect={() => setActiveWorkbenchTab(filename)}
              />
            ))}
          </MarbleWorkbenchTabs>
          <div className="h-64 bg-white p-4 font-mono text-[12px] leading-6 text-taupe-800">
            <pre>{`export default async function run(input) {\n  return {\n    mood: input.vibe?.label ?? "calm",\n    ok: true,\n  };\n}`}</pre>
          </div>
        </div>

        <div className="space-y-2">
          <MarbleWorkbenchSection
            actions={<MarbleBadge tone="warning">3 pending</MarbleBadge>}
            badge={<MarbleBadge className="font-mono">v9</MarbleBadge>}
            bodyStyle={{
              height: 172,
            }}
            collapsed={isWorkbenchDraftCollapsed}
            collapsible
            description="Saving mints the next version while live runs stay on v8."
            icon={<CodeIcon size={16} />}
            onToggleCollapsed={() =>
              setIsWorkbenchDraftCollapsed((current) => !current)
            }
            title="Draft Stack"
          >
            <div className="h-full overflow-y-auto p-2">
              {[
                "Base v8",
                "Edited input schema",
                "Edited main.ts",
                "Added package.json",
              ].map((label, index) => (
                <div
                  className="rounded-sm border border-taupe-300 bg-white px-3 py-2 shadow-sm"
                  key={label}
                  style={{
                    marginLeft: `${index * 10}px`,
                  }}
                >
                  <div className="font-medium text-[12px] text-taupe-900">
                    {label}
                  </div>
                  <div className="mt-1 text-[11px] text-taupe-500">
                    Layered change cards keep the next version legible before
                    you commit it.
                  </div>
                </div>
              ))}
              <MarbleWorkbenchResizeHandle title="Resize preview" />
            </div>
          </MarbleWorkbenchSection>

          <MarbleWorkbenchSection
            badge={<MarbleBadge tone="info">Saved v8</MarbleBadge>}
            bodyStyle={{
              height: 140,
            }}
            description="Testing stays pinned to the latest saved version until the draft stack is committed."
            icon={<PlayIcon size={16} />}
            title="Test Inputs"
          >
            <div className="space-y-2 p-2">
              <MarbleInput
                size="sm"
                type="text"
                value="cheerful"
                wrapperClassName="w-full"
              />
              <MarbleButton
                className="w-full"
                size="sm"
                variant="orange"
              >
                Run saved version
              </MarbleButton>
            </div>
          </MarbleWorkbenchSection>
        </div>
      </div>
    </div>
  );
};
