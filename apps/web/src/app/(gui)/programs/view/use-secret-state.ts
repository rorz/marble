import { getErrorMessage } from "@marble/lib/result";
import { marbleToast } from "@marble/ui";
import { useCallback, useEffect, useState } from "react";
import { useMarbleWebSessionSdk } from "../../../../lib/marble-sdk-client";
import type { ProgramsPageData } from "../actions";
import {
  getSuggestedSecretEnvironmentName,
  secretBindingEntriesToMap,
  secretBindingMapToEntries,
} from "./secret-config";
import type { EditableProgramSecretDeclaration, FullProgram } from "./types";

export const useSecretState = ({
  canEditWorkspace,
  initialProgramSecretBindings,
  selectedProgram,
}: {
  canEditWorkspace: boolean;
  initialProgramSecretBindings: ProgramsPageData["programSecretBindings"];
  selectedProgram: FullProgram | undefined;
}) => {
  const sdk = useMarbleWebSessionSdk();
  const [programSecretBindings, setProgramSecretBindings] = useState(
    initialProgramSecretBindings,
  );
  const [savingProgramSecrets, setSavingProgramSecrets] = useState(false);
  const [secretConfigDraft, setSecretConfigDraft] = useState<
    EditableProgramSecretDeclaration[]
  >([]);

  useEffect(() => {
    setProgramSecretBindings(initialProgramSecretBindings);
  }, [
    initialProgramSecretBindings,
  ]);

  const handleProgramSecretBindingChange = useCallback(
    async (envName: string, nextSecretId: string) => {
      if (!selectedProgram) {
        return;
      }

      const previousBindings = programSecretBindings[selectedProgram.id] ?? {};
      const nextBindings = {
        ...previousBindings,
      };

      if (nextSecretId) {
        nextBindings[envName] = nextSecretId;
      } else {
        delete nextBindings[envName];
      }

      setProgramSecretBindings((current) => ({
        ...current,
        [selectedProgram.id]: nextBindings,
      }));
      setSavingProgramSecrets(true);

      try {
        const savedBindings = await sdk.secretBindings.setProgram({
          bindings: secretBindingMapToEntries(nextBindings),
          programId: selectedProgram.id,
        });

        setProgramSecretBindings((current) => ({
          ...current,
          [selectedProgram.id]: secretBindingEntriesToMap(savedBindings),
        }));
      } catch (error) {
        setProgramSecretBindings((current) => ({
          ...current,
          [selectedProgram.id]: previousBindings,
        }));
        marbleToast.error("Secret binding failed", {
          description: getErrorMessage(error),
        });
      } finally {
        setSavingProgramSecrets(false);
      }
    },
    [
      programSecretBindings,
      sdk,
      selectedProgram,
    ],
  );

  const handleAddSecretDeclaration = useCallback(() => {
    if (!canEditWorkspace) {
      return;
    }

    const suggestedEnvName =
      getSuggestedSecretEnvironmentName(secretConfigDraft);

    setSecretConfigDraft((current) => [
      ...current,
      {
        description: "",
        env: suggestedEnvName,
        id: crypto.randomUUID(),
        label: suggestedEnvName,
        required: true,
      },
    ]);
  }, [
    canEditWorkspace,
    secretConfigDraft,
  ]);

  const handleRemoveSecretDeclaration = useCallback(
    (secretId: string) => {
      if (!canEditWorkspace) {
        return;
      }

      setSecretConfigDraft((current) =>
        current.filter((secret) => secret.id !== secretId),
      );
    },
    [
      canEditWorkspace,
    ],
  );

  const handleSecretDeclarationChange = useCallback(
    (
      secretId: string,
      field: "description" | "env" | "label" | "required",
      value: boolean | string,
    ) => {
      if (!canEditWorkspace) {
        return;
      }

      setSecretConfigDraft((current) =>
        current.map((secret) => {
          if (secret.id !== secretId) {
            return secret;
          }

          if (field === "required") {
            return {
              ...secret,
              required: value === true,
            };
          }

          const nextValue = typeof value === "string" ? value : "";

          if (field === "env") {
            return {
              ...secret,
              env: nextValue,
              label:
                secret.label === secret.env || secret.label.trim().length === 0
                  ? nextValue
                  : secret.label,
            };
          }

          return {
            ...secret,
            [field]: nextValue,
          };
        }),
      );
    },
    [
      canEditWorkspace,
    ],
  );

  return {
    handleAddSecretDeclaration,
    handleProgramSecretBindingChange,
    handleRemoveSecretDeclaration,
    handleSecretDeclarationChange,
    programSecretBindings,
    savingProgramSecrets,
    secretConfigDraft,
    setSecretConfigDraft,
  };
};
