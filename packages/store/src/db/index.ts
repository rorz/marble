import type { SupabaseClient } from "@marble/supabase";
import type {
  MarbleStoreOptions,
  ResourceActions,
  ResourceContext,
} from "../types";
import { createSupabaseDb, type SupabaseDb } from "./supabase";

export type { ListOptions, ListOrder } from "./supabase";

export type ResourceDeps = {
  actions: ResourceActions;
  context: ResourceContext;
  db: SupabaseDb;
  serviceSupabase?: SupabaseClient;
  supabase: SupabaseClient;
};

export const createResourceDeps = ({
  actions = {},
  context,
  serviceSupabase,
  supabase,
}: MarbleStoreOptions): ResourceDeps => ({
  actions,
  context,
  db: createSupabaseDb(supabase, context, serviceSupabase),
  serviceSupabase,
  supabase,
});
