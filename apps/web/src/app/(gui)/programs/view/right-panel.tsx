import { cx } from "@marble/ui";
import { shellPanelClassName } from "./constants";
import { InputSchemaPanel, OutputConfigPanel } from "./schema-panels";
import { SecretsPanel } from "./secret-panel";
import { TestInputsPanel } from "./test-panel";
import type { ProgramEditorViewModel } from "./types";

export const EditorRightPanel = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <div
    className={cx(
      "flex w-[22rem] shrink-0 flex-col border-l",
      shellPanelClassName,
    )}
  >
    <div className="min-h-0 flex-1 overflow-y-auto">
      <InputSchemaPanel model={model} />
      <OutputConfigPanel model={model} />
      <SecretsPanel model={model} />
    </div>
    <TestInputsPanel model={model} />
  </div>
);
