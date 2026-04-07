export class MarbleClient {
  private apiUrl: string;
  private apiKey?: string;

  constructor(opts?: {
    apiUrl?: string;
    apiKey?: string;
  }) {
    this.apiUrl =
      opts?.apiUrl ||
      process.env.MARBLE_API_URL ||
      "https://marble.kenobi.tech/api";
    this.apiKey = opts?.apiKey || process.env.MARBLE_API_KEY;
  }

  private async fetchAPI(endpoint: string, options: RequestInit = {}) {
    const url = `${this.apiUrl}${endpoint}`;
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
    if (!res.ok) {
      let errorDetail = "";
      try {
        const errJson = await res.json();
        errorDetail = errJson.error || JSON.stringify(errJson);
      } catch {
        errorDetail = await res.text();
      }
      throw new Error(`API Error (${res.status}): ${errorDetail}`);
    }

    return res.json();
  }

  public tables = {
    list: () => this.fetchAPI("/tables"),
    get: (id: string) => this.fetchAPI(`/tables/${id}`),
    create: (name: string) =>
      this.fetchAPI("/tables", {
        method: "POST",
        body: JSON.stringify({
          name,
        }),
      }),
    delete: (id: string) =>
      this.fetchAPI(`/tables/${id}`, {
        method: "DELETE",
      }),
  };

  public programs = {
    list: () => this.fetchAPI("/programs"),
    get: (id: string) => this.fetchAPI(`/programs/${id}`),
    upsert: (payload: {
      name: string;
      code: string;
      inputSchema: unknown;
      outputConfig: unknown;
    }) =>
      this.fetchAPI("/programs", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    dryRun: (payload: {
      code: string;
      input: unknown;
      outputSchema: unknown;
    }) =>
      this.fetchAPI("/programs/dry-run", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  };

  public columns = {
    list: (tableId: string) => this.fetchAPI(`/tables/${tableId}/columns`),
    add: (
      tableId: string,
      payload: {
        name: string;
        programId: string;
        inputTemplate: string;
        outputSchema: unknown;
      },
    ) =>
      this.fetchAPI(`/tables/${tableId}/columns`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  };

  public rows = {
    list: (tableId: string) => this.fetchAPI(`/tables/${tableId}/rows`),
    add: (tableId: string) =>
      this.fetchAPI(`/tables/${tableId}/rows`, {
        method: "POST",
      }),
  };

  public cells = {
    get: (cellId: string) => this.fetchAPI(`/cells/${cellId}`),
  };
}
