import { type BrandGlyphProps, GlyphBase } from "./glyph";

export const ClaudeGlyph = (props: BrandGlyphProps) => {
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
};

export const CodexGlyph = (props: BrandGlyphProps) => {
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
};

export const CursorGlyph = (props: BrandGlyphProps) => {
  // Cursor pointer triangle.
  return (
    <GlyphBase {...props}>
      <path
        d="M5 3l13 8-6 1-2 6-5-15z"
        fill="currentColor"
      />
    </GlyphBase>
  );
};

export const ContinueGlyph = (props: BrandGlyphProps) => {
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
};

export const OpenCodeGlyph = (props: BrandGlyphProps) => {
  // Hex-framed braces — open-source coding feel.
  return (
    <GlyphBase {...props}>
      <path d="M6 4h12l3 4-3 4 3 4-3 4H6l-3-4 3-4-3-4z" />
      <path d="M10 9l-2 3 2 3" />
      <path d="M14 9l2 3-2 3" />
    </GlyphBase>
  );
};

export const AiderGlyph = (props: BrandGlyphProps) => {
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
};

export const WindsurfGlyph = (props: BrandGlyphProps) => {
  // ≈ stacked waves.
  return (
    <GlyphBase {...props}>
      <path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </GlyphBase>
  );
};

export const McpGlyph = (props: BrandGlyphProps) => {
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
};
