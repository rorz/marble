export const CRUD_OPERATIONS = [
  "list",
  "get",
  "create",
  "update",
  "delete",
] as const;

export type CrudOperation = (typeof CRUD_OPERATIONS)[number];

const READ_OPERATIONS = [
  "list",
  "get",
] as const satisfies readonly CrudOperation[];
const READ_CREATE_UPDATE_OPERATIONS = [
  "list",
  "get",
  "create",
  "update",
] as const satisfies readonly CrudOperation[];
const READ_UPDATE_OPERATIONS = [
  "list",
  "get",
  "update",
] as const satisfies readonly CrudOperation[];

export const ApiResources = {
  cells: READ_UPDATE_OPERATIONS,
  column_dependencies: READ_OPERATIONS,
  columns: CRUD_OPERATIONS,
  events: READ_OPERATIONS,
  profiles: READ_CREATE_UPDATE_OPERATIONS,
  program_files: CRUD_OPERATIONS,
  program_runs: CRUD_OPERATIONS,
  program_versions: CRUD_OPERATIONS,
  programs: CRUD_OPERATIONS,
  rows: CRUD_OPERATIONS,
  secrets: CRUD_OPERATIONS,
  tables: CRUD_OPERATIONS,
} as const;

export type ApiResourceName = keyof typeof ApiResources;
export type ApiResourceOperationsByName<
  Name extends ApiResourceName = ApiResourceName,
> = (typeof ApiResources)[Name];

export const ApiResourceNames = Object.keys(ApiResources) as ApiResourceName[];

export function apiResourceSegment(name: ApiResourceName) {
  return name.replaceAll("_", "-");
}

export function apiResourceLabel(name: ApiResourceName) {
  return apiResourceSegment(name).replace(/-/g, " ");
}

export function apiResourcePath(name: ApiResourceName) {
  return `/${apiResourceSegment(name)}`;
}

export function apiResourceItemPath(name: ApiResourceName, id: string) {
  return `${apiResourcePath(name)}/${id}`;
}

export function supportsResourceOperation(
  name: ApiResourceName,
  operation: CrudOperation,
) {
  return (ApiResources[name] as readonly CrudOperation[]).includes(operation);
}
