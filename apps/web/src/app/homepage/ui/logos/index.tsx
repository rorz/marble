import type { ComponentType } from "react";
import { type BrandGlyphProps, GlyphBase } from "./glyph";
import {
  AnthropicGlyph,
  GoogleGlyph,
  GroqGlyph,
  MistralGlyph,
  OllamaGlyph,
  OpenAIGlyph,
  OpenRouterGlyph,
} from "./providers";
import {
  AiderGlyph,
  ClaudeGlyph,
  CodexGlyph,
  ContinueGlyph,
  CursorGlyph,
  McpGlyph,
  OpenCodeGlyph,
  WindsurfGlyph,
} from "./tools";

/**
 * Stylized geometric brand glyphs for the marketing surface.
 *
 * These are deliberately **not** the official corporate logos — they
 * are abstract geometric marks meant to evoke each brand's identity
 * without copying their trademark. When real brand assets become
 * available (via media kits / licensed SVGs), each glyph can be
 * swapped 1:1 — the surface signature is the same.
 *
 * Each glyph paints with `currentColor` so consumers control the
 * tone via Tailwind `text-*` classes on the wrapper.
 */

function MarbleGlyph(props: BrandGlyphProps) {
  // Orange-cornered marble disc — matches `MarbleBrandMark` in app UI.
  return (
    <GlyphBase {...props}>
      <circle
        cx="12"
        cy="12"
        fill="currentColor"
        r="9"
      />
      <circle
        cx="9.5"
        cy="9.5"
        fill="#fef3c7"
        opacity="0.6"
        r="1.6"
        stroke="none"
      />
    </GlyphBase>
  );
}

export type BrandId =
  | "claude"
  | "codex"
  | "cursor"
  | "continue"
  | "opencode"
  | "aider"
  | "windsurf"
  | "mcp"
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "groq"
  | "ollama"
  | "openrouter"
  | "marble";

type BrandEntry = {
  name: string;
  Glyph: ComponentType<BrandGlyphProps>;
  /** Tailwind text-color class — tints the glyph. */
  tone: string;
};

export const BRAND_REGISTRY: Record<BrandId, BrandEntry> = {
  aider: {
    Glyph: AiderGlyph,
    name: "Aider",
    tone: "text-zinc-100",
  },
  anthropic: {
    Glyph: AnthropicGlyph,
    name: "Anthropic",
    tone: "text-orange-400",
  },
  claude: {
    Glyph: ClaudeGlyph,
    name: "Claude",
    tone: "text-orange-400",
  },
  codex: {
    Glyph: CodexGlyph,
    name: "Codex",
    tone: "text-emerald-300",
  },
  continue: {
    Glyph: ContinueGlyph,
    name: "Continue",
    tone: "text-cyan-300",
  },
  cursor: {
    Glyph: CursorGlyph,
    name: "Cursor",
    tone: "text-zinc-100",
  },
  google: {
    Glyph: GoogleGlyph,
    name: "Google",
    tone: "text-sky-300",
  },
  groq: {
    Glyph: GroqGlyph,
    name: "Groq",
    tone: "text-red-400",
  },
  marble: {
    Glyph: MarbleGlyph,
    name: "Marble",
    tone: "text-orange-500",
  },
  mcp: {
    Glyph: McpGlyph,
    name: "MCP",
    tone: "text-violet-300",
  },
  mistral: {
    Glyph: MistralGlyph,
    name: "Mistral",
    tone: "text-orange-300",
  },
  ollama: {
    Glyph: OllamaGlyph,
    name: "Ollama",
    tone: "text-zinc-100",
  },
  openai: {
    Glyph: OpenAIGlyph,
    name: "OpenAI",
    tone: "text-emerald-300",
  },
  opencode: {
    Glyph: OpenCodeGlyph,
    name: "OpenCode",
    tone: "text-orange-300",
  },
  openrouter: {
    Glyph: OpenRouterGlyph,
    name: "OpenRouter",
    tone: "text-cyan-200",
  },
  windsurf: {
    Glyph: WindsurfGlyph,
    name: "Windsurf",
    tone: "text-cyan-300",
  },
};
