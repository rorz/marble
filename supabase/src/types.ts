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
          column_id: string;
          created_at: string;
          id: string;
          manual_input: string | null;
          row_id: string;
          state: Json | null;
          updated_at: string;
        };
        Insert: {
          column_id: string;
          created_at?: string;
          id?: string;
          manual_input?: string | null;
          row_id: string;
          state?: Json | null;
          updated_at?: string;
        };
        Update: {
          column_id?: string;
          created_at?: string;
          id?: string;
          manual_input?: string | null;
          row_id?: string;
          state?: Json | null;
          updated_at?: string;
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
          created_at: string;
          id: string;
          idx: number;
          input_template: string;
          name: string;
          output_schema: Json;
          program_version_id: string;
          run_condition: Json;
          table_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idx: number;
          input_template: string;
          name: string;
          output_schema: Json;
          program_version_id: string;
          run_condition?: Json;
          table_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idx?: number;
          input_template?: string;
          name?: string;
          output_schema?: Json;
          program_version_id?: string;
          run_condition?: Json;
          table_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "column_program_version_id_fkey";
            columns: [
              "program_version_id",
            ];
            isOneToOne: false;
            referencedRelation: "program_version";
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
      column_secret_binding: {
        Row: {
          column_id: string;
          created_at: string;
          env_name: string;
          id: string;
          secret_id: string;
          updated_at: string;
        };
        Insert: {
          column_id: string;
          created_at?: string;
          env_name: string;
          id?: string;
          secret_id: string;
          updated_at?: string;
        };
        Update: {
          column_id?: string;
          created_at?: string;
          env_name?: string;
          id?: string;
          secret_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "column_secret_binding_column_id_fkey";
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
            foreignKeyName: "column_secret_binding_secret_id_fkey";
            columns: [
              "secret_id",
            ];
            isOneToOne: false;
            referencedRelation: "secret";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      event: {
        Row: {
          actor_key_id: string | null;
          actor_profile_id: string;
          after_state: Json | null;
          before_state: Json | null;
          created_at: string;
          diff: Json;
          entity_id: string;
          id: string;
          operation: Database["public"]["Enums"]["data_operation"];
          request_id: string | null;
          resource: string;
          source: Database["public"]["Enums"]["event_source"];
        };
        Insert: {
          actor_key_id?: string | null;
          actor_profile_id: string;
          after_state?: Json | null;
          before_state?: Json | null;
          created_at?: string;
          diff?: Json;
          entity_id: string;
          id?: string;
          operation: Database["public"]["Enums"]["data_operation"];
          request_id?: string | null;
          resource: string;
          source?: Database["public"]["Enums"]["event_source"];
        };
        Update: {
          actor_key_id?: string | null;
          actor_profile_id?: string;
          after_state?: Json | null;
          before_state?: Json | null;
          created_at?: string;
          diff?: Json;
          entity_id?: string;
          id?: string;
          operation?: Database["public"]["Enums"]["data_operation"];
          request_id?: string | null;
          resource?: string;
          source?: Database["public"]["Enums"]["event_source"];
        };
        Relationships: [
          {
            foreignKeyName: "event_actor_key_id_fkey";
            columns: [
              "actor_key_id",
            ];
            isOneToOne: false;
            referencedRelation: "key";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "event_actor_profile_id_fkey";
            columns: [
              "actor_profile_id",
            ];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      key: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          hash: string;
          id: string;
          owner_profile_id: string;
          prefix: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          hash: string;
          id?: string;
          owner_profile_id: string;
          prefix: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          hash?: string;
          id?: string;
          owner_profile_id?: string;
          prefix?: string;
        };
        Relationships: [
          {
            foreignKeyName: "key_owner_profile_id_fkey";
            columns: [
              "owner_profile_id",
            ];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      pipe: {
        Row: {
          created_at: string;
          id: string;
          mappings: Json;
          source_id: string;
          table_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mappings?: Json;
          source_id: string;
          table_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mappings?: Json;
          source_id?: string;
          table_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipe_source_id_fkey";
            columns: [
              "source_id",
            ];
            isOneToOne: false;
            referencedRelation: "source";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "pipe_table_id_fkey";
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
      profile: {
        Row: {
          created_at: string;
          external_name: string | null;
          icon: string | null;
          id: string;
          name: string;
          owner_user_id: string;
          type: Database["public"]["Enums"]["profile_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          external_name?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          owner_user_id: string;
          type: Database["public"]["Enums"]["profile_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          external_name?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          owner_user_id?: string;
          type?: Database["public"]["Enums"]["profile_type"];
          updated_at?: string;
        };
        Relationships: [];
      };
      program: {
        Row: {
          created_at: string;
          first_party: boolean;
          forked_from_version_id: string | null;
          id: string;
          name: string;
          owner_profile_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          first_party?: boolean;
          forked_from_version_id?: string | null;
          id?: string;
          name: string;
          owner_profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_party?: boolean;
          forked_from_version_id?: string | null;
          id?: string;
          name?: string;
          owner_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_program_forked_from";
            columns: [
              "forked_from_version_id",
            ];
            isOneToOne: false;
            referencedRelation: "program_version";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "program_owner_profile_id_fkey";
            columns: [
              "owner_profile_id",
            ];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      program_file: {
        Row: {
          content: string;
          created_at: string;
          filename: string;
          filetype: Database["public"]["Enums"]["program_file_type"];
          id: string;
          owner_profile_id: string;
          updated_at: string;
          version_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          filename: string;
          filetype: Database["public"]["Enums"]["program_file_type"];
          id?: string;
          owner_profile_id: string;
          updated_at?: string;
          version_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          filename?: string;
          filetype?: Database["public"]["Enums"]["program_file_type"];
          id?: string;
          owner_profile_id?: string;
          updated_at?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_file_owner_profile_id_fkey";
            columns: [
              "owner_profile_id",
            ];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "program_file_version_id_fkey";
            columns: [
              "version_id",
            ];
            isOneToOne: false;
            referencedRelation: "program_version";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      program_run: {
        Row: {
          created_at: string;
          id: string;
          input: Json | null;
          output: Json | null;
          program_version_id: string;
          target_cell_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          input?: Json | null;
          output?: Json | null;
          program_version_id: string;
          target_cell_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          input?: Json | null;
          output?: Json | null;
          program_version_id?: string;
          target_cell_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_run_program_version_id_fkey";
            columns: [
              "program_version_id",
            ];
            isOneToOne: false;
            referencedRelation: "program_version";
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
      program_secret_binding: {
        Row: {
          created_at: string;
          env_name: string;
          id: string;
          owner_user_id: string;
          program_id: string;
          secret_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          env_name: string;
          id?: string;
          owner_user_id: string;
          program_id: string;
          secret_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          env_name?: string;
          id?: string;
          owner_user_id?: string;
          program_id?: string;
          secret_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "program_secret_binding_program_id_fkey";
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
            foreignKeyName: "program_secret_binding_secret_id_fkey";
            columns: [
              "secret_id",
            ];
            isOneToOne: false;
            referencedRelation: "secret";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      program_version: {
        Row: {
          created_at: string;
          id: string;
          input_schema: Json;
          output_config: Json;
          program_id: string;
          published_at: string | null;
          secret_config: Json | null;
          updated_at: string;
          version: number | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          input_schema: Json;
          output_config: Json;
          program_id: string;
          published_at?: string | null;
          secret_config?: Json | null;
          updated_at?: string;
          version?: number | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          input_schema?: Json;
          output_config?: Json;
          program_id?: string;
          published_at?: string | null;
          secret_config?: Json | null;
          updated_at?: string;
          version?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "program_version_program_id_fkey";
            columns: [
              "program_id",
            ];
            isOneToOne: false;
            referencedRelation: "program";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      project: {
        Row: {
          created_at: string;
          folder_path: string[];
          id: string;
          name: string;
          owner_profile_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          folder_path?: string[];
          id?: string;
          name?: string;
          owner_profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          folder_path?: string[];
          id?: string;
          name?: string;
          owner_profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_owner_profile_id_fkey";
            columns: [
              "owner_profile_id",
            ];
            isOneToOne: false;
            referencedRelation: "profile";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      row: {
        Row: {
          created_at: string;
          id: string;
          idx: number;
          table_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idx: number;
          table_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idx?: number;
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
      secret: {
        Row: {
          category: Database["public"]["Enums"]["secret_category"];
          created_at: string;
          id: string;
          name: string;
          owner_user_id: string;
          updated_at: string;
          vault_secret_id: string;
        };
        Insert: {
          category?: Database["public"]["Enums"]["secret_category"];
          created_at?: string;
          id?: string;
          name: string;
          owner_user_id: string;
          updated_at?: string;
          vault_secret_id: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["secret_category"];
          created_at?: string;
          id?: string;
          name?: string;
          owner_user_id?: string;
          updated_at?: string;
          vault_secret_id?: string;
        };
        Relationships: [];
      };
      source: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          payload_schema: Json;
          project_id: string;
          updated_at: string;
          webhook_token: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name?: string;
          payload_schema?: Json;
          project_id: string;
          updated_at?: string;
          webhook_token?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          payload_schema?: Json;
          project_id?: string;
          updated_at?: string;
          webhook_token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_project_id_fkey";
            columns: [
              "project_id",
            ];
            isOneToOne: false;
            referencedRelation: "project";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
      source_event: {
        Row: {
          created_at: string;
          id: string;
          parse_error: string | null;
          parsed_payload: Json | null;
          project_id: string;
          raw_payload: Json;
          source_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          parse_error?: string | null;
          parsed_payload?: Json | null;
          project_id: string;
          raw_payload: Json;
          source_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          parse_error?: string | null;
          parsed_payload?: Json | null;
          project_id?: string;
          raw_payload?: Json;
          source_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_event_project_id_fkey";
            columns: [
              "project_id",
            ];
            isOneToOne: false;
            referencedRelation: "project";
            referencedColumns: [
              "id",
            ];
          },
          {
            foreignKeyName: "source_event_source_id_project_id_fkey";
            columns: [
              "source_id",
              "project_id",
            ];
            isOneToOne: false;
            referencedRelation: "source";
            referencedColumns: [
              "id",
              "project_id",
            ];
          },
        ];
      };
      table: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          project_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name?: string;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "table_project_id_fkey";
            columns: [
              "project_id",
            ];
            isOneToOne: false;
            referencedRelation: "project";
            referencedColumns: [
              "id",
            ];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cell_belongs_to_current_user: {
        Args: {
          p_column_id: string;
          p_row_id: string;
        };
        Returns: boolean;
      };
      current_user_can_receive_event_broadcast: {
        Args: {
          p_topic: string;
        };
        Returns: boolean;
      };
      current_user_can_receive_gui_sidebar_broadcast: {
        Args: {
          p_topic: string;
        };
        Returns: boolean;
      };
      current_user_can_receive_profile_broadcast: {
        Args: {
          p_topic: string;
        };
        Returns: boolean;
      };
      current_user_can_receive_project_broadcast: {
        Args: {
          p_topic: string;
        };
        Returns: boolean;
      };
      current_user_can_receive_source_event_broadcast: {
        Args: {
          p_topic: string;
        };
        Returns: boolean;
      };
      current_user_can_receive_table_broadcast: {
        Args: {
          p_topic: string;
        };
        Returns: boolean;
      };
      current_user_can_use_pipe_scope: {
        Args: {
          p_source_id: string;
          p_table_id: string;
        };
        Returns: boolean;
      };
      current_user_can_use_source_event_scope: {
        Args: {
          p_project_id: string;
          p_source_id: string;
        };
        Returns: boolean;
      };
      current_user_owns_profile: {
        Args: {
          p_profile_id: string;
        };
        Returns: boolean;
      };
      current_user_owns_project: {
        Args: {
          p_project_id: string;
        };
        Returns: boolean;
      };
      current_user_owns_table: {
        Args: {
          p_table_id: string;
        };
        Returns: boolean;
      };
      secret_store_create: {
        Args: {
          p_category: Database["public"]["Enums"]["secret_category"];
          p_name: string;
          p_owner_user_id: string;
          p_plaintext_value: string;
        };
        Returns: {
          category: Database["public"]["Enums"]["secret_category"];
          created_at: string;
          id: string;
          name: string;
          owner_user_id: string;
          updated_at: string;
          vault_secret_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "secret";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      secret_store_delete: {
        Args: {
          p_secret_id: string;
        };
        Returns: undefined;
      };
      secret_store_resolve: {
        Args: {
          p_owner_user_id: string;
        };
        Returns: {
          category: Database["public"]["Enums"]["secret_category"];
          id: string;
          name: string;
          value: string;
        }[];
      };
      secret_store_resolve_selected: {
        Args: {
          p_owner_user_id: string;
          p_secret_ids: string[];
        };
        Returns: {
          category: Database["public"]["Enums"]["secret_category"];
          id: string;
          name: string;
          value: string;
        }[];
      };
      secret_store_update: {
        Args: {
          p_name?: string;
          p_plaintext_value?: string;
          p_secret_id: string;
        };
        Returns: {
          category: Database["public"]["Enums"]["secret_category"];
          created_at: string;
          id: string;
          name: string;
          owner_user_id: string;
          updated_at: string;
          vault_secret_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "secret";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      source_event_create: {
        Args: {
          p_raw_payload: Json;
          p_source_id: string;
        };
        Returns: {
          created_at: string;
          id: string;
          parse_error: string | null;
          parsed_payload: Json | null;
          project_id: string;
          raw_payload: Json;
          source_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "source_event";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      table_insert_rows: {
        Args: {
          p_idx: number;
          p_owner_profile_id: string;
          p_quantity: number;
          p_table_id: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      data_operation: "Create" | "Read" | "Update" | "Delete";
      event_source: "WEB_APP" | "RAW_API" | "CLI";
      profile_type: "Human" | "Agent";
      program_file_type: "TypeScript" | "Json" | "Markdown";
      secret_category: "UserDefined" | "Managed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  testing: {
    Tables: {
      tags: {
        Row: {
          created_at: string;
          id: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          value?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          value?: string;
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
      [_ in never]: never;
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
      data_operation: [
        "Create",
        "Read",
        "Update",
        "Delete",
      ],
      event_source: [
        "WEB_APP",
        "RAW_API",
        "CLI",
      ],
      profile_type: [
        "Human",
        "Agent",
      ],
      program_file_type: [
        "TypeScript",
        "Json",
        "Markdown",
      ],
      secret_category: [
        "UserDefined",
        "Managed",
      ],
    },
  },
  testing: {
    Enums: {},
  },
} as const;
