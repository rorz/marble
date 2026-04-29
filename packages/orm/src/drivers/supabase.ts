import type { Database, SupabaseClient } from "@marble/supabase";
import type {
  DbInsert,
  DbRow,
  ResourceDriver,
  TableWithIdName,
} from "../types";

export class SupabaseDriver implements ResourceDriver {
  constructor(private readonly supabase: SupabaseClient) {}

  public async create<T extends TableWithIdName>(
    tableName: T,
    values: DbInsert<T>,
  ): Promise<DbRow<T>> {
    const { data, error } = await this.supabase
      .from<T, Database["public"]["Tables"][T]>(tableName)
      .insert<DbInsert<T>>(values)
      .select<"*", DbRow<T>>("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (data === null) {
      throw new Error(`No ${tableName} row was returned after insert.`);
    }

    return data;
  }

  public async retrieve<T extends TableWithIdName>(
    tableName: T,
    id: string,
  ): Promise<DbRow<T>> {
    const { data, error } = await this.supabase
      .from<T, Database["public"]["Tables"][T]>(tableName)
      .select<"*", DbRow<T>>("*")
      .match({
        id,
      })
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (data === null) {
      throw new Error(`No ${tableName} row was found with id ${id}.`);
    }

    return data;
  }
}
