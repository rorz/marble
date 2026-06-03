import "server-only";

import { dedupeById, groupBy, sortBy } from "@marble/lib/array";
import { byString, composeCompare } from "@marble/lib/compare";
import { createServerMarbleSdk } from "./marble-sdk-server";

type ServerSdk = Awaited<ReturnType<typeof createServerMarbleSdk>>;
type SidebarSnapshot = Awaited<ReturnType<ServerSdk["sidebar"]["getData"]>>;
type SecretBindingMap = Awaited<
  ReturnType<ServerSdk["secretBindings"]["listColumns"]>
>;

const WORKSPACE_SNAPSHOT_SCHEMA_VERSION = 1;

const byIdx =
  <
    T extends {
      idx: number;
    },
  >() =>
  (left: T, right: T) =>
    left.idx - right.idx;

const buildSdkByProfile = async (profileIds: readonly string[]) => {
  const entries = await Promise.all(
    profileIds.map(
      async (profileId) =>
        [
          profileId,
          await createServerMarbleSdk({
            profileId,
          }),
        ] as const,
    ),
  );

  return new Map(entries);
};

const requireSdk = (
  sdkByProfile: Map<string, ServerSdk>,
  profileId: string,
) => {
  const sdk = sdkByProfile.get(profileId);

  if (!sdk) {
    throw new Error(
      `Cannot export workspace: missing data access for profile ${profileId}.`,
    );
  }

  return sdk;
};

const collectTable = async (
  sdk: ServerSdk,
  table: SidebarSnapshot["tables"][number],
) => {
  const [columns, rows] = await Promise.all([
    sdk.columns.list({
      tableId: table.id,
    }),
    sdk.rows.list({
      tableId: table.id,
    }),
  ]);

  const cellGroups = await Promise.all(
    columns.map((column) =>
      sdk.cells.list({
        columnId: column.id,
      }),
    ),
  );

  return {
    cells: sortBy(
      cellGroups.flat(),
      composeCompare(
        byString((cell) => cell.columnId),
        byString((cell) => cell.rowId),
      ),
    ),
    columns: sortBy(columns, byIdx()),
    id: table.id,
    name: table.name,
    rows: sortBy(rows, byIdx()),
  };
};

const collectProjectSources = async (sdk: ServerSdk, projectId: string) => {
  const sources = await sdk.sources.list({
    projectId,
  });

  return sortBy(
    sources.map((source) => ({
      id: source.id,
      name: source.name,
      payloadSchema: source.payloadSchema,
      projectId: source.projectId,
    })),
    composeCompare(
      byString((source) => source.name),
      byString((source) => source.id),
    ),
  );
};

const collectProjectPipes = async (
  sdk: ServerSdk,
  sourceIds: readonly string[],
) => {
  const pipeGroups = await Promise.all(
    sourceIds.map((sourceId) =>
      sdk.pipes.list({
        sourceId,
      }),
    ),
  );

  return sortBy(
    dedupeById(pipeGroups.flat()),
    byString((pipe) => pipe.id),
  );
};

const collectProgramsForProfiles = async (
  sdkByProfile: Map<string, ServerSdk>,
  ownedProgramIds: ReadonlySet<string>,
) => {
  const editorData = await Promise.all(
    [
      ...sdkByProfile.values(),
    ].map((sdk) => sdk.programs.listForEditor({})),
  );

  const programs = dedupeById(
    editorData.flatMap((data) => data.programs),
  ).filter((program) => ownedProgramIds.has(program.id) && !program.firstParty);

  const ownedIds = new Set(programs.map((program) => program.id));
  const versions = dedupeById(
    editorData.flatMap((data) => data.programVersions),
  ).filter((version) => ownedIds.has(version.programId));
  const versionIds = new Set(versions.map((version) => version.id));
  const files = dedupeById(
    editorData.flatMap((data) => data.programFiles),
  ).filter((file) => versionIds.has(file.versionId));

  return {
    files: sortBy(
      files,
      byString((file) => file.id),
    ),
    programs: sortBy(
      programs,
      byString((program) => program.name),
    ),
    versions: sortBy(
      versions,
      byString((version) => version.id),
    ),
  };
};

const mergeBindingMaps = (maps: readonly SecretBindingMap[]) =>
  maps.reduce<SecretBindingMap>(
    (merged, map) => Object.assign(merged, map),
    {},
  );

const collectSecretBindings = async (input: {
  columnIdsByProfile: Map<string, string[]>;
  programIdsByProfile: Map<string, string[]>;
  sdkByProfile: Map<string, ServerSdk>;
}) => {
  const profileIds = [
    ...input.sdkByProfile.keys(),
  ];

  const [columnMaps, programMaps] = await Promise.all([
    Promise.all(
      profileIds.map((profileId) =>
        requireSdk(input.sdkByProfile, profileId).secretBindings.listColumns({
          columnIds: input.columnIdsByProfile.get(profileId) ?? [],
        }),
      ),
    ),
    Promise.all(
      profileIds.map((profileId) =>
        requireSdk(input.sdkByProfile, profileId).secretBindings.listPrograms({
          programIds: input.programIdsByProfile.get(profileId) ?? [],
        }),
      ),
    ),
  ]);

  return {
    columns: mergeBindingMaps(columnMaps),
    programs: mergeBindingMaps(programMaps),
  };
};

export const buildWorkspaceSnapshot = async () => {
  const bootstrapSdk = await createServerMarbleSdk();
  const sidebar = await bootstrapSdk.sidebar.getData({});
  const sdkByProfile = await buildSdkByProfile(sidebar.ownerProfileIds);

  const tablesByProject = groupBy(sidebar.tables, (table) => table.projectId);

  const columnIdsByProfile = new Map<string, string[]>();

  const projects = await Promise.all(
    sortBy(
      sidebar.projects,
      byString((project) => project.name),
    ).map(async (project) => {
      const sdk = requireSdk(sdkByProfile, project.ownerProfileId);
      const projectTables = tablesByProject.get(project.id) ?? [];

      const [tables, sources] = await Promise.all([
        Promise.all(
          sortBy(
            projectTables,
            byString((table) => table.name),
          ).map((table) => collectTable(sdk, table)),
        ),
        collectProjectSources(sdk, project.id),
      ]);

      const pipes = await collectProjectPipes(
        sdk,
        sources.map((source) => source.id),
      );

      const existingColumnIds =
        columnIdsByProfile.get(project.ownerProfileId) ?? [];
      existingColumnIds.push(
        ...tables.flatMap((table) => table.columns.map((column) => column.id)),
      );
      columnIdsByProfile.set(project.ownerProfileId, existingColumnIds);

      return {
        createdAt: project.createdAt,
        folderPath: project.folderPath,
        id: project.id,
        name: project.name,
        ownerProfileId: project.ownerProfileId,
        pipes,
        sources,
        tables,
        updatedAt: project.updatedAt,
      };
    }),
  );

  const ownedProgramIds = new Set(
    sidebar.programs
      .filter((program) => !program.firstParty)
      .map((program) => program.id),
  );
  const programData = await collectProgramsForProfiles(
    sdkByProfile,
    ownedProgramIds,
  );

  const programIdsByProfile = new Map<string, string[]>();
  for (const program of programData.programs) {
    const existing = programIdsByProfile.get(program.ownerProfileId) ?? [];
    existing.push(program.id);
    programIdsByProfile.set(program.ownerProfileId, existing);
  }

  const [secrets, secretBindings] = await Promise.all([
    bootstrapSdk.secrets.list({}),
    collectSecretBindings({
      columnIdsByProfile,
      programIdsByProfile,
      sdkByProfile,
    }),
  ]);

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      schemaVersion: WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
      userId: sidebar.userId,
    },
    profiles: sidebar.profiles,
    programs: programData,
    projects,
    secretBindings,
    secrets: sortBy(
      secrets.map((secret) => ({
        category: secret.category,
        id: secret.id,
        name: secret.name,
      })),
      byString((secret) => secret.name),
    ),
  };
};
