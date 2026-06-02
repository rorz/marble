import type { CoverageDelta, CoverageMap } from "@harp/contracts";

/**
 * HARP popup. Talks to the background worker for capture control and directly
 * to the HARP server for project + coverage reads, then paints the swiss-cheese
 * map: a tile grid per surface where holes fill in as you browse more.
 */

type Settings = {
  autoDownload: boolean;
  autoIngest: boolean;
  projectId: string;
  serverUrl: string;
};

type CaptureState = {
  entryCount: number;
  recording: boolean;
  tabId: number | null;
};

type StopResult = {
  downloaded: boolean;
  entryCount: number;
  error?: string;
  ingest?: {
    delta: CoverageDelta;
  };
};

type Project = {
  host: string;
  id: string;
  name: string;
};

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Missing element #${id}`);
  }
  return node as T;
};

const serverInput = el<HTMLInputElement>("server-url");
const projectSelect = el<HTMLSelectElement>("project-select");
const refreshButton = el<HTMLButtonElement>("refresh");
const newProjectInput = el<HTMLInputElement>("new-project-name");
const createButton = el<HTMLButtonElement>("create-project");
const autoDownloadInput = el<HTMLInputElement>("auto-download");
const autoIngestInput = el<HTMLInputElement>("auto-ingest");
const recordButton = el<HTMLButtonElement>("record");
const dashboardButton = el<HTMLButtonElement>("open-dashboard");
const statusBox = el<HTMLDivElement>("status");
const coverageBox = el<HTMLDivElement>("coverage");
const recordDot = el<HTMLSpanElement>("rec-dot");

let settings: Settings = {
  autoDownload: true,
  autoIngest: true,
  projectId: "",
  serverUrl: "http://localhost:4277",
};
let recording = false;
let freshKeys = new Set<string>();

const sendMessage = async <T>(message: object): Promise<T> => {
  const response = (await chrome.runtime.sendMessage(message)) as {
    data?: T;
    error?: string;
    ok: boolean;
  };
  if (!response.ok) {
    throw new Error(response.error ?? "Background worker error");
  }
  return response.data as T;
};

const apiBase = () => settings.serverUrl.replace(/\/+$/, "");

const apiGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${apiBase()}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} → ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const apiPost = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${apiBase()}${path}`, {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`POST ${path} → ${response.status}`);
  }
  return response.json() as Promise<T>;
};

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const setStatus = (text: string, good = false) => {
  statusBox.textContent = text;
  statusBox.className = good ? "status good" : "status";
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

const pct = (part: number, total: number) =>
  total === 0 ? 0 : Math.round((part / total) * 100);

const openDashboard = (key?: string) => {
  const focus = key ? `|${encodeURIComponent(key)}` : "";
  void chrome.tabs.create({
    url: chrome.runtime.getURL(`dashboard.html#${settings.projectId}${focus}`),
  });
};

const renderEmpty = (text: string) => {
  coverageBox.replaceChildren(node("div", "empty", text));
};

const renderCoverage = (coverage: CoverageMap) => {
  if (coverage.surfaces.length === 0) {
    renderEmpty("No endpoints discovered yet — hit Record and browse.");
    return;
  }
  const fragment = document.createDocumentFragment();
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
    fill.style.width = `${pct(surface.unlockedCount, surface.totalCount)}%`;
    bar.append(fill);
    wrap.append(bar);
    const tiles = node("div", "tiles");
    for (const tile of surface.tiles) {
      const fresh = freshKeys.has(tile.key) ? " fresh" : "";
      const square = document.createElement("button");
      square.type = "button";
      square.className = `tile ${tile.state}${fresh}`;
      square.append(node("span", "method", tile.method));
      square.append(node("span", "verb", tile.label));
      square.title = `${tile.method} ${tile.path} · ${tile.state} · ${tile.sampleCount} sample(s)`;
      square.addEventListener("click", () => openDashboard(tile.key));
      tiles.append(square);
    }
    wrap.append(tiles);
    fragment.append(wrap);
  }
  coverageBox.replaceChildren(fragment);
};

const renderProjects = (projects: Project[]) => {
  projectSelect.replaceChildren();
  if (projects.length === 0) {
    const option = document.createElement("option");
    option.textContent = "No projects yet";
    option.value = "";
    projectSelect.append(option);
    return;
  }
  for (const project of projects) {
    const option = document.createElement("option");
    option.textContent = project.host
      ? `${project.name} · ${project.host}`
      : project.name;
    option.value = project.id;
    projectSelect.append(option);
  }
  projectSelect.value = settings.projectId;
};

const loadCoverage = async () => {
  if (!settings.projectId) {
    renderEmpty("Pick or create a project to see its map.");
    return;
  }
  try {
    renderCoverage(
      await apiGet<CoverageMap>(`/projects/${settings.projectId}/coverage`),
    );
  } catch {
    renderEmpty("No captures yet for this project — hit Record.");
  }
};

const loadProjects = async () => {
  try {
    const projects = await apiGet<Project[]>("/projects");
    renderProjects(projects);
    await loadCoverage();
  } catch (error) {
    renderEmpty(`Can't reach HARP server. ${messageOf(error)}`);
  }
};

const updateRecordUi = () => {
  recordButton.textContent = recording ? "Stop" : "Record";
  recordButton.className = recording ? "record recording" : "record";
  recordDot.className = recording ? "on" : "";
};

const saveSettingsPatch = async (patch: Partial<Settings>) => {
  settings = {
    ...settings,
    ...patch,
  };
  await sendMessage({
    settings: patch,
    type: "SAVE_SETTINGS",
  });
};

const handleStopResult = async (result: StopResult) => {
  if (result.ingest) {
    const delta = result.ingest.delta;
    freshKeys = new Set(delta.newlyUnlocked);
    setStatus(
      `🔓 ${delta.newlyUnlocked.length} unlocked · ${result.entryCount} calls · ${pct(delta.unlocked, delta.total)}% covered`,
      true,
    );
    await loadCoverage();
    return;
  }
  const tail = result.error
    ? ` · ingest error: ${result.error}`
    : result.downloaded
      ? " · .har downloaded"
      : "";
  setStatus(`Captured ${result.entryCount} calls${tail}`);
};

const toggleRecord = async () => {
  try {
    if (!recording) {
      await sendMessage({
        type: "START",
      });
      recording = true;
      freshKeys = new Set();
      updateRecordUi();
      setStatus("Recording — click around the site, then press Stop.");
      return;
    }
    setStatus("Building HAR and ingesting…");
    const { result } = await sendMessage<{
      result: StopResult;
    }>({
      type: "STOP",
    });
    recording = false;
    updateRecordUi();
    await handleStopResult(result);
  } catch (error) {
    recording = false;
    updateRecordUi();
    setStatus(messageOf(error));
  }
};

const createProject = async () => {
  const name = newProjectInput.value.trim();
  if (!name) {
    return;
  }
  try {
    const project = await apiPost<Project>("/projects", {
      name,
    });
    newProjectInput.value = "";
    await saveSettingsPatch({
      projectId: project.id,
    });
    await loadProjects();
  } catch (error) {
    setStatus(messageOf(error));
  }
};

const wireEvents = () => {
  serverInput.addEventListener("change", () => {
    void saveSettingsPatch({
      serverUrl: serverInput.value,
    }).then(loadProjects);
  });
  projectSelect.addEventListener("change", () => {
    void saveSettingsPatch({
      projectId: projectSelect.value,
    }).then(loadCoverage);
  });
  refreshButton.addEventListener("click", () => void loadProjects());
  createButton.addEventListener("click", () => void createProject());
  autoDownloadInput.addEventListener("change", () => {
    void saveSettingsPatch({
      autoDownload: autoDownloadInput.checked,
    });
  });
  autoIngestInput.addEventListener("change", () => {
    void saveSettingsPatch({
      autoIngest: autoIngestInput.checked,
    });
  });
  recordButton.addEventListener("click", () => void toggleRecord());
  dashboardButton.addEventListener("click", () => openDashboard());
};

const init = async () => {
  try {
    const data = await sendMessage<{
      settings: Settings;
      state: CaptureState;
    }>({
      type: "GET_STATE",
    });
    settings = data.settings;
    recording = data.state.recording;
    serverInput.value = settings.serverUrl;
    autoDownloadInput.checked = settings.autoDownload;
    autoIngestInput.checked = settings.autoIngest;
    updateRecordUi();
    await loadProjects();
  } catch (error) {
    setStatus(messageOf(error));
  }
};

wireEvents();
void init();
