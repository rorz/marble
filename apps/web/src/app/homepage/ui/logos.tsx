import { cx } from "@marble/ui";
import type { ComponentType, ReactNode, SVGProps } from "react";

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

type BrandGlyphProps = {
  size?: number;
  className?: string;
};

function GlyphBase({
  size = 24,
  className,
  children,
  ...rest
}: BrandGlyphProps &
  SVGProps<SVGSVGElement> & {
    children: ReactNode;
  }) {
  return (
    <svg
      aria-hidden="true"
      className={cx("inline-block shrink-0", className)}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {children}
    </svg>
  );
}

// =========================================================
// Agent / IDE / tooling marks
// =========================================================

export function ClaudeGlyph(props: BrandGlyphProps) {
  // Stylized sun-burst flare — Claude's warm Anthropic vibe.
  return (
    <GlyphBase {...props}>
      <circle
        cx="12"
        cy="12"
        fill="currentColor"
        r="3"
      />
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
      <path d="M5.6 5.6l2.1 2.1" />
      <path d="M16.3 16.3l2.1 2.1" />
      <path d="M5.6 18.4l2.1-2.1" />
      <path d="M16.3 7.7l2.1-2.1" />
    </GlyphBase>
  );
}

export function CodexGlyph(props: BrandGlyphProps) {
  // Curly brace bracket pair with a dot — OpenAI's coding CLI vibe.
  return (
    <GlyphBase {...props}>
      <path d="M8 5c-2 0-3 1-3 3v2c0 1-1 2-2 2 1 0 2 1 2 2v2c0 2 1 3 3 3" />
      <path d="M16 5c2 0 3 1 3 3v2c0 1 1 2 2 2-1 0-2 1-2 2v2c0 2-1 3-3 3" />
      <circle
        cx="12"
        cy="12"
        fill="currentColor"
        r="1.4"
      />
    </GlyphBase>
  );
}

export function CursorGlyph(props: BrandGlyphProps) {
  // Cursor pointer triangle.
  return (
    <GlyphBase {...props}>
      <path
        d="M5 3l13 8-6 1-2 6-5-15z"
        fill="currentColor"
      />
    </GlyphBase>
  );
}

export function ContinueGlyph(props: BrandGlyphProps) {
  // → arrow into a target dot.
  return (
    <GlyphBase {...props}>
      <path d="M3 12h13" />
      <path d="M13 7l5 5-5 5" />
      <circle
        cx="20"
        cy="12"
        fill="currentColor"
        r="1.2"
      />
    </GlyphBase>
  );
}

export function OpenCodeGlyph(props: BrandGlyphProps) {
  // Hex-framed braces — open-source coding feel.
  return (
    <GlyphBase {...props}>
      <path d="M6 4h12l3 4-3 4 3 4-3 4H6l-3-4 3-4-3-4z" />
      <path d="M10 9l-2 3 2 3" />
      <path d="M14 9l2 3-2 3" />
    </GlyphBase>
  );
}

export function AiderGlyph(props: BrandGlyphProps) {
  // + cross in a square — assistive pair-programming mark.
  return (
    <GlyphBase {...props}>
      <rect
        height="16"
        rx="2"
        width="16"
        x="4"
        y="4"
      />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </GlyphBase>
  );
}

export function WindsurfGlyph(props: BrandGlyphProps) {
  // ≈ stacked waves.
  return (
    <GlyphBase {...props}>
      <path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </GlyphBase>
  );
}

export function McpGlyph(props: BrandGlyphProps) {
  // Three-node connection — generic protocol mark.
  return (
    <GlyphBase {...props}>
      <circle
        cx="5"
        cy="12"
        fill="currentColor"
        r="2.2"
      />
      <circle
        cx="19"
        cy="6"
        fill="currentColor"
        r="2.2"
      />
      <circle
        cx="19"
        cy="18"
        fill="currentColor"
        r="2.2"
      />
      <path d="M6.6 11l10.4-4" />
      <path d="M6.6 13l10.4 4" />
    </GlyphBase>
  );
}

// =========================================================
// Model provider marks
// =========================================================

export function OpenAIGlyph(props: BrandGlyphProps) {
  // Hexagonal-knot approximation — concentric hexagon with center dot.
  return (
    <GlyphBase {...props}>
      <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9L12 3z" />
      <path d="M12 8l4 2.3v3.4L12 16l-4-2.3v-3.4L12 8z" />
      <circle
        cx="12"
        cy="12"
        fill="currentColor"
        r="1"
      />
    </GlyphBase>
  );
}

export function AnthropicGlyph(props: BrandGlyphProps) {
  // Stylized wing/spire mark — two intersecting triangles.
  return (
    <GlyphBase {...props}>
      <path
        d="M8 4l-4 16h3l1-3.5h4L13 20h3L12 4z"
        fill="currentColor"
      />
      <path d="M16 4l4 16h-3l-1-3.5" />
    </GlyphBase>
  );
}

export function GoogleGlyph(props: BrandGlyphProps) {
  // G-shape — three-quarter ring with a horizontal stub.
  return (
    <GlyphBase {...props}>
      <path d="M19 12a7 7 0 11-2.5-5.4" />
      <path d="M12 12h7" />
      <path d="M19 12v3" />
    </GlyphBase>
  );
}

export function MistralGlyph(props: BrandGlyphProps) {
  // Three stacked color-band stripes — Mistral's signature gradient.
  return (
    <GlyphBase {...props}>
      <rect
        fill="currentColor"
        height="3"
        rx="0.5"
        width="16"
        x="4"
        y="6"
      />
      <rect
        fill="currentColor"
        height="3"
        opacity="0.65"
        rx="0.5"
        width="16"
        x="4"
        y="10.5"
      />
      <rect
        fill="currentColor"
        height="3"
        opacity="0.35"
        rx="0.5"
        width="16"
        x="4"
        y="15"
      />
    </GlyphBase>
  );
}

export function GroqGlyph(props: BrandGlyphProps) {
  // Q with a cut — angular fast-inference vibe.
  return (
    <GlyphBase {...props}>
      <circle
        cx="12"
        cy="12"
        r="7"
      />
      <path d="M15.5 15.5L20 20" />
      <path d="M9 12h6" />
    </GlyphBase>
  );
}

export function OllamaGlyph(props: BrandGlyphProps) {
  // Llama silhouette — simplified to head + ears + neck.
  return (
    <GlyphBase {...props}>
      <path d="M9 4v4" />
      <path d="M15 4v4" />
      <path
        d="M7 8c0-1 1-2 2-2h6c1 0 2 1 2 2v4c0 2-1 3-2 4l-1 4h-4l-1-4c-1-1-2-2-2-4z"
        fill="currentColor"
      />
    </GlyphBase>
  );
}

export function OpenRouterGlyph(props: BrandGlyphProps) {
  // Router fan-out — one node splits to three.
  return (
    <GlyphBase {...props}>
      <circle
        cx="4"
        cy="12"
        fill="currentColor"
        r="2"
      />
      <path d="M6 12h6" />
      <path d="M12 12l6-5" />
      <path d="M12 12l6 5" />
      <path d="M12 12h6" />
      <circle
        cx="20"
        cy="7"
        r="1.8"
      />
      <circle
        cx="20"
        cy="12"
        r="1.8"
      />
      <circle
        cx="20"
        cy="17"
        r="1.8"
      />
    </GlyphBase>
  );
}

// =========================================================
// Marble's brand kit (first-party)
// =========================================================

export function MarbleGlyph(props: BrandGlyphProps) {
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

// =========================================================
// Registry — map ID → glyph + display name + accent tone
// =========================================================

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
