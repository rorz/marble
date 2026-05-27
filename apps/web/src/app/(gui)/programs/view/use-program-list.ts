import { getErrorMessage } from "@marble/lib/result";
import { normalizeDisplayLabel } from "@marble/lib/string";
import type { MarbleRouter } from "@marble/ui";
import { marbleToast } from "@marble/ui";
import { useCallback, useEffect, useState } from "react";
import { useMarbleWebSessionSdk } from "../../../../lib/marble-sdk-client";
import {
  createDefaultProgram,
  createProgramFromVersion,
} from "../../../../lib/program-client";
import * as actions from "../actions";
import { normalizeProgramFiles } from "./files";
import { getLatestPublishedVersion, sortPrograms } from "./programs";
import { normalizeProgramVersionMutation } from "./sdk";
import { normalizeStoredProgramSecretConfig } from "./secret-config";
import type {
  FullProgram,
  LibrarySurface,
  ProgramVersionMutation,
  ProgramVersionWithFiles,
} from "./types";

export const useProgramList = ({
  initialPrograms,
  router,
}: {
  initialPrograms: FullProgram[];
  router: MarbleRouter;
}) => {
  const sdk = useMarbleWebSessionSdk();
  const [programs, setPrograms] = useState(() => sortPrograms(initialPrograms));
  const [createError, setCreateError] = useState<null | string>(null);
  const [createPending, setCreatePending] = useState(false);
  const [forkingProgramId, setForkingProgramId] = useState<null | string>(null);
  const [librarySurface, setLibrarySurface] = useState<LibrarySurface>("mine");

  useEffect(() => {
    setPrograms(sortPrograms(initialPrograms));
  }, [
    initialPrograms,
  ]);

  const refreshPrograms = useCallback(async () => {
    const nextPrograms = sortPrograms(await actions.listPrograms());
    setPrograms(nextPrograms);
    return nextPrograms;
  }, []);

  const upsertProgramVersion = useCallback(
    (
      programId: string,
      nextVersion: ProgramVersionMutation | ProgramVersionWithFiles,
    ) => {
      const normalizedVersion = normalizeProgramVersionMutation(nextVersion);

      setPrograms((current) =>
        sortPrograms(
          current.map((program) =>
            program.id === programId
              ? {
                  ...program,
                  programVersions: [
                    ...program.programVersions.filter(
                      (version) => version.id !== normalizedVersion.id,
                    ),
                    normalizedVersion,
                  ],
                  updatedAt: normalizedVersion.updatedAt,
                }
              : program,
          ),
        ),
      );

      return normalizedVersion;
    },
    [],
  );

  const updateSelectedProgramName = useCallback(
    (programId: string, name: string) => {
      setPrograms((current) =>
        sortPrograms(
          current.map((program) =>
            program.id === programId
              ? {
                  ...program,
                  name,
                  updatedAt: new Date().toISOString(),
                }
              : program,
          ),
        ),
      );
    },
    [],
  );

  const handleCreateProgram = useCallback(async () => {
    setCreatePending(true);
    setCreateError(null);

    try {
      const { programId } = await createDefaultProgram(sdk);
      router.push(`/programs/${programId}`);
    } catch (error) {
      setCreateError(getErrorMessage(error));
      setCreatePending(false);
    }
  }, [
    router,
    sdk,
  ]);

  const handleOpenProgram = useCallback(
    (programId: string) => {
      router.push(`/programs/${programId}`);
    },
    [
      router,
    ],
  );

  const handleForkProgram = useCallback(
    async (program: FullProgram) => {
      const latestVersion = getLatestPublishedVersion(program);

      if (!latestVersion) {
        marbleToast.error("No published version to fork");
        return;
      }

      setForkingProgramId(program.id);

      try {
        const { programId } = await createProgramFromVersion(sdk, {
          files: normalizeProgramFiles(latestVersion.programFiles),
          forkedFromVersionId: latestVersion.id,
          name: `Copy of ${normalizeDisplayLabel(program.name, "Untitled Program")}`,
          secretConfig: normalizeStoredProgramSecretConfig(
            latestVersion.secretConfig,
          ),
        });

        marbleToast.success("Program forked");
        router.push(`/programs/${programId}`);
      } catch (error) {
        marbleToast.error("Program fork failed", {
          description: getErrorMessage(error),
        });
      } finally {
        setForkingProgramId(null);
      }
    },
    [
      router,
      sdk,
    ],
  );

  return {
    createError,
    createPending,
    forkingProgramId,
    handleCreateProgram,
    handleForkProgram,
    handleOpenProgram,
    librarySurface,
    programs,
    refreshPrograms,
    setLibrarySurface,
    setPrograms,
    updateSelectedProgramName,
    upsertProgramVersion,
  };
};
