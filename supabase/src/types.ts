export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cell: {
        Row: {
          column_id: string
          created_at: string
          id: string
          manual_input: string | null
          row_id: string
          state: Json | null
          updated_at: string
        }
        Insert: {
          column_id: string
          created_at?: string
          id?: string
          manual_input?: string | null
          row_id: string
          state?: Json | null
          updated_at?: string
        }
        Update: {
          column_id?: string
          created_at?: string
          id?: string
          manual_input?: string | null
          row_id?: string
          state?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cell_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "column"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cell_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "row"
            referencedColumns: ["id"]
          },
        ]
      }
      column: {
        Row: {
          created_at: string
          id: string
          idx: number
          input_template: string
          name: string
          output_schema: Json
          program_version_id: string
          table_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          idx: number
          input_template: string
          name: string
          output_schema: Json
          program_version_id: string
          table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          idx?: number
          input_template?: string
          name?: string
          output_schema?: Json
          program_version_id?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "column_program_version_id_fkey"
            columns: ["program_version_id"]
            isOneToOne: false
            referencedRelation: "program_version"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "table"
            referencedColumns: ["id"]
          },
        ]
      }
      column_dependency: {
        Row: {
          created_at: string
          id: string
          source_column_id: string
          target_column_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_column_id: string
          target_column_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          source_column_id?: string
          target_column_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "column_dependency_source_column_id_fkey"
            columns: ["source_column_id"]
            isOneToOne: false
            referencedRelation: "column"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_dependency_target_column_id_fkey"
            columns: ["target_column_id"]
            isOneToOne: false
            referencedRelation: "column"
            referencedColumns: ["id"]
          },
        ]
      }
      column_secret_binding: {
        Row: {
          column_id: string
          created_at: string
          env_name: string
          id: string
          secret_id: string
          updated_at: string
        }
        Insert: {
          column_id: string
          created_at?: string
          env_name: string
          id?: string
          secret_id: string
          updated_at?: string
        }
        Update: {
          column_id?: string
          created_at?: string
          env_name?: string
          id?: string
          secret_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "column_secret_binding_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "column"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_secret_binding_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "secret"
            referencedColumns: ["id"]
          },
        ]
      }
      event: {
        Row: {
          actor_key_id: string | null
          actor_profile_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          diff: Json
          entity_id: string
          id: string
          operation: Database["public"]["Enums"]["data_operation"]
          request_id: string | null
          resource: string
          source: Database["public"]["Enums"]["event_source"]
        }
        Insert: {
          actor_key_id?: string | null
          actor_profile_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          diff?: Json
          entity_id: string
          id?: string
          operation: Database["public"]["Enums"]["data_operation"]
          request_id?: string | null
          resource: string
          source?: Database["public"]["Enums"]["event_source"]
        }
        Update: {
          actor_key_id?: string | null
          actor_profile_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          diff?: Json
          entity_id?: string
          id?: string
          operation?: Database["public"]["Enums"]["data_operation"]
          request_id?: string | null
          resource?: string
          source?: Database["public"]["Enums"]["event_source"]
        }
        Relationships: [
          {
            foreignKeyName: "event_actor_key_id_fkey"
            columns: ["actor_key_id"]
            isOneToOne: false
            referencedRelation: "key"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      key: {
        Row: {
          created_at: string
          deleted_at: string | null
          hash: string
          id: string
          owner_profile_id: string
          prefix: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          hash: string
          id?: string
          owner_profile_id: string
          prefix: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          hash?: string
          id?: string
          owner_profile_id?: string
          prefix?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          external_name: string | null
          icon: string | null
          id: string
          name: string
          owner_user_id: string
          type: Database["public"]["Enums"]["profile_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_name?: string | null
          icon?: string | null
          id?: string
          name: string
          owner_user_id: string
          type: Database["public"]["Enums"]["profile_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_name?: string | null
          icon?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          type?: Database["public"]["Enums"]["profile_type"]
          updated_at?: string
        }
        Relationships: []
      }
      program: {
        Row: {
          created_at: string
          first_party: boolean
          forked_from_version_id: string | null
          id: string
          name: string
          owner_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_party?: boolean
          forked_from_version_id?: string | null
          id?: string
          name: string
          owner_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_party?: boolean
          forked_from_version_id?: string | null
          id?: string
          name?: string
          owner_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_program_forked_from"
            columns: ["forked_from_version_id"]
            isOneToOne: false
            referencedRelation: "program_version"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      program_file: {
        Row: {
          content: string
          created_at: string
          filename: string
          filetype: Database["public"]["Enums"]["program_file_type"]
          id: string
          owner_profile_id: string
          updated_at: string
          version_id: string
        }
        Insert: {
          content: string
          created_at?: string
          filename: string
          filetype: Database["public"]["Enums"]["program_file_type"]
          id?: string
          owner_profile_id: string
          updated_at?: string
          version_id: string
        }
        Update: {
          content?: string
          created_at?: string
          filename?: string
          filetype?: Database["public"]["Enums"]["program_file_type"]
          id?: string
          owner_profile_id?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_file_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_file_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "program_version"
            referencedColumns: ["id"]
          },
        ]
      }
      program_run: {
        Row: {
          created_at: string
          id: string
          input: Json | null
          output: Json | null
          program_version_id: string
          target_cell_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          input?: Json | null
          output?: Json | null
          program_version_id: string
          target_cell_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: Json | null
          output?: Json | null
          program_version_id?: string
          target_cell_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_run_program_version_id_fkey"
            columns: ["program_version_id"]
            isOneToOne: false
            referencedRelation: "program_version"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_run_target_cell_id_fkey"
            columns: ["target_cell_id"]
            isOneToOne: false
            referencedRelation: "cell"
            referencedColumns: ["id"]
          },
        ]
      }
      program_secret_binding: {
        Row: {
          created_at: string
          env_name: string
          id: string
          owner_user_id: string
          program_id: string
          secret_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          env_name: string
          id?: string
          owner_user_id: string
          program_id: string
          secret_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          env_name?: string
          id?: string
          owner_user_id?: string
          program_id?: string
          secret_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_secret_binding_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_secret_binding_secret_id_fkey"
            columns: ["secret_id"]
            isOneToOne: false
            referencedRelation: "secret"
            referencedColumns: ["id"]
          },
        ]
      }
      program_version: {
        Row: {
          created_at: string
          id: string
          input_schema: Json
          output_config: Json
          program_id: string
          published_at: string | null
          secret_config: Json | null
          updated_at: string
          version: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          input_schema: Json
          output_config: Json
          program_id: string
          published_at?: string | null
          secret_config?: Json | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          input_schema?: Json
          output_config?: Json
          program_id?: string
          published_at?: string | null
          secret_config?: Json | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "program_version_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program"
            referencedColumns: ["id"]
          },
        ]
      }
      project: {
        Row: {
          created_at: string
          folder_path: string[]
          id: string
          name: string
          owner_profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          folder_path?: string[]
          id?: string
          name?: string
          owner_profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          folder_path?: string[]
          id?: string
          name?: string
          owner_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      row: {
        Row: {
          created_at: string
          id: string
          idx: number
          table_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          idx: number
          table_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          idx?: number
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "row_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "table"
            referencedColumns: ["id"]
          },
        ]
      }
      secret: {
        Row: {
          category: Database["public"]["Enums"]["secret_category"]
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
          vault_secret_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["secret_category"]
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
          vault_secret_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["secret_category"]
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
          vault_secret_id?: string
        }
        Relationships: []
      }
      table: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      secret_store_create: {
        Args: {
          p_category: Database["public"]["Enums"]["secret_category"]
          p_name: string
          p_owner_user_id: string
          p_plaintext_value: string
        }
        Returns: {
          category: Database["public"]["Enums"]["secret_category"]
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
          vault_secret_id: string
        }
        SetofOptions: {
          from: "*"
          to: "secret"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      secret_store_delete: { Args: { p_secret_id: string }; Returns: undefined }
      secret_store_resolve: {
        Args: { p_owner_user_id: string }
        Returns: {
          category: Database["public"]["Enums"]["secret_category"]
          name: string
          value: string
        }[]
      }
      secret_store_resolve_selected: {
        Args: { p_owner_user_id: string; p_secret_ids: string[] }
        Returns: {
          category: Database["public"]["Enums"]["secret_category"]
          id: string
          name: string
          value: string
        }[]
      }
      secret_store_update: {
        Args: {
          p_name?: string
          p_plaintext_value?: string
          p_secret_id: string
        }
        Returns: {
          category: Database["public"]["Enums"]["secret_category"]
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
          vault_secret_id: string
        }
        SetofOptions: {
          from: "*"
          to: "secret"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      data_operation: "Create" | "Read" | "Update" | "Delete"
      event_source: "WEB_APP" | "RAW_API" | "CLI"
      profile_type: "Human" | "Agent"
      program_file_type: "TypeScript" | "Json" | "Markdown"
      secret_category: "UserDefined" | "Managed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      data_operation: ["Create", "Read", "Update", "Delete"],
      event_source: ["WEB_APP", "RAW_API", "CLI"],
      profile_type: ["Human", "Agent"],
      program_file_type: ["TypeScript", "Json", "Markdown"],
      secret_category: ["UserDefined", "Managed"],
    },
  },
} as const

