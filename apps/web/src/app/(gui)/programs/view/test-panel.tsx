import { stringifyPretty } from "@marble/lib/json";
import {
  cx,
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
  MarbleWorkbenchSection,
} from "@marble/ui";
import { PlayIcon } from "@phosphor-icons/react/dist/ssr";
import {
  stackedWorkbenchBodyClassName,
  stackedWorkbenchHeaderClassName,
} from "./constants";
import type { ProgramEditorViewModel } from "./types";

const MissingSecretsView = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <div className="space-y-3 px-3 py-3">
    <MarbleAlert
      size="sm"
      tone="warning"
    >
      This run is waiting for secret configuration.
    </MarbleAlert>
    <div className="space-y-2">
      {model.missingSecretConfigurationDetail?.missingSecrets.map((secret) => (
        <div
          className="rounded-xs border border-taupe-200 bg-white/70 px-3 py-2"
          key={secret.envName}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-taupe-900">
              {secret.envName}
            </span>
            <MarbleBadge tone="warning">
              {secret.bindingSource === "program" ? "Program" : "Column"}
            </MarbleBadge>
          </div>
          <div className="mt-1 text-[11px] text-taupe-600">{secret.label}</div>
          {secret.description ? (
            <div className="mt-1 text-[11px] text-taupe-500">
              {secret.description}
            </div>
          ) : null}
        </div>
      ))}
    </div>
    <MarbleButton
      onClick={model.onOpenSecrets}
      size="xs"
      variant="light"
    >
      Open Secrets
    </MarbleButton>
  </div>
);

const LastRunView = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => {
  const result = model.result;

  if (!result) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-sm border border-taupe-300 bg-white/85 shadow-sm">
      <div className="flex items-center gap-2 border-b border-taupe-200 px-3 py-2">
        <MarbleFieldLabel className="mb-0 text-taupe-600">
          Last Run
        </MarbleFieldLabel>
        <MarbleBadge
          caps
          tone={result.ok ? "success" : "error"}
        >
          {result.ok ? "Success" : "Error"}
        </MarbleBadge>
      </div>
      {result.ok ? (
        <div className="max-h-48 overflow-auto break-words px-3 py-2 font-mono text-[11px] leading-5 text-taupe-800">
          {stringifyPretty(result.output)}
        </div>
      ) : model.missingSecretConfigurationDetail ? (
        <MissingSecretsView model={model} />
      ) : (
        <div className="max-h-48 overflow-auto break-words px-3 py-2 font-mono text-[11px] leading-5 text-taupe-800">
          {result.error}
        </div>
      )}
    </div>
  );
};

export const TestInputsPanel = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <div
    className={
      model.rightPanelCollapsed.testInputs
        ? "relative shrink-0"
        : "relative min-h-0 flex-1"
    }
  >
    <MarbleWorkbenchSection
      actions={
        model.selectedProgram?.firstParty ? (
          <MarbleBadge
            caps
            tone="warning"
          >
            System
          </MarbleBadge>
        ) : null
      }
      badge={
        model.draftVersion ? (
          <MarbleBadge tone="warning">Draft</MarbleBadge>
        ) : model.latestPublishedVersion ? (
          <MarbleBadge className="font-mono">
            v{model.latestPublishedVersion.version}
          </MarbleBadge>
        ) : null
      }
      bodyClassName={`${stackedWorkbenchBodyClassName} flex-1`}
      className={cx(
        "rounded-none border-x-0 border-b-0 bg-transparent shadow-none",
        model.rightPanelCollapsed.testInputs ? "" : "h-full",
      )}
      collapsed={model.rightPanelCollapsed.testInputs}
      collapsible
      headerClassName={stackedWorkbenchHeaderClassName}
      icon={<PlayIcon size={16} />}
      onToggleCollapsed={() =>
        model.setRightPanelCollapsed((current) => ({
          ...current,
          testInputs: !current.testInputs,
        }))
      }
      title="Test"
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          <p className="border-b border-taupe-200 pb-2 text-[11px] leading-5 text-taupe-500">
            {model.draftVersion
              ? model.latestPublishedVersion
                ? `Runs the draft while live columns stay pinned to v${model.latestPublishedVersion.version}.`
                : "Runs the draft directly; nothing live points at it yet."
              : model.latestPublishedVersion
                ? `Runs published v${model.latestPublishedVersion.version}.`
                : "Save the draft before running it."}
          </p>
          {model.fields.length === 0 ? (
            <p className="text-taupe-600 text-xs italic">No inputs required.</p>
          ) : null}

          {model.fields.map((field) => (
            <div
              className="space-y-1.5"
              key={field.key}
            >
              <MarbleFieldLabel className="text-taupe-800">
                {field.title}
              </MarbleFieldLabel>
              {field.enumValues ? (
                <MarbleSelect
                  aria-label={field.title}
                  onChange={(event) =>
                    model.setInputValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  size="sm"
                  value={model.inputValues[field.key] ?? ""}
                  wrapperClassName="w-full"
                >
                  {field.enumValues.map((value) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {value}
                    </option>
                  ))}
                </MarbleSelect>
              ) : (
                <MarbleInput
                  aria-label={field.title}
                  onChange={(event) =>
                    model.setInputValues((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  size="sm"
                  type={field.type === "number" ? "number" : "text"}
                  value={model.inputValues[field.key] ?? ""}
                  wrapperClassName="w-full"
                />
              )}
            </div>
          ))}

          {model.hasManualInput ? (
            <div className="space-y-1.5">
              <MarbleFieldLabel className="text-taupe-800">
                Manual Cell Input
              </MarbleFieldLabel>
              <MarbleInput
                aria-label="Manual Cell Input"
                onChange={(event) => model.setManualInput(event.target.value)}
                placeholder="Cell value..."
                size="sm"
                type="text"
                value={model.manualInput}
                wrapperClassName="w-full"
              />
            </div>
          ) : null}

          <MarbleButton
            className="w-full"
            disabled={
              model.running ||
              (!model.draftVersion && !model.latestPublishedVersion)
            }
            iconLeft={PlayIcon}
            onClick={() => void model.handleRun()}
            size="sm"
            type="button"
            variant="orange"
          >
            {model.running
              ? "Running..."
              : model.draftVersion
                ? "Run Draft"
                : "Run Published Version"}
          </MarbleButton>

          {model.result ? <LastRunView model={model} /> : null}
        </div>
      </div>
    </MarbleWorkbenchSection>
  </div>
);
