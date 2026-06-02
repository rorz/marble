import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type ApiModel,
  type CoverageDelta,
  type CoverageMap,
  ingestHar,
} from "@harp/core";

/**
 * Filesystem-backed persistence for HARP. Each project owns a directory under
 * the data dir holding its model, coverage map, generated contract source, and
 * capture log. Deliberately self-contained — no database — so the whole `harp/`
 * subtree can be lifted out and run anywhere Bun runs.
 */

export type Project = {
  createdAt: string;
  host: string;
  id: string;
  name: string;
  updatedAt: string;
};

export type CaptureSummary = {
  createdAt: string;
  endpointCount: number;
  id: string;
  projectId: string;
  sampleCount: number;
  updatedAt: string;
};

const now = () => new Date().toISOString();

const randomHex = (length: number) =>
  crypto.randomUUID().replace(/-/g, "").slice(0, length);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";

const isMissing = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (
    error as {
      code?: string;
    }
  ).code === "ENOENT";

const readJsonOrNull = async <T>(file: string): Promise<T | null> => {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw error;
  }
};

const readTextOrNull = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (isMissing(error)) {
      return null;
    }
    throw error;
  }
};

const writeJson = async (file: string, value: unknown) => {
  await mkdir(dirname(file), {
    recursive: true,
  });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const countEndpoints = (model: ApiModel) =>
  model.resources.reduce(
    (total, resource) => total + resource.endpoints.length,
    0,
  );

const readDirEntries = async (dir: string) => {
  try {
    return await readdir(dir, {
      withFileTypes: true,
    });
  } catch (error) {
    if (isMissing(error)) {
      return [];
    }
    throw error;
  }
};

export const createFileStore = (dataDir: string) => {
  const projectDir = (id: string) => join(dataDir, id);
  const paths = (id: string) => ({
    captures: join(projectDir(id), "captures.json"),
    contract: join(projectDir(id), "contract.ts"),
    coverage: join(projectDir(id), "coverage.json"),
    model: join(projectDir(id), "model.json"),
    project: join(projectDir(id), "project.json"),
  });

  const getProject = (id: string) => readJsonOrNull<Project>(paths(id).project);

  const listProjects = async (): Promise<Project[]> => {
    const entries = await readDirEntries(dataDir);
    const projects: Project[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const project = await getProject(entry.name);
      if (project) {
        projects.push(project);
      }
    }
    return projects.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  };

  const createProject = async (input: {
    host?: string;
    name: string;
  }): Promise<Project> => {
    const id = `${slugify(input.name)}-${randomHex(4)}`;
    const timestamp = now();
    const project: Project = {
      createdAt: timestamp,
      host: input.host ?? "",
      id,
      name: input.name,
      updatedAt: timestamp,
    };
    await writeJson(paths(id).project, project);
    await writeJson(paths(id).captures, []);
    return project;
  };

  const listCaptures = async (id: string): Promise<CaptureSummary[]> =>
    (await readJsonOrNull<CaptureSummary[]>(paths(id).captures)) ?? [];

  const ingest = async (
    project: Project,
    har: unknown,
  ): Promise<{
    capture: CaptureSummary;
    delta: CoverageDelta;
  }> => {
    const file = paths(project.id);
    const previousModel = await readJsonOrNull<ApiModel>(file.model);
    const previousCoverage = await readJsonOrNull<CoverageMap>(file.coverage);
    const result = ingestHar({
      har,
      previousCoverage,
      previousModel,
    });

    await writeJson(file.model, result.model);
    await writeJson(file.coverage, result.coverage);
    await mkdir(projectDir(project.id), {
      recursive: true,
    });
    await writeFile(file.contract, result.contractSource, "utf8");

    if (project.host === "" && result.model.host !== "") {
      await writeJson(file.project, {
        ...project,
        host: result.model.host,
        updatedAt: now(),
      });
    }

    const timestamp = now();
    const capture: CaptureSummary = {
      createdAt: timestamp,
      endpointCount: countEndpoints(result.model),
      id: randomHex(8),
      projectId: project.id,
      sampleCount: result.sampleCount,
      updatedAt: timestamp,
    };
    const captures = await listCaptures(project.id);
    await writeJson(file.captures, [
      capture,
      ...captures,
    ]);
    return {
      capture,
      delta: result.delta,
    };
  };

  return {
    createProject,
    getContractSource: (id: string) => readTextOrNull(paths(id).contract),
    getCoverage: (id: string) =>
      readJsonOrNull<CoverageMap>(paths(id).coverage),
    getModel: (id: string) => readJsonOrNull<ApiModel>(paths(id).model),
    getProject,
    ingest,
    listCaptures,
    listProjects,
  };
};

export type FileStore = ReturnType<typeof createFileStore>;
