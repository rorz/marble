import type { MarbleClient } from "@marble/sdk";

export const DEFAULT_AGENT_PROFILE_ICON = "🤖";

export const AGENT_PROVIDER_OPTIONS = [
  "Codex",
  "Claude Code",
  "OpenCode",
  "Cursor",
  "Windsurf",
  "Gemini CLI",
  "GitHub Copilot",
  "Goose",
  "Aider",
  "OpenHands",
  "Devin",
] as const;

export const AGENT_PROFILE_ICON_OPTIONS = [
  "🤖",
  "🧠",
  "🛠️",
  "🔍",
  "✍️",
  "📚",
  "⚙️",
  "🧪",
  "📦",
  "🛰️",
  "📈",
  "🧾",
] as const;

export type ProfileRecord = Awaited<
  ReturnType<MarbleClient["profiles"]["list"]>
>[number];

export type ProfileKeyRecord = Awaited<
  ReturnType<MarbleClient["keys"]["list"]>
>[number];

export type ManagedProfileRecord = ProfileRecord & {
  keys: ProfileKeyRecord[];
};
