import type { ApiModel, CoverageMap, EndpointModel } from "@harp/contracts";
import { browser } from "#imports";
import type { LogEntry } from "../../lib/messaging";
import { renderSchema } from "../../lib/schema-tree";

/**
 * HARP dashboard — the home for your reverse-engineered tool. Reads the model,
 * coverage map, and generated contract from the HARP server, paints the surface
 * mosaic, and lets you click any tile to inspect its request/response schema and
 * copy the generated oRPC contract.
 */

type Settings = {
  projectId: string;
  serverUrl: string;
};
type ProjectSummary = {
  host: string;
  id: string;
  name: string;
};

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`Missing element #${id}`);
  }
  return found as T;
};

const node = (tag: string, className?: string, text?: string) => {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
};

const projectSelect = el<HTMLSelectElement>("project-select");
const statsBox = el<HTMLSpanElement>("stats");
const surfacesBox = el<HTMLElement>("surfaces");
const detailBox = el<HTMLElement>("detail");
const contractBox = el<HTMLPreElement>("contract-source");
const copyButton = el<HTMLButtonElement>("copy");
const downloadButton = el<HTMLButtonElement>("download");
const openSpecButton = el<HTMLButtonElement>("open-spec");
const logBody = el<HTMLElement>("log-body");
const logStatus = el<HTMLSpanElement>("log-status");
const dashboardAnalyzeButton = el<HTMLButtonElement>("dashboard-analyze");
const chatForm = el<HTMLFormElement>("chat-form");
const chatInput = el<HTMLInputElement>("chat-input");
const chatSend = el<HTMLButtonElement>("chat-send");
let suppressLogClear = false;

type ArtifactKind = "auth" | "cli" | "contract" | "openapi" | "sdk";
const artifactTabs: Record<ArtifactKind, HTMLButtonElement> = {
  auth: el<HTMLButtonElement>("tab-auth"),
  cli: el<HTMLButtonElement>("tab-cli"),
  contract: el<HTMLButtonElement>("tab-contract"),
  openapi: el<HTMLButtonElement>("tab-openapi"),
  sdk: el<HTMLButtonElement>("tab-sdk"),
};

const artifactFile: Record<ArtifactKind, string> = {
  auth: "auth.md",
  cli: "cli.ts",
  contract: "contract.ts",
  openapi: "openapi.json",
  sdk: "sdk.ts",
};

const appendLog = (entry: LogEntry) => {
  logBody.append(node("div", `log-line log-${entry.kind}`, entry.text));
  logBody.scrollTop = logBody.scrollHeight;
};

const appendUserMessage = (text: string) => {
  logBody.append(node("div", "log-line log-user", text));
  logBody.scrollTop = logBody.scrollHeight;
};

const setAnalyzing = (on: boolean) => {
  dashboardAnalyzeButton.disabled = on;
  dashboardAnalyzeButton.textContent = on ? "Analyzing…" : "Analyze";
  chatInput.disabled = on;
  chatSend.disabled = on;
  if (on) {
    logStatus.textContent = "running…";
  }
};

let settings: Settings = {
  projectId: "",
  serverUrl: "http://localhost:4277",
};
let endpoints = new Map<string, EndpointModel>();
let artifacts: Record<ArtifactKind, string> = {
  auth: "",
  cli: "",
  contract: "",
  openapi: "",
  sdk: "",
};
let selectedArtifact: ArtifactKind = "contract";
let selectedKey: string | undefined;
let currentHost = "";

const renderArtifact = () => {
  for (const kind of Object.keys(artifactTabs) as ArtifactKind[]) {
    artifactTabs[kind].classList.toggle("active", kind === selectedArtifact);
  }
  contractBox.textContent =
    artifacts[selectedArtifact] || "// No contract yet — ingest a capture.";
};

const base = () => settings.serverUrl.replace(/\/+$/, "");

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${base()}${path}`);
  if (!response.ok) {
    throw new Error(`${path} → ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const loadStoredSettings = async () => {
  const stored = await browser.storage.local.get("settings");
  const saved = (stored.settings as Partial<Settings>) ?? {};
  settings = {
    projectId: saved.projectId ?? "",
    serverUrl: saved.serverUrl ?? "http://localhost:4277",
  };
};

const saveProject = async (projectId: string) => {
  settings = {
    ...settings,
    projectId,
  };
  const stored = await browser.storage.local.get("settings");
  await browser.storage.local.set({
    settings: {
      ...((stored.settings as object) ?? {}),
      projectId,
    },
  });
};

const parseHash = (): string | undefined => {
  const raw = location.hash.slice(1);
  if (!raw) {
    return undefined;
  }
  const [projectId, focus] = raw.split("|");
  if (projectId) {
    settings.projectId = projectId;
  }
  return focus ? decodeURIComponent(focus) : undefined;
};

const renderStats = (coverage: CoverageMap) => {
  const s = coverage.stats;
  statsBox.textContent = `${s.unlocked}/${s.total} unlocked · ${s.discovered} seen · ${s.holes} holes · ${coverage.host || "—"}`;
};

const sectionWith = (label: string, body: HTMLElement) => {
  const section = node("section");
  section.append(node("h3", undefined, label));
  section.append(body);
  return section;
};

const renderDetail = (key?: string) => {
  detailBox.replaceChildren();
  if (!key) {
    detailBox.append(
      node("div", "detail-empty", "Select a tile to inspect it."),
    );
    return;
  }
  const endpoint = endpoints.get(key);
  if (!endpoint) {
    detailBox.append(
      node(
        "div",
        "detail-empty",
        `${key} — a hypothesised hole. HARP hasn't captured this one yet; browse or probe it to fill it in.`,
      ),
    );
    return;
  }

  const title = node("h2");
  title.append(
    node(
      "span",
      `pill method-${endpoint.method.toLowerCase()}`,
      endpoint.method,
    ),
  );
  title.append(node("span", "detail-path", endpoint.pathTemplate));
  detailBox.append(title);
  detailBox.append(
    node(
      "div",
      "badges",
      `${endpoint.sampleCount} sample(s) · statuses ${endpoint.responseStatuses.join(", ") || "—"} · ${endpoint.host}`,
    ),
  );

  if (endpoint.pathParams.length > 0) {
    const params = node("div");
    for (const param of endpoint.pathParams) {
      params.append(renderSchema(param.schema, param.name));
    }
    detailBox.append(sectionWith("Path params", params));
  }
  detailBox.append(
    sectionWith(
      "Query",
      endpoint.query
        ? renderSchema(endpoint.query)
        : node("div", "detail-empty", "none"),
    ),
  );
  detailBox.append(
    sectionWith(
      "Request body",
      endpoint.requestBody
        ? renderSchema(endpoint.requestBody)
        : node("div", "detail-empty", "none"),
    ),
  );
  detailBox.append(
    sectionWith(
      "Response body",
      endpoint.responseBody
        ? renderSchema(endpoint.responseBody)
        : node("div", "detail-empty", "not captured"),
    ),
  );
};

const selectKey = (key: string) => {
  selectedKey = key;
  for (const tile of surfacesBox.querySelectorAll(".tile")) {
    tile.classList.toggle(
      "selected",
      (tile as HTMLElement).dataset.key === key,
    );
  }
  renderDetail(key);
  location.hash = `${settings.projectId}|${encodeURIComponent(key)}`;
};

const renderSurfaces = (coverage: CoverageMap, focusKey?: string) => {
  surfacesBox.replaceChildren();
  if (coverage.surfaces.length === 0) {
    surfacesBox.append(
      node("div", "detail-empty", "No endpoints captured yet."),
    );
    return;
  }
  for (const surface of coverage.surfaces) {
    const wrap = node("div", "surface");
    const head = node("div", "surface-head");
    head.append(node("span", "surface-name", surface.name));
    head.append(
      node(
        "span",
        "surface-meta",
        `${surface.unlockedCount}/${surface.totalCount} unlocked`,
      ),
    );
    wrap.append(head);
    const bar = node("div", "bar");
    const fill = node("span");
    const ratio =
      surface.totalCount === 0
        ? 0
        : Math.round((surface.unlockedCount / surface.totalCount) * 100);
    fill.style.width = `${ratio}%`;
    bar.append(fill);
    wrap.append(bar);
    const tiles = node("div", "tiles");
    for (const tile of surface.tiles) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `tile ${tile.state}${tile.probed ? " probed" : ""}`;
      button.dataset.key = tile.key;
      button.append(node("span", "method", tile.method));
      button.append(node("span", "verb", tile.label));
      button.title = `${tile.method} ${tile.path}${tile.probed ? " · agent-probed" : ""}`;
      button.addEventListener("click", () => selectKey(tile.key));
      tiles.append(button);
    }
    wrap.append(tiles);
    surfacesBox.append(wrap);
  }
  if (focusKey) {
    selectKey(focusKey);
  }
};

const renderProjects = (projects: ProjectSummary[]) => {
  projectSelect.replaceChildren();
  for (const project of projects) {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = project.host
      ? `${project.name} · ${project.host}`
      : project.name;
    projectSelect.append(option);
  }
  projectSelect.value = settings.projectId;
};

const load = async (focusKey?: string) => {
  if (!settings.projectId) {
    surfacesBox.replaceChildren(
      node("div", "detail-empty", "No project selected."),
    );
    return;
  }
  try {
    const [coverage, model, contract] = await Promise.all([
      getJson<CoverageMap>(`/projects/${settings.projectId}/coverage`),
      getJson<ApiModel>(`/projects/${settings.projectId}/model`),
      getJson<Record<ArtifactKind, string>>(
        `/projects/${settings.projectId}/contract`,
      ).catch(() => ({
        auth: "",
        cli: "",
        contract: "",
        openapi: "",
        sdk: "",
      })),
    ]);
    endpoints = new Map(
      model.resources
        .flatMap((resource) => resource.endpoints)
        .map((endpoint) => [
          `${endpoint.method} ${endpoint.pathTemplate}`,
          endpoint,
        ]),
    );
    artifacts = contract;
    currentHost = coverage.host;
    renderArtifact();
    renderStats(coverage);
    renderSurfaces(coverage, focusKey);
    if (!selectedKey) {
      renderDetail(undefined);
    }
  } catch (error) {
    surfacesBox.replaceChildren(
      node(
        "div",
        "detail-empty",
        `Can't load this project. ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
};

const init = async () => {
  await loadStoredSettings();
  const focusKey = parseHash();
  try {
    const state = (await browser.runtime.sendMessage({
      type: "GET_STATE",
    })) as {
      data?: {
        analyzing?: boolean;
      };
    };
    if (state?.data?.analyzing) {
      setAnalyzing(true);
    }
  } catch (error) {
    console.warn("[harp] could not read background state", error);
  }
  try {
    renderProjects(await getJson<ProjectSummary[]>("/projects"));
  } catch (error) {
    console.warn("[harp] could not list projects", error);
  }
  await load(focusKey);
};

projectSelect.addEventListener("change", () => {
  selectedKey = undefined;
  void saveProject(projectSelect.value).then(() => load());
});

for (const kind of Object.keys(artifactTabs) as ArtifactKind[]) {
  artifactTabs[kind].addEventListener("click", () => {
    selectedArtifact = kind;
    renderArtifact();
  });
}

copyButton.addEventListener("click", () => {
  void navigator.clipboard.writeText(artifacts[selectedArtifact]).then(() => {
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1200);
  });
});

downloadButton.addEventListener("click", () => {
  const blob = new Blob(
    [
      artifacts[selectedArtifact],
    ],
    {
      type:
        selectedArtifact === "openapi"
          ? "application/json"
          : selectedArtifact === "auth"
            ? "text/markdown"
            : "text/typescript",
    },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = artifactFile[selectedArtifact];
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
});

openSpecButton.addEventListener("click", () => {
  if (!settings.projectId) {
    return;
  }
  window.open(`${base()}/projects/${settings.projectId}/docs`, "_blank");
});

const applyProgress = (coverage: CoverageMap) => {
  renderStats(coverage);
  renderSurfaces(coverage);
  for (const tile of surfacesBox.querySelectorAll(".tile")) {
    tile.classList.toggle(
      "selected",
      (tile as HTMLElement).dataset.key === selectedKey,
    );
  }
};

browser.runtime.onMessage.addListener((message) => {
  const event = message as {
    coverage?: CoverageMap;
    entry?: LogEntry;
    message?: string;
    type?: string;
  };
  if (event.type === "EXPLORE_START") {
    if (!suppressLogClear) {
      logBody.replaceChildren();
    }
    suppressLogClear = false;
    setAnalyzing(true);
  } else if (event.type === "EXPLORE_LOG" && event.entry) {
    appendLog(event.entry);
  } else if (event.type === "EXPLORE_PROGRESS" && event.coverage) {
    applyProgress(event.coverage);
  } else if (event.type === "EXPLORE_DONE") {
    setAnalyzing(false);
    logStatus.textContent = "done";
    void load();
  } else if (event.type === "EXPLORE_ERROR") {
    setAnalyzing(false);
    logStatus.textContent = `error: ${event.message ?? "failed"}`;
  }
  return undefined;
});

dashboardAnalyzeButton.addEventListener("click", () => {
  if (dashboardAnalyzeButton.disabled || !settings.projectId) {
    return;
  }
  setAnalyzing(true);
  void (async () => {
    const response = (await browser.runtime.sendMessage({
      host: currentHost,
      projectId: settings.projectId,
      type: "EXPLORE",
    })) as {
      error?: string;
      ok?: boolean;
    };
    if (response && response.ok === false) {
      setAnalyzing(false);
      logStatus.textContent = `error: ${response.error ?? "failed"}`;
    }
  })();
});

chatForm.addEventListener("submit", (submitEvent) => {
  submitEvent.preventDefault();
  const text = chatInput.value.trim();
  if (!text || chatSend.disabled || !settings.projectId) {
    return;
  }
  appendUserMessage(text);
  chatInput.value = "";
  suppressLogClear = true;
  setAnalyzing(true);
  void (async () => {
    const response = (await browser.runtime.sendMessage({
      host: currentHost,
      message: text,
      projectId: settings.projectId,
      type: "EXPLORE",
    })) as {
      error?: string;
      ok?: boolean;
    };
    if (response && response.ok === false) {
      setAnalyzing(false);
      logStatus.textContent = `error: ${response.error ?? "failed"}`;
    }
  })();
});

void init();
