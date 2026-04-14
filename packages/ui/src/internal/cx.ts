type ClassNameValue = false | null | string | undefined;

export function cx(...values: ClassNameValue[]) {
  return values.filter(Boolean).join(" ");
}
