import { normalizeDisplayLabel } from "@marble/lib/string";

export const buildSourceTitle = (
  source:
    | null
    | Pick<
        {
          name: string;
        },
        "name"
      >
    | undefined,
) => {
  return normalizeDisplayLabel(source?.name, "Untitled Source");
};
