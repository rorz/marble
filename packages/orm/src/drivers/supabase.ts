import type { Database, SupabaseClient } from "@marble/supabase";
import type {
  DbInsert,
  DbRow,
  DbUpdate,
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

  public async list<T extends TableWithIdName>(
    tableName: T,
    where: Partial<DbRow<T>> = {},
  ): Promise<DbRow<T>[]> {
    const request = this.supabase
      .from<T, Database["public"]["Tables"][T]>(tableName)
      .select<"*", DbRow<T>>("*");

    const { data, error } = await (Object.keys(where).length === 0
      ? request
      : request.match(where));

    if (error) {
      throw new Error(error.message);
    }

    return data ?? [];
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

  public async update<T extends TableWithIdName>(
    tableName: T,
    id: string,
    values: DbUpdate<T>,
  ): Promise<DbRow<T>> {
    const { data, error } = await this.supabase
      .from<T, Database["public"]["Tables"][T]>(tableName)
      .update<DbUpdate<T>>(values)
      .match({
        id,
      })
      .select<"*", DbRow<T>>("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (data === null) {
      throw new Error(`No ${tableName} row was found with id ${id}.`);
    }

    return data;
  }

  public async delete<T extends TableWithIdName>(
    tableName: T,
    id: string,
  ): Promise<DbRow<T>> {
    const { data, error } = await this.supabase
      .from<T, Database["public"]["Tables"][T]>(tableName)
      .delete()
      .match({
        id,
      })
      .select<"*", DbRow<T>>("*")
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
