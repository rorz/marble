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
const logBody = el<HTMLElement>("log-body");
const logStatus = el<HTMLSpanElement>("log-status");

const appendLog = (entry: LogEntry) => {
  logBody.append(node("div", `log-line log-${entry.kind}`, entry.text));
  logBody.scrollTop = logBody.scrollHeight;
};

let settings: Settings = {
  projectId: "",
  serverUrl: "http://localhost:4277",
};
let endpoints = new Map<string, EndpointModel>();
let contractSource = "";
let selectedKey: string | undefined;

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
      getJson<{
        source: string;
      }>(`/projects/${settings.projectId}/contract`).catch(() => ({
        source: "",
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
    contractSource = contract.source;
    contractBox.textContent =
      contractSource || "// No contract yet — ingest a capture first.";
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

copyButton.addEventListener("click", () => {
  void navigator.clipboard.writeText(contractSource).then(() => {
    copyButton.textContent = "Copied!";
    setTimeout(() => {
      copyButton.textContent = "Copy";
    }, 1200);
  });
});

browser.runtime.onMessage.addListener((message) => {
  const event = message as {
    entry?: LogEntry;
    message?: string;
    type?: string;
  };
  if (event.type === "EXPLORE_START") {
    logBody.replaceChildren();
    logStatus.textContent = "running…";
  } else if (event.type === "EXPLORE_LOG" && event.entry) {
    appendLog(event.entry);
  } else if (event.type === "EXPLORE_DONE") {
    logStatus.textContent = "done";
    void load();
  } else if (event.type === "EXPLORE_ERROR") {
    logStatus.textContent = `error: ${event.message ?? "failed"}`;
  }
  return undefined;
});

void init();
