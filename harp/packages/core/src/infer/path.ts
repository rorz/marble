/**
 * Path templating. Real URLs carry concrete identifiers
 * (`/users/4f1a.../posts/12`); HARP collapses those id-like segments into named
 * template params (`/users/{userId}/posts/{id}`) so every hit on an endpoint
 * groups together regardless of which specific record was fetched.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERSION_SEGMENT = /^(api|rest|graphql|v\d+)$/i;

export type PathTemplate = {
  params: Array<{
    name: string;
    value: string;
  }>;
  template: string;
};

const splitPath = (pathname: string) =>
  pathname.split("/").filter((segment) => segment.length > 0);

const isIdSegment = (segment: string): boolean => {
  if (UUID_PATTERN.test(segment)) {
    return true;
  }
  if (/^\d+$/.test(segment)) {
    return true;
  }
  if (/^[0-9a-f]{16,}$/i.test(segment)) {
    return true;
  }
  return (
    segment.length >= 16 &&
    /^[A-Za-z0-9_-]+$/.test(segment) &&
    /\d/.test(segment) &&
    /[A-Za-z]/.test(segment)
  );
};

const toCamel = (word: string) =>
  word
    .replace(/[^A-Za-z0-9]+(.)?/g, (_match, next: string | undefined) =>
      next ? next.toUpperCase() : "",
    )
    .replace(/^[^A-Za-z]+/, "");

const singularize = (word: string): string => {
  if (/ies$/i.test(word)) {
    return `${word.slice(0, -3)}y`;
  }
  if (/(ses|xes|zes|ches|shes)$/i.test(word)) {
    return word.slice(0, -2);
  }
  if (/[^s]s$/i.test(word)) {
    return word.slice(0, -1);
  }
  return word;
};

const uniqueName = (base: string, used: Set<string>) => {
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}${suffix}`)) {
    suffix += 1;
  }
  return `${base}${suffix}`;
};

const paramNameFor = (previous: string | undefined, used: Set<string>) => {
  const camel = previous ? toCamel(previous) : "";
  const base = camel ? `${singularize(camel)}Id` : "id";
  const name = uniqueName(base, used);
  used.add(name);
  return name;
};

export const templatizePath = (pathname: string): PathTemplate => {
  const segments = splitPath(pathname);
  const used = new Set<string>();
  const params: Array<{
    name: string;
    value: string;
  }> = [];
  const out = segments.map((segment, index) => {
    if (!isIdSegment(segment)) {
      return segment;
    }
    const name = paramNameFor(segments[index - 1], used);
    params.push({
      name,
      value: segment,
    });
    return `{${name}}`;
  });
  return {
    params,
    template: out.length > 0 ? `/${out.join("/")}` : "/",
  };
};

export const resourceNameFromTemplate = (template: string): string => {
  const segments = splitPath(template);
  for (const segment of segments) {
    if (segment.startsWith("{") || VERSION_SEGMENT.test(segment)) {
      continue;
    }
    const camel = toCamel(segment);
    return camel.length > 0 ? camel : segment;
  }
  return "root";
};

/**
 * REST shape inference shared by the coverage map and the contract codegen: a
 * resource's canonical collection path (`/users`), its item path
 * (`/users/{id}`), and the conventional verb for a given (method, path).
 */
const endsWithParam = (template: string) => /\/\{[^}]+\}$/.test(template);

const segmentCount = (template: string) => splitPath(template).length;

const shortest = (templates: string[]) =>
  [
    ...templates,
  ].sort((left, right) => segmentCount(left) - segmentCount(right))[0] ?? null;

export const pickCollectionTemplate = (templates: string[]): string | null => {
  const collections = templates.filter((template) => !endsWithParam(template));
  if (collections.length > 0) {
    return shortest(collections);
  }
  const item = shortest(templates.filter(endsWithParam));
  return item ? item.replace(/\/\{[^}]+\}$/, "") : null;
};

export const pickItemTemplate = (
  templates: string[],
  collection: string | null,
): string | null => {
  const items = templates.filter(endsWithParam);
  if (items.length > 0) {
    return shortest(items);
  }
  return collection ? `${collection}/{id}` : null;
};

export const operationVerb = (
  method: string,
  template: string,
  collection: string | null,
  item: string | null,
): string => {
  if (template === collection) {
    if (method === "GET") {
      return "list";
    }
    if (method === "POST") {
      return "create";
    }
  }
  if (template === item) {
    if (method === "GET") {
      return "get";
    }
    if (method === "PATCH" || method === "PUT") {
      return "update";
    }
    if (method === "DELETE") {
      return "delete";
    }
  }
  const last = splitPath(template).at(-1) ?? "root";
  return last.startsWith("{") ? method.toLowerCase() : toCamel(last);
};
