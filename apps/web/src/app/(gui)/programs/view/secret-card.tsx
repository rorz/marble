import { MarbleAlert, MarbleBadge, MarbleSelect } from "@marble/ui";
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
  const hasMissingBoundSecret =
    explicitSecretId !== undefined &&
    !model.initialSecrets.some((secret) => secret.id === explicitSecretId);
  const showLabel =
    normalizedLabel.length > 0 && normalizedLabel !== normalizedEnvName;

  return (
    <div className="space-y-2 rounded-xs border border-taupe-200 bg-white/80 px-2.5 py-2.5">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="min-w-0 max-w-full break-all font-mono text-[12px] leading-5 text-taupe-950">
            {normalizedEnvName || "NEW_SECRET"}
          </span>
          {secret.required ? (
            <MarbleBadge tone="warning">Required</MarbleBadge>
          ) : null}
          {hasMissingBoundSecret ? (
            <MarbleBadge tone="warning">Missing</MarbleBadge>
          ) : null}
        </div>
        {showLabel || secret.description.trim().length > 0 ? (
          <p className="line-clamp-2 text-[11px] leading-4 text-taupe-500">
            {secret.description.trim() || normalizedLabel}
          </p>
        ) : null}
      </div>
      <MarbleSelect
        aria-label={`Default secret for ${normalizedEnvName}`}
        disabled={
          !model.canEditWorkspace ||
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
        <option value="">No default</option>
        {hasMissingBoundSecret ? (
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

      {declarationIssue ? (
        <MarbleAlert
          size="sm"
          tone="warning"
        >
          {declarationIssue}
        </MarbleAlert>
      ) : null}
    </div>
  );
};
