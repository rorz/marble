import { type BrandGlyphProps, GlyphBase } from "./glyph";

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
        d="M6 20l5-14h2l5 14"
        fill="currentColor"
      />
      <path d="M9 14h6" />
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
