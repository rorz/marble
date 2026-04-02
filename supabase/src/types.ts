export type Json =
  | string
  | number
  | boolean
  | null
  | {
      [key: string]: Json | undefined;
    }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      cell: {
        Row: {
          author_user_id: string | null;
          column_id: string;
          created_at: string;
          id: string;
          row_id: string;
          updated_at: string;
          value: Json | null;
        };
        Insert: {
          author_user_id?: string | null;
          column_id: string;
          created_at?: string;
          id?: string;
          row_id: string;
          updated_at?: string;
          value?: Json | null;
        };
        Update: {
          author_user_id?: string | null;
          column_id?: string;
          created_at?: string;
          id?: string;
          row_id?: string;
          updated_at?: string;
          value?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "cell_column_id_fkey";
            columns: [
              "column_id",
            ];
            isOneToOne: false;
            referencedRelation: "column";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "cell_row_id_fkey";
            columns: [
              "row_id",
            ];
            isOneToOne: false;
            referencedRelation: "row";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      column: {
        Row: {
          author_user_id: string | null;
          created_at: string;
          id: string;
          index: number;
          input_template: string;
          program_id: string;
          table_id: string;
          updated_at: string;
        };
        Insert: {
          author_user_id?: string | null;
          created_at?: string;
          id?: string;
          index: number;
          input_template: string;
          program_id: string;
          table_id: string;
          updated_at?: string;
        };
        Update: {
          author_user_id?: string | null;
          created_at?: string;
          id?: string;
          index?: number;
          input_template?: string;
          program_id?: string;
          table_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "column_program_id_fkey";
            columns: [
              "program_id",
            ];
            isOneToOne: false;
            referencedRelation: "program";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "column_table_id_fkey";
            columns: [
              "table_id",
            ];
            isOneToOne: false;
            referencedRelation: "table";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      column_dependency: {
        Row: {
          created_at: string;
          id: string;
          source_column_id: string;
          target_column_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          source_column_id: string;
          target_column_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          source_column_id?: string;
          target_column_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "column_dependency_source_column_id_fkey";
            columns: [
              "source_column_id",
            ];
            isOneToOne: false;
            referencedRelation: "column";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "column_dependency_target_column_id_fkey";
            columns: [
              "target_column_id",
            ];
            isOneToOne: false;
            referencedRelation: "column";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      program: {
        Row: {
          author_user_id: string | null;
          code: string;
          created_at: string;
          first_party: boolean;
          id: string;
          input_payload_schema: Json;
          output_value_schema: Json;
          runtime: Database["public"]["Enums"]["program_runtime"];
          updated_at: string;
        };
        Insert: {
          author_user_id?: string | null;
          code: string;
          created_at?: string;
          first_party?: boolean;
          id?: string;
          input_payload_schema: Json;
          output_value_schema: Json;
          runtime: Database["public"]["Enums"]["program_runtime"];
          updated_at?: string;
        };
        Update: {
          author_user_id?: string | null;
          code?: string;
          created_at?: string;
          first_party?: boolean;
          id?: string;
          input_payload_schema?: Json;
          output_value_schema?: Json;
          runtime?: Database["public"]["Enums"]["program_runtime"];
          updated_at?: string;
        };
        Relationships: [];
      };
      program_run: {
        Row: {
          created_at: string;
          id: string;
          input: Json | null;
          instigating_user_id: string;
          output: Json | null;
          program_id: string;
          target_cell_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          input?: Json | null;
          instigating_user_id: string;
          output?: Json | null;
          program_id: string;
          target_cell_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          input?: Json | null;
          instigating_user_id?: string;
          output?: Json | null;
          program_id?: string;
          target_cell_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_run_program_id_fkey";
            columns: [
              "program_id",
            ];
            isOneToOne: false;
            referencedRelation: "program";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "program_run_target_cell_id_fkey";
            columns: [
              "target_cell_id",
            ];
            isOneToOne: false;
            referencedRelation: "cell";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      row: {
        Row: {
          author_user_id: string | null;
          created_at: string;
          id: string;
          index: number;
          table_id: string;
          updated_at: string;
        };
        Insert: {
          author_user_id?: string | null;
          created_at?: string;
          id?: string;
          index: number;
          table_id: string;
          updated_at?: string;
        };
        Update: {
          author_user_id?: string | null;
          created_at?: string;
          id?: string;
          index?: number;
          table_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "row_table_id_fkey";
            columns: [
              "table_id",
            ];
            isOneToOne: false;
            referencedRelation: "table";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      table: {
        Row: {
          author_user_id: string | null;
          created_at: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          author_user_id?: string | null;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          author_user_id?: string | null;
          created_at?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      program_runtime: "JavaScript" | "Python";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | {
        schema: keyof DatabaseWithoutInternals;
      },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      program_runtime: [
        "JavaScript",
        "Python",
      ],
    },
  },
} as const;
