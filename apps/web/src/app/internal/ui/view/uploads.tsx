import {
  MarbleDropzone,
  MarbleEditableText,
  MarbleFieldLabel,
  MarblePaneEditableCrumb,
} from "@marble/ui";
import {
  CodeIcon,
  FileTextIcon,
  FolderOpenIcon,
} from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { DemoPanel, Section } from "./chrome";

export const UploadsSection = () => {
  const defaultProjectName = "Untitled Project";
  const defaultCrumbName = "Audience Enrichment";
  const [editableValue, setEditableValue] = useState(defaultProjectName);
  const [editableCrumbValue, setEditableCrumbValue] =
    useState(defaultCrumbName);
  const [isEditingCrumb, setIsEditingCrumb] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [multiDropzoneSummary, setMultiDropzoneSummary] = useState(
    "No files selected yet",
  );
  const [singleDropzoneSummary, setSingleDropzoneSummary] = useState(
    "Drop one file to preview its name",
  );

  return (
    <Section
      description="File entry and inline rename states are grouped together here because they both need a little harnessing to read correctly."
      id="uploads"
      title="Uploads"
    >
      <div className="space-y-4">
        <DemoPanel
          description="Neutral, orange, compact, and disabled states."
          title="Dropzones"
        >
          <div className="space-y-4">
            <MarbleDropzone
              accept=".ts,.json,.md"
              description="Multiple file uploads keep the fuller orange treatment."
              hint={multiDropzoneSummary}
              icon={<CodeIcon size={20} />}
              multiple
              onFilesChange={(files) => {
                setMultiDropzoneSummary(
                  files.length === 0
                    ? "No files selected yet"
                    : files.length === 1
                      ? `Selected ${files[0]?.name}`
                      : `Selected ${files.length} files`,
                );
              }}
              title="Import program files"
              tone="orange"
            />

            <MarbleDropzone
              accept=".csv,.json"
              description="Compact dropzone for inline forms."
              hint={singleDropzoneSummary}
              icon={<FileTextIcon size={20} />}
              onFilesChange={(files) => {
                setSingleDropzoneSummary(
                  files[0]?.name ?? "Drop one file to preview its name",
                );
              }}
              size="sm"
              title="Upload a single file"
            />

            <MarbleDropzone
              description="Use the disabled state while uploads are unavailable."
              disabled
              hint="Connect a workspace or enable uploads to activate."
              icon={<FolderOpenIcon size={20} />}
              title="Uploads unavailable"
            />
          </div>
        </DemoPanel>

        <DemoPanel
          description="Title, crumb, and disabled inline rename surfaces."
          title="Editable text"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-1">
              <span className="rounded-sm px-1.5 py-1 font-medium text-base text-taupe-800">
                Projects
              </span>
              <span
                aria-hidden="true"
                className="text-taupe-300"
              >
                &gt;
              </span>
              <MarblePaneEditableCrumb
                editing={isEditingCrumb}
                onCancel={() => {
                  setEditableCrumbValue(defaultCrumbName);
                  setIsEditingCrumb(false);
                }}
                onChange={setEditableCrumbValue}
                onCommit={() => setIsEditingCrumb(false)}
                onEdit={() => setIsEditingCrumb(true)}
                value={editableCrumbValue}
              />
            </div>

            <MarbleEditableText
              className="-mx-1 rounded-sm px-1 text-left text-3xl tracking-tight text-zinc-950 transition-colors hover:text-orange-600"
              editing={isEditingName}
              onCancel={() => {
                setEditableValue(defaultProjectName);
                setIsEditingName(false);
              }}
              onChange={setEditableValue}
              onCommit={() => setIsEditingName(false)}
              onEdit={() => setIsEditingName(true)}
              value={editableValue}
            />

            <div>
              <MarbleFieldLabel>Disabled</MarbleFieldLabel>
              <MarbleEditableText
                className="rounded-sm px-1 text-base text-taupe-800"
                disabled
                editing={false}
                onCancel={() => undefined}
                onChange={() => undefined}
                onCommit={() => undefined}
                onEdit={() => undefined}
                value="Locked project name"
              />
            </div>
          </div>
        </DemoPanel>
      </div>
    </Section>
  );
};
