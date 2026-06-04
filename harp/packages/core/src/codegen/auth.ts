import type { ApiModel } from "../model";

/**
 * Renders the cap'n's inferred authentication notes (how + where auth is used:
 * scheme, where credentials live, how to obtain them, which surfaces require
 * them) as a standalone markdown doc, shown alongside the generated contract.
 */
export const generateAuthDoc = (model: ApiModel): string => {
  const header = [
    `# Authentication — ${model.host || "API"}`,
    "",
    "> Inferred by HARP \uD83E\uDE89 from observed traffic + live probes.",
    "",
  ].join("\n");
  const notes = model.auth.trim();
  if (notes.length === 0) {
    return `${header}\nNo auth inferred yet. Ask the cap'n in the Captain's Log — e.g. "how does auth work here?" — and it'll document it.\n`;
  }
  return `${header}\n${notes}\n`;
};
