export const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

/**
 * Strip an exact `prefix` from the start of `value`. Returns `value`
 * unchanged when no prefix matches. Pass an empty prefix to get the input
 * back unchanged.
 */
export const stripPrefix = (value: string, prefix: string) =>
  value.startsWith(prefix) ? value.slice(prefix.length) : value;

/**
 * Trim a value and return it; fall back to `fallback` when the trimmed
 * value is empty or the input was missing. Used for "Untitled X"-style
 * label normalisation.
 */
export const normalizeDisplayLabel = (
  value: null | string | undefined,
  fallback: string,
) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

/**
 * Format a JSONPath string for human display:
 *   `$.foo.bar`            -> `foo.bar`
 *   `$['foo']['bar']`      -> `foo.bar`
 *   `$`                    -> `$`
 *   ``                     -> `$`
 * The original string is returned when normalisation collapses to empty.
 */
export const formatJsonPathDisplay = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "$";
  }

  const normalized = trimmed
    .replace(/^\$\./, "")
    .replace(/^\$/, "")
    .replace(/\[['"]([^'"\]]+)['"]\]/g, ".$1")
    .replace(/^\.+/, "");

  return normalized.length > 0 ? normalized : trimmed;
};
