import { env } from "./env.js";

type QueryValue = boolean | number | string | null | undefined;

type ProgramFilePayload = {
  content: string;
  filename: string;
  filetype: "Json" | "Markdown" | "TypeScript";
  ownerProfileId?: string;
};

type ProgramCreatePayload = {
  code?: string;
  codeFilename?: string;
  files?: ProgramFilePayload[];
  firstParty?: boolean;
  forkedFromVersionId?: string | null;
  inputSchema?: unknown;
  name: string;
  outputConfig?: unknown;
  ownerProfileId?: string;
};

type ProgramVersionCreatePayload = {
  files?: ProgramFilePayload[];
  inputSchema: unknown;
  outputConfig: unknown;
  ownerProfileId?: string;
  version?: number;
};

type EntityWithId = {
  id: string;
} & Record<string, unknown>;

export class MarbleClient {
  private apiUrl: string;
  private apiKey?: string;

  constructor(opts?: {
    apiKey?: string;
    apiUrl?: string;
  }) {
    this.apiUrl =
      opts?.apiUrl || env.MARBLE_API_URL || "https://marble.kenobi.tech/api";
    this.apiKey = opts?.apiKey || env.MARBLE_API_KEY;
  }

  private buildEndpoint(endpoint: string, query?: Record<string, QueryValue>) {
    if (!query) {
      return endpoint;
    }

    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) {
        continue;
      }

      params.set(key, String(value));
    }

    const queryString = params.toString();
    if (!queryString) {
      return endpoint;
    }

    return `${endpoint}?${queryString}`;
  }

  private async fetchAPI<T = unknown>(
    endpoint: string,
    options: RequestInit = {},
    query?: Record<string, QueryValue>,
  ): Promise<T> {
    const url = `${this.apiUrl}${this.buildEndpoint(endpoint, query)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const text = await res.text();

    if (!res.ok) {
      let errorDetail = text;
      try {
        const errJson = JSON.parse(text) as {
          error?: string;
        };
        errorDetail = errJson.error || text;
      } catch {
        // Ignored. We fall back to the raw text body.
      }

      throw new Error(`API Error (${res.status}): ${errorDetail}`);
    }

    if (!text) {
      return null as T;
    }

    return JSON.parse(text) as T;
  }

  public profiles = {
    get: (id: string) => this.fetchAPI(`/profiles/${id}`),
    list: (filters?: { ownerUserId?: string; type?: "Agent" | "Human" }) =>
      this.fetchAPI("/profiles", {}, filters),
    update: (
      id: string,
      payload: {
        externalName?: string | null;
        name?: string;
        type?: "Agent" | "Human";
      },
    ) =>
      this.fetchAPI(`/profiles/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
  };

  public tables = {
    create: (name: string, ownerProfileId?: string) =>
      this.fetchAPI<EntityWithId>("/tables", {
        body: JSON.stringify({
          name,
          ownerProfileId,
        }),
        method: "POST",
      }),
    delete: (id: string) =>
      this.fetchAPI(`/tables/${id}`, {
        method: "DELETE",
      }),
    get: (id: string) => this.fetchAPI(`/tables/${id}`),
    list: (filters?: { ownerProfileId?: string }) =>
      this.fetchAPI("/tables", {}, filters),
    update: (
      id: string,
      payload: {
        name?: string;
        ownerProfileId?: string;
      },
    ) =>
      this.fetchAPI(`/tables/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
  };

  public programs = {
    create: (payload: ProgramCreatePayload) =>
      this.fetchAPI<EntityWithId>("/programs", {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    delete: (id: string) =>
      this.fetchAPI(`/programs/${id}`, {
        method: "DELETE",
      }),
    dryRun: (payload: {
      code: string;
      input: unknown;
      outputSchema: unknown;
    }) =>
      this.fetchAPI("/programs/dry-run", {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    get: (id: string) => this.fetchAPI(`/programs/${id}`),
    list: (filters?: { ownerProfileId?: string }) =>
      this.fetchAPI("/programs", {}, filters),
    update: (
      id: string,
      payload: {
        firstParty?: boolean;
        forkedFromVersionId?: string | null;
        name?: string;
        ownerProfileId?: string;
      },
    ) =>
      this.fetchAPI(`/programs/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
    upsert: async (payload: {
      code: string;
      inputSchema: unknown;
      name: string;
      outputConfig: unknown;
      ownerProfileId?: string;
    }) => {
      const programs = (await this.programs.list()) as Array<{
        id: string;
        name: string;
      }>;

      const existing = programs.find(
        (program) => program.name === payload.name,
      );
      const versionPayload: ProgramVersionCreatePayload = {
        files: [
          {
            content: payload.code,
            filename: "index.js",
            filetype: "TypeScript",
          },
        ],
        inputSchema: payload.inputSchema,
        outputConfig: payload.outputConfig,
        ownerProfileId: payload.ownerProfileId,
      };

      if (existing) {
        return this.programVersions.create(existing.id, versionPayload);
      }

      return this.programs.create({
        ...payload,
        files: versionPayload.files,
      });
    },
  };

  public programVersions = {
    create: (programId: string, payload: ProgramVersionCreatePayload) =>
      this.fetchAPI<EntityWithId>(`/programs/${programId}/versions`, {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    delete: (id: string) =>
      this.fetchAPI(`/program-versions/${id}`, {
        method: "DELETE",
      }),
    get: (id: string) => this.fetchAPI(`/program-versions/${id}`),
    list: (filters?: { programId?: string }) =>
      this.fetchAPI("/program-versions", {}, filters),
    update: (
      id: string,
      payload: {
        inputSchema?: unknown;
        outputConfig?: unknown;
        version?: number;
      },
    ) =>
      this.fetchAPI(`/program-versions/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
  };

  public programFiles = {
    create: (programVersionId: string, payload: ProgramFilePayload) =>
      this.fetchAPI(`/program-versions/${programVersionId}/files`, {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    delete: (id: string) =>
      this.fetchAPI(`/program-files/${id}`, {
        method: "DELETE",
      }),
    get: (id: string) => this.fetchAPI(`/program-files/${id}`),
    list: (filters?: { ownerProfileId?: string; versionId?: string }) =>
      this.fetchAPI("/program-files", {}, filters),
    update: (id: string, payload: Partial<ProgramFilePayload>) =>
      this.fetchAPI(`/program-files/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
  };

  public columns = {
    add: (
      tableId: string,
      payload: {
        inputTemplate: string;
        name: string;
        outputSchema?: unknown;
        programId?: string;
        programVersionId?: string;
      },
    ) =>
      this.fetchAPI<EntityWithId>(`/tables/${tableId}/columns`, {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    create: (payload: {
      inputTemplate: string;
      name: string;
      outputSchema?: unknown;
      programId?: string;
      programVersionId?: string;
      tableId: string;
    }) =>
      this.fetchAPI<EntityWithId>("/columns", {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    delete: (id: string) =>
      this.fetchAPI(`/columns/${id}`, {
        method: "DELETE",
      }),
    get: (id: string) => this.fetchAPI(`/columns/${id}`),
    list: (tableId: string) => this.fetchAPI(`/tables/${tableId}/columns`),
    update: (
      id: string,
      payload: {
        idx?: number;
        inputTemplate?: string;
        name?: string;
        outputSchema?: unknown;
        programId?: string;
        programVersionId?: string;
      },
    ) =>
      this.fetchAPI(`/columns/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
  };

  public columnDependencies = {
    get: (id: string) => this.fetchAPI(`/column-dependencies/${id}`),
    list: (filters?: {
      sourceColumnId?: string;
      tableId?: string;
      targetColumnId?: string;
    }) => this.fetchAPI("/column-dependencies", {}, filters),
  };

  public rows = {
    add: (tableId: string, count?: number) =>
      this.fetchAPI<
        | EntityWithId
        | {
            cells: unknown[];
            rows: EntityWithId[];
          }
      >(`/tables/${tableId}/rows`, {
        body: JSON.stringify(
          count === undefined
            ? {}
            : {
                count,
              },
        ),
        method: "POST",
      }),
    create: (payload: { count?: number; idx?: number; tableId: string }) =>
      this.fetchAPI<
        | EntityWithId
        | {
            cells: unknown[];
            rows: EntityWithId[];
          }
      >("/rows", {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    delete: (id: string) =>
      this.fetchAPI(`/rows/${id}`, {
        method: "DELETE",
      }),
    get: (id: string) => this.fetchAPI(`/rows/${id}`),
    list: (tableId: string) => this.fetchAPI(`/tables/${tableId}/rows`),
    update: (
      id: string,
      payload: {
        idx?: number;
      },
    ) =>
      this.fetchAPI(`/rows/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
  };

  public cells = {
    get: (cellId: string) => this.fetchAPI(`/cells/${cellId}`),
    list: (filters?: { columnId?: string; rowId?: string; tableId?: string }) =>
      this.fetchAPI("/cells", {}, filters),
    update: (
      id: string,
      payload: {
        manualInput?: string | null;
        state?: unknown;
      },
    ) =>
      this.fetchAPI(`/cells/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
  };

  public programRuns = {
    create: (payload: {
      input?: unknown;
      output?: unknown;
      programId?: string;
      programVersionId?: string;
      targetCellId: string;
    }) =>
      this.fetchAPI("/program-runs", {
        body: JSON.stringify(payload),
        method: "POST",
      }),
    delete: (id: string) =>
      this.fetchAPI(`/program-runs/${id}`, {
        method: "DELETE",
      }),
    get: (id: string) => this.fetchAPI(`/program-runs/${id}`),
    list: (filters?: { programVersionId?: string; targetCellId?: string }) =>
      this.fetchAPI("/program-runs", {}, filters),
    update: (
      id: string,
      payload: {
        input?: unknown;
        output?: unknown;
        programId?: string;
        programVersionId?: string;
        targetCellId?: string;
      },
    ) =>
      this.fetchAPI(`/program-runs/${id}`, {
        body: JSON.stringify(payload),
        method: "PATCH",
      }),
  };
}
