export { MarbleClient } from "./client";
export { SupabaseDriver } from "./drivers/supabase";
export {
  type CreateProjectInput,
  ProjectCollection,
  type ProjectCollectionApi,
  type UpdateProjectInput,
} from "./resources/project";
export {
  type CreateTableInput,
  type ListTablesInput,
  TableCollection,
  type TableCollectionApi,
  type UpdateTableInput,
} from "./resources/table";
export type {
  CreateParams,
  Entity,
  ListParams,
  ResourceContext,
  ResourceDriver,
  ResourceOptions,
  ResourceRow,
  UpdateParams,
} from "./types";
