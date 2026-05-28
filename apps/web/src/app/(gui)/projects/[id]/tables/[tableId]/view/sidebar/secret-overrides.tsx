import {
  MarbleAlert,
  MarbleBadge,
  MarbleButton,
  MarbleFieldLabel,
  MarbleSelect,
} from "@marble/ui";
import type { Dispatch, SetStateAction } from "react";
import { describeColumnSecretResolution } from "../schema-fields";
import type {
  ProgramSecretBindingMap,
  ProgramSecretDeclarationsByProgramId,
  SecretRecord,
} from "../types";

type ProgramSecretDeclaration =
  ProgramSecretDeclarationsByProgramId[string][number];

type SecretOverridesProps = {
  declarations: ProgramSecretDeclaration[];
  onOpenSecrets: () => void;
  programId: string;
  programSecretBindings: ProgramSecretBindingMap;
  secretBindings: Record<string, string>;
  secrets: SecretRecord[];
  setSecretBindings: Dispatch<SetStateAction<Record<string, string>>>;
};

export const SecretOverrides = ({
  declarations,
  onOpenSecrets,
  programId,
  programSecretBindings,
  secretBindings,
  secrets,
  setSecretBindings,
}: SecretOverridesProps) => {
  if (declarations.length === 0) {
    return (
      <MarbleAlert
        size="sm"
        tone="neutral"
      >
        This program version does not declare any secret requirements.
      </MarbleAlert>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <MarbleFieldLabel className="text-taupe-700">
          Secret Overrides
        </MarbleFieldLabel>
        {secrets.length === 0 ? (
          <MarbleButton
            onClick={onOpenSecrets}
            size="xs"
            variant="light"
          >
            Open Secrets
          </MarbleButton>
        ) : null}
      </div>

      {declarations.map((declaration) => {
        const overrideSecretId = secretBindings[declaration.env];
        const resolution = describeColumnSecretResolution(declaration, {
          overrideSecretId,
          programDefaultSecretId:
            programSecretBindings[programId]?.[declaration.env],
          secrets,
        });

        return (
          <div
            className="space-y-3 rounded-xs border border-taupe-200 bg-taupe-50/60 p-3"
            key={declaration.env}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-taupe-950">
                  {declaration.env}
                </span>
                <MarbleBadge tone={resolution.badgeTone}>
                  {resolution.badgeLabel}
                </MarbleBadge>
              </div>
              <div className="text-xs text-taupe-700">{declaration.label}</div>
              {declaration.description ? (
                <div className="text-[11px] text-taupe-500">
                  {declaration.description}
                </div>
              ) : null}
            </div>

            <MarbleSelect
              onChange={(event) =>
                setSecretBindings((current) => {
                  const nextBindings = {
                    ...current,
                  };

                  if (event.target.value) {
                    nextBindings[declaration.env] = event.target.value;
                  } else {
                    delete nextBindings[declaration.env];
                  }

                  return nextBindings;
                })
              }
              size="xs"
              value={overrideSecretId ?? ""}
              wrapperClassName="w-full"
            >
              <option value="">{resolution.inheritedLabel}</option>
              {overrideSecretId &&
              !secrets.some((secret) => secret.id === overrideSecretId) ? (
                <option value={overrideSecretId}>Missing secret</option>
              ) : null}
              {secrets.map((secret) => (
                <option
                  key={secret.id}
                  value={secret.id}
                >
                  {secret.name}
                </option>
              ))}
            </MarbleSelect>

            <div className="text-[11px] text-taupe-500">
              {resolution.helperText}
            </div>
          </div>
        );
      })}
    </div>
  );
};
