import {
  type ApiResourceName,
  apiResourceItemPath,
  apiResourceLabel,
  apiResourcePath,
  supportsResourceOperation,
} from "@marble/core";
import { env } from "./env.js";

type EntityWithId = {
  id: string;
} & Record<string, unknown>;

type ProgramFilePayload = {
  content: string;
  filename: string;
  filetype: "Json" | "Markdown" | "TypeScript";
  ownerProfileId?: string;
};

type ProgramUpsertPayload = {
  files: ProgramFilePayload[];
  inputSchema: unknown;
  name: string;
  outputConfig: unknown;
  ownerProfileId?: string;
  programId?: string;
  secretConfig?: unknown;
};

type ProgramUpsertResult = {
  programId: string;
  versionId: string;
};
type SecretBindingEntry = {
  envName: string;
  secretId: string;
};
type RunExecutionResult = {
  cellId?: string;
  error?: boolean;
  message?: string;
  output: unknown;
  runId: string;
  success: boolean;
};
type BatchRunExecutionResult = {
  results: RunExecutionResult[];
  success: boolean;
};

type QueryValue = boolean | number | string | null | undefined;
type ApiErrorPayload = {
  detail?: unknown;
  details?: unknown;
  error?: boolean | string;
  message?: string;
  requestId?: string;
};
type FetchApiOptions = {
  allowErrorStatus?: boolean;
};

function formatStructuredErrorDetails(details: unknown) {
  if (details === undefined) {
    return "";
  }

  if (typeof details === "string") {
    return `\nDetails: ${details}`;
  }

  return `\nDetails: ${JSON.stringify(details, null, 2)}`;
}

function formatApiError(text: string) {
  try {
    const payload = JSON.parse(text) as ApiErrorPayload;
    const message =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : text;
    const details = payload.details ?? payload.detail;
    const requestId =
      typeof payload.requestId === "string"
        ? `\nRequest ID: ${payload.requestId}`
        : "";

    return `${message}${formatStructuredErrorDetails(details)}${requestId}`;
  } catch {
    return text;
  }
}

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

  private assertSupported(resource: ApiResourceName, operation: string) {
    if (!supportsResourceOperation(resource, operation as never)) {
      throw new Error(
        `${apiResourceLabel(resource)} do not support '${operation}' operations`,
      );
    }
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
    fetchApiOptions: FetchApiOptions = {},
  ): Promise<T> {
    const url = `${this.apiUrl}${this.buildEndpoint(endpoint, query)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-marble-actor-source": "CLI",
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

    let payload: unknown = null;

    if (text) {
      payload = JSON.parse(text) as unknown;
    }

    if (!res.ok && fetchApiOptions.allowErrorStatus) {
      const hasStructuredSuccessFlag =
        payload !== null &&
        typeof payload === "object" &&
        "success" in payload &&
        typeof (
          payload as {
            success?: unknown;
          }
        ).success === "boolean";

      if (hasStructuredSuccessFlag) {
        return payload as T;
      }
    }

    if (!res.ok) {
      throw new Error(`API Error (${res.status}): ${formatApiError(text)}`);
    }

    if (!text) {
      return null as T;
    }

    return payload as T;
  }

  public list(resource: ApiResourceName, query?: Record<string, QueryValue>) {
    this.assertSupported(resource, "list");
    return this.fetchAPI(apiResourcePath(resource), {}, query);
  }

  public get(resource: ApiResourceName, id: string) {
    this.assertSupported(resource, "get");
    return this.fetchAPI(apiResourceItemPath(resource, id));
  }

  public create(resource: ApiResourceName, payload: Record<string, unknown>) {
    this.assertSupported(resource, "create");
    return this.fetchAPI<EntityWithId>(apiResourcePath(resource), {
      body: JSON.stringify(payload),
      method: "POST",
    });
  }

  public update(
    resource: ApiResourceName,
    id: string,
    payload: Record<string, unknown>,
  ) {
    this.assertSupported(resource, "update");
    return this.fetchAPI(apiResourceItemPath(resource, id), {
      body: JSON.stringify(payload),
      method: "PATCH",
    });
  }

  public delete(resource: ApiResourceName, id: string) {
    this.assertSupported(resource, "delete");
    return this.fetchAPI(apiResourceItemPath(resource, id), {
      method: "DELETE",
    });
  }

  public startCellRun(
    cellId: string,
    payload: {
      manualInput?: string | null;
    } = {},
  ) {
    return this.fetchAPI<RunExecutionResult>(
      `/cells/${cellId}/run`,
      {
        body: JSON.stringify(payload),
        method: "POST",
      },
      undefined,
      {
        allowErrorStatus: true,
      },
    );
  }

  public startCellRuns(
    cellIds: string[],
    payload: {
      manualInput?: string | null;
    } = {},
  ) {
    return this.fetchAPI<BatchRunExecutionResult>(
      "/cells/run",
      {
        body: JSON.stringify({
          ...payload,
          cellIds,
        }),
        method: "POST",
      },
      undefined,
      {
        allowErrorStatus: true,
      },
    );
  }

  public executeProgramRun(runId: string) {
    return this.fetchAPI<RunExecutionResult>(
      `/program-runs/${runId}/execute`,
      {
        body: JSON.stringify({}),
        method: "POST",
      },
      undefined,
      {
        allowErrorStatus: true,
      },
    );
  }

  public listProgramSecretBindings(programId: string) {
    return this.fetchAPI<SecretBindingEntry[]>(
      `/programs/${programId}/secrets`,
    );
  }

  public updateProgramSecretBindings(
    programId: string,
    bindings: SecretBindingEntry[],
  ) {
    return this.fetchAPI<SecretBindingEntry[]>(
      `/programs/${programId}/secrets`,
      {
        body: JSON.stringify({
          bindings,
        }),
        method: "PUT",
      },
    );
  }

  public listColumnSecretBindings(columnId: string) {
    return this.fetchAPI<SecretBindingEntry[]>(`/columns/${columnId}/secrets`);
  }

  public updateColumnSecretBindings(
    columnId: string,
    bindings: SecretBindingEntry[],
  ) {
    return this.fetchAPI<SecretBindingEntry[]>(`/columns/${columnId}/secrets`, {
      body: JSON.stringify({
        bindings,
      }),
      method: "PUT",
    });
  }

  public async upsertProgram(
    payload: ProgramUpsertPayload,
  ): Promise<ProgramUpsertResult> {
    if (payload.programId) {
      await this.get("programs", payload.programId);

      const version = (await this.create("program_versions", {
        files: payload.files,
        inputSchema: payload.inputSchema,
        outputConfig: payload.outputConfig,
        ownerProfileId: payload.ownerProfileId,
        programId: payload.programId,
        secretConfig: payload.secretConfig,
      })) as EntityWithId;

      return {
        programId: payload.programId,
        versionId: version.id,
      };
    }

    const programs = (await this.list("programs")) as Array<{
      id: string;
      name: string;
    }>;
    const matchingPrograms = programs.filter(
      (program) => program.name === payload.name,
    );

    if (matchingPrograms.length > 1) {
      throw new Error(
        `Multiple programs named "${payload.name}" already exist: ${matchingPrograms
          .map((program) => program.id)
          .join(", ")}. Re-run with an explicit program ID.`,
      );
    }

    const existing = matchingPrograms[0];

    if (existing) {
      const version = (await this.create("program_versions", {
        files: payload.files,
        inputSchema: payload.inputSchema,
        outputConfig: payload.outputConfig,
        ownerProfileId: payload.ownerProfileId,
        programId: existing.id,
        secretConfig: payload.secretConfig,
      })) as EntityWithId;

      return {
        programId: existing.id,
        versionId: version.id,
      };
    }

    const program = (await this.create("programs", {
      files: payload.files,
      inputSchema: payload.inputSchema,
      name: payload.name,
      outputConfig: payload.outputConfig,
      ownerProfileId: payload.ownerProfileId,
      secretConfig: payload.secretConfig,
    })) as EntityWithId & {
      initialVersion?: {
        id: string;
      };
    };

    if (!program.initialVersion?.id) {
      throw new Error("Program creation did not return an initial version ID.");
    }

    return {
      programId: program.id,
      versionId: program.initialVersion.id,
    };
  }

  public testProgramVersion(
    programVersionId: string,
    payload: {
      input: unknown;
    },
  ) {
    return this.fetchAPI(
      "/test",
      {
        body: JSON.stringify(payload),
        method: "POST",
      },
      {
        programVersionId,
      },
      {
        allowErrorStatus: true,
      },
    );
  }
}
