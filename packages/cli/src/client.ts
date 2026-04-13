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

type ProgramUpsertPayload = {
  code: string;
  inputSchema: unknown;
  name: string;
  outputConfig: unknown;
  ownerProfileId?: string;
};

type QueryValue = boolean | number | string | null | undefined;

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
        // Fall back to the raw response body.
      }

      throw new Error(`API Error (${res.status}): ${errorDetail}`);
    }

    if (!text) {
      return null as T;
    }

    return JSON.parse(text) as T;
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

  public async upsertProgram(payload: ProgramUpsertPayload) {
    const programs = (await this.list("programs")) as Array<{
      id: string;
      name: string;
    }>;

    const existing = programs.find((program) => program.name === payload.name);
    const files = [
      {
        content: payload.code,
        filename: "index.js",
        filetype: "TypeScript",
      },
    ];

    if (existing) {
      return this.create("program_versions", {
        files,
        inputSchema: payload.inputSchema,
        outputConfig: payload.outputConfig,
        ownerProfileId: payload.ownerProfileId,
        programId: existing.id,
      });
    }

    return this.create("programs", {
      files,
      inputSchema: payload.inputSchema,
      name: payload.name,
      outputConfig: payload.outputConfig,
      ownerProfileId: payload.ownerProfileId,
    });
  }

  public dryRunProgram(payload: {
    code: string;
    input: unknown;
    outputSchema: unknown;
  }) {
    return this.fetchAPI("/programs/dry-run", {
      body: JSON.stringify(payload),
      method: "POST",
    });
  }
}
