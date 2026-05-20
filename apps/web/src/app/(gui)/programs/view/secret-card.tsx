import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleFieldLabel,
  MarbleInput,
  MarbleSelect,
  MarbleTextarea,
} from "@marble/ui";
import { describeProgramSecretResolution } from "./secret-config";
import type {
  EditableProgramSecretDeclaration,
  ProgramEditorViewModel,
} from "./types";

export const SecretRequirementCard = ({
  declarationIssue,
  model,
  secret,
}: Readonly<{
  declarationIssue: null | string;
  model: ProgramEditorViewModel;
  secret: EditableProgramSecretDeclaration;
}>) => {
  const normalizedEnvName = secret.env.trim();
  const normalizedLabel =
    secret.label.trim().length > 0 ? secret.label.trim() : normalizedEnvName;
  const explicitSecretId = normalizedEnvName
    ? model.selectedProgramSecretBindings[normalizedEnvName]
    : undefined;
  const resolution =
    declarationIssue === null
      ? describeProgramSecretResolution(
          {
            ...(secret.description.trim().length > 0
              ? {
                  description: secret.description.trim(),
                }
              : {}),
            env: normalizedEnvName,
            label: normalizedLabel,
            required: secret.required,
          },
          explicitSecretId,
          model.initialSecrets,
        )
      : null;

  return (
    <div className="space-y-3 rounded-xs border border-taupe-200 bg-white/85 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[12px] text-taupe-950">
              {normalizedEnvName || "NEW_SECRET"}
            </span>
            {resolution ? (
              <MarbleBadge tone={resolution.badgeTone}>
                {resolution.badgeLabel}
              </MarbleBadge>
            ) : null}
            <MarbleBadge tone={secret.required ? "warning" : "neutral"}>
              {secret.required ? "Required" : "Optional"}
            </MarbleBadge>
          </div>
          <div className="text-[11px] text-taupe-700">
            {normalizedLabel || "Label this secret"}
          </div>
          {secret.description.trim().length > 0 ? (
            <div className="text-[11px] text-taupe-500">
              {secret.description.trim()}
            </div>
          ) : null}
        </div>
        {model.canEditWorkspace ? (
          <MarbleButton
            onClick={() => model.handleRemoveSecretDeclaration(secret.id)}
            size="xs"
            type="button"
            variant="light"
          >
            Remove
          </MarbleButton>
        ) : null}
      </div>

      {declarationIssue ? (
        <MarbleAlert
          size="sm"
          tone="warning"
        >
          {declarationIssue}
        </MarbleAlert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <MarbleFieldLabel className="text-taupe-700">
            Env var
          </MarbleFieldLabel>
          <MarbleInput
            disabled={!model.canEditWorkspace}
            onChange={(event) =>
              model.handleSecretDeclarationChange(
                secret.id,
                "env",
                event.target.value,
              )
            }
            size="xs"
            type="text"
            value={secret.env}
            wrapperClassName="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <MarbleFieldLabel className="text-taupe-700">Label</MarbleFieldLabel>
          <MarbleInput
            disabled={!model.canEditWorkspace}
            onChange={(event) =>
              model.handleSecretDeclarationChange(
                secret.id,
                "label",
                event.target.value,
              )
            }
            size="xs"
            type="text"
            value={secret.label}
            wrapperClassName="w-full"
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem]">
        <div className="space-y-1.5">
          <MarbleFieldLabel className="text-taupe-700">
            Description
          </MarbleFieldLabel>
          <MarbleTextarea
            className="min-h-20 resize-y"
            disabled={!model.canEditWorkspace}
            onChange={(event) =>
              model.handleSecretDeclarationChange(
                secret.id,
                "description",
                event.target.value,
              )
            }
            size="xs"
            value={secret.description}
            wrapperClassName="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <MarbleFieldLabel className="text-taupe-700">
            Requirement
          </MarbleFieldLabel>
          <MarbleSelect
            disabled={!model.canEditWorkspace}
            onChange={(event) =>
              model.handleSecretDeclarationChange(
                secret.id,
                "required",
                event.target.value === "required",
              )
            }
            size="xs"
            value={secret.required ? "required" : "optional"}
            wrapperClassName="w-full"
          >
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </MarbleSelect>
        </div>
      </div>

      <div className="space-y-1.5">
        <MarbleFieldLabel className="text-taupe-700">
          Default secret
        </MarbleFieldLabel>
        <MarbleSelect
          disabled={
            !model.selectedProgram ||
            model.savingProgramSecrets ||
            declarationIssue !== null
          }
          onChange={(event) =>
            void model.handleProgramSecretBindingChange(
              normalizedEnvName,
              event.target.value,
            )
          }
          size="xs"
          value={explicitSecretId ?? ""}
          wrapperClassName="w-full"
        >
          <option value="">
            {resolution?.implicitSecret
              ? `Use matching secret (${resolution.implicitSecret.name})`
              : "No default binding"}
          </option>
          {explicitSecretId &&
          !model.initialSecrets.some(
            (secret) => secret.id === explicitSecretId,
          ) ? (
            <option value={explicitSecretId}>Missing secret</option>
          ) : null}
          {model.initialSecrets.map((secret) => (
            <option
              key={secret.id}
              value={secret.id}
            >
              {secret.name}
            </option>
          ))}
        </MarbleSelect>
      </div>

      <div className="text-[11px] text-taupe-500">
        {declarationIssue
          ? "Fix this declaration before draft sync resumes."
          : resolution?.helperText}
      </div>
    </div>
  );
};
