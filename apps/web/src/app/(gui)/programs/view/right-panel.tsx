import { cx } from "@marble/ui";
import { shellPanelClassName } from "./constants";
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
      "flex min-h-0 w-[22rem] shrink-0 flex-col overflow-hidden border-l",
      shellPanelClassName,
    )}
  >
    <SecretsPanel model={model} />
    <TestInputsPanel model={model} />
  </div>
);
