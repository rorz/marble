/**
 * Auto-generated Supabase database types.
 *
 * Regenerate with: pnpm gen:types
 *
 * Until then, this placeholder gives you a working `Database` type
 * that won't block builds in consuming packages.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = Record<
  string,
  {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  }
>;
