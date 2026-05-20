import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleWorkbenchResizeHandle,
  MarbleWorkbenchSection,
} from "@marble/ui";
import { KeyIcon } from "@phosphor-icons/react/dist/ssr";
import {
  stackedWorkbenchBodyClassName,
  stackedWorkbenchHeaderClassName,
  stackedWorkbenchSectionClassName,
} from "./constants";
import { SecretRequirementCard } from "./secret-card";
import { describeProgramSecretResolution } from "./secret-config";
import type {
  EditableProgramSecretDeclaration,
  ProgramEditorViewModel,
} from "./types";

const hasSecretWarning = (
  model: ProgramEditorViewModel,
  secret: EditableProgramSecretDeclaration,
) => {
  const declarationIssue = model.visibleSecretDeclarationIssues[secret.id];

  if (declarationIssue) {
    return true;
  }

  const normalizedEnvName = secret.env.trim();
  const resolution = describeProgramSecretResolution(
    {
      ...(secret.description.trim().length > 0
        ? {
            description: secret.description.trim(),
          }
        : {}),
      env: normalizedEnvName,
      label:
        secret.label.trim().length > 0
          ? secret.label.trim()
          : normalizedEnvName,
      required: secret.required,
    },
    model.selectedProgramSecretBindings[normalizedEnvName],
    model.initialSecrets,
  );

  return resolution.badgeTone === "warning";
};

export const SecretsPanel = ({
  model,
}: Readonly<{
  model: ProgramEditorViewModel;
}>) => (
  <MarbleWorkbenchSection
    actions={
      model.canEditWorkspace ? (
        <MarbleButton
          onClick={model.handleAddSecretDeclaration}
          size="xs"
          type="button"
          variant="light"
        >
          Add
        </MarbleButton>
      ) : null
    }
    badge={
      model.visibleSecretDeclarations.length > 0 ? (
        <MarbleBadge
          caps
          tone={
            model.visibleSecretDeclarations.some((secret) =>
              hasSecretWarning(model, secret),
            )
              ? "warning"
              : "neutral"
          }
        >
          {model.visibleSecretDeclarations.length} configured
        </MarbleBadge>
      ) : null
    }
    bodyClassName={stackedWorkbenchBodyClassName}
    bodyStyle={{
      height: model.rightPanelHeights.secrets,
    }}
    className={stackedWorkbenchSectionClassName}
    collapsed={model.rightPanelCollapsed.secrets}
    collapsible
    headerClassName={stackedWorkbenchHeaderClassName}
    icon={
      <KeyIcon
        className="text-taupe-500"
        size={16}
      />
    }
    onToggleCollapsed={() =>
      model.setRightPanelCollapsed((current) => ({
        ...current,
        secrets: !current.secrets,
      }))
    }
    title="Secrets"
  >
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        <p className="text-taupe-600 text-xs leading-5">
          Secret requirements live on the version. Program defaults apply
          everywhere unless a column overrides them.
        </p>

        {!model.selectedProgram ? (
          <MarbleAlert
            size="sm"
            tone="neutral"
          >
            Save this program once before persisting default secret bindings.
          </MarbleAlert>
        ) : null}

        {model.visibleSecretConfigState.error ? (
          <MarbleAlert
            size="sm"
            tone="warning"
          >
            {model.visibleSecretConfigState.error}
          </MarbleAlert>
        ) : null}

        {model.initialSecrets.length === 0 ? (
          <div className="rounded-xs border border-taupe-200 bg-white/80 p-3">
            <div className="text-xs text-taupe-700">
              No named secrets are available yet.
            </div>
            <div className="mt-3">
              <MarbleButton
                onClick={model.onOpenSecrets}
                size="xs"
                variant="light"
              >
                Open Secrets
              </MarbleButton>
            </div>
          </div>
        ) : null}

        {model.savingProgramSecrets ? (
          <MarbleAlert
            size="sm"
            tone="neutral"
          >
            Saving default secret bindings...
          </MarbleAlert>
        ) : null}

        {model.visibleSecretDeclarations.length === 0 &&
        !model.visibleSecretConfigState.error ? (
          <p className="text-taupe-600 text-xs">
            No secret requirements are declared for this version.
          </p>
        ) : null}

        {model.visibleSecretDeclarations.map((secret) => (
          <SecretRequirementCard
            declarationIssue={model.visibleSecretDeclarationIssues[secret.id]}
            key={secret.id}
            model={model}
            secret={secret}
          />
        ))}
      </div>
      <MarbleWorkbenchResizeHandle
        active={model.activeResizePanel === "secrets"}
        aria-label="Resize secrets panel"
        onKeyDown={model.handlePanelResizeKeyDown("secrets")}
        onPointerCancel={model.finishPanelResize}
        onPointerDown={model.handlePanelResizeStart("secrets", 1)}
        onPointerMove={model.handlePanelResizeMove}
        onPointerUp={model.finishPanelResize}
        title="Resize secrets panel"
      />
    </div>
  </MarbleWorkbenchSection>
);
