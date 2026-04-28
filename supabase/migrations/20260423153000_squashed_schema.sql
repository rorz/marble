


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';


CREATE SCHEMA IF NOT EXISTS "testing";


ALTER SCHEMA "testing" OWNER TO "postgres";



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."data_operation" AS ENUM (
    'Create',
    'Read',
    'Update',
    'Delete'
);


ALTER TYPE "public"."data_operation" OWNER TO "postgres";


CREATE TYPE "public"."event_source" AS ENUM (
    'WEB_APP',
    'RAW_API',
    'CLI'
);


ALTER TYPE "public"."event_source" OWNER TO "postgres";


CREATE TYPE "public"."profile_type" AS ENUM (
    'Human',
    'Agent'
);


ALTER TYPE "public"."profile_type" OWNER TO "postgres";


CREATE TYPE "public"."program_file_type" AS ENUM (
    'TypeScript',
    'Json',
    'Markdown'
);


ALTER TYPE "public"."program_file_type" OWNER TO "postgres";


CREATE TYPE "public"."secret_category" AS ENUM (
    'UserDefined',
    'Managed'
);


ALTER TYPE "public"."secret_category" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profile (owner_user_id, name, type)
  VALUES (new.id, 'Me', 'Human');
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."secret" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."secret_category" DEFAULT 'UserDefined'::"public"."secret_category" NOT NULL,
    "vault_secret_id" "uuid" NOT NULL,
    CONSTRAINT "secret_name_check" CHECK (("name" ~ '^[A-Za-z_][A-Za-z0-9_]*$'::"text"))
);


ALTER TABLE "public"."secret" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secret_store_create"("p_owner_user_id" "uuid", "p_name" "text", "p_category" "public"."secret_category", "p_plaintext_value" "text") RETURNS "public"."secret"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  created_secret public.secret;
  created_vault_secret_id UUID;
BEGIN
  created_vault_secret_id := vault.create_secret(p_plaintext_value);

  INSERT INTO public.secret (owner_user_id, name, category, vault_secret_id)
  VALUES (p_owner_user_id, p_name, p_category, created_vault_secret_id)
  RETURNING * INTO created_secret;

  RETURN created_secret;
EXCEPTION
  WHEN OTHERS THEN
    IF created_vault_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets
      WHERE id = created_vault_secret_id;
    END IF;

    RAISE;
END
$$;


ALTER FUNCTION "public"."secret_store_create"("p_owner_user_id" "uuid", "p_name" "text", "p_category" "public"."secret_category", "p_plaintext_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secret_store_delete"("p_secret_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  existing_secret public.secret;
BEGIN
  SELECT *
  INTO existing_secret
  FROM public.secret
  WHERE id = p_secret_id
  FOR UPDATE;

  IF existing_secret.id IS NULL THEN
    RAISE EXCEPTION 'Secret % was not found', p_secret_id
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM vault.secrets
  WHERE id = existing_secret.vault_secret_id;
END
$$;


ALTER FUNCTION "public"."secret_store_delete"("p_secret_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secret_store_resolve"("p_owner_user_id" "uuid") RETURNS TABLE("id" "uuid", "category" "public"."secret_category", "name" "text", "value" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    secret.id,
    secret.category,
    secret.name,
    decrypted_secret.decrypted_secret AS value
  FROM public.secret
  JOIN vault.decrypted_secrets AS decrypted_secret
    ON decrypted_secret.id = secret.vault_secret_id
  WHERE secret.owner_user_id = p_owner_user_id
  ORDER BY secret.name ASC, secret.category ASC
$$;


ALTER FUNCTION "public"."secret_store_resolve"("p_owner_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secret_store_resolve_selected"("p_owner_user_id" "uuid", "p_secret_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "category" "public"."secret_category", "name" "text", "value" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    secret.id,
    secret.category,
    secret.name,
    decrypted_secret.decrypted_secret AS value
  FROM public.secret
  JOIN vault.decrypted_secrets AS decrypted_secret
    ON decrypted_secret.id = secret.vault_secret_id
  WHERE secret.owner_user_id = p_owner_user_id
    AND secret.id = ANY (p_secret_ids)
  ORDER BY secret.name ASC, secret.category ASC
$$;


ALTER FUNCTION "public"."secret_store_resolve_selected"("p_owner_user_id" "uuid", "p_secret_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secret_store_update"("p_secret_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_plaintext_value" "text" DEFAULT NULL::"text") RETURNS "public"."secret"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  existing_secret public.secret;
  updated_secret public.secret;
BEGIN
  SELECT *
  INTO existing_secret
  FROM public.secret
  WHERE id = p_secret_id
  FOR UPDATE;

  IF existing_secret.id IS NULL THEN
    RAISE EXCEPTION 'Secret % was not found', p_secret_id
      USING ERRCODE = 'P0002';
  END IF;

  IF p_plaintext_value IS NOT NULL THEN
    PERFORM vault.update_secret(
      existing_secret.vault_secret_id,
      p_plaintext_value
    );
  END IF;

  UPDATE public.secret
  SET name = COALESCE(p_name, name)
  WHERE id = p_secret_id
  RETURNING * INTO updated_secret;

  RETURN updated_secret;
END
$$;


ALTER FUNCTION "public"."secret_store_update"("p_secret_id" "uuid", "p_name" "text", "p_plaintext_value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cell" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "column_id" "uuid" NOT NULL,
    "row_id" "uuid" NOT NULL,
    "manual_input" "text",
    "state" "jsonb"
);


ALTER TABLE "public"."cell" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "testing"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "value" character varying DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "testing"."tags" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "testing"."broadcast_tag_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'testing:tags:' || COALESCE(NEW.id, OLD.id)::TEXT,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );

  RETURN NULL;
END;
$$;


ALTER FUNCTION "testing"."broadcast_tag_changes"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."column" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "idx" bigint NOT NULL,
    "program_version_id" "uuid" NOT NULL,
    "input_template" "text" NOT NULL,
    "output_schema" "jsonb" NOT NULL,
    "run_condition" "jsonb" DEFAULT "to_jsonb"(false) NOT NULL
);


ALTER TABLE "public"."column" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."column_dependency" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_column_id" "uuid" NOT NULL,
    "target_column_id" "uuid" NOT NULL
);


ALTER TABLE "public"."column_dependency" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."column_secret_binding" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "column_id" "uuid" NOT NULL,
    "env_name" "text" NOT NULL,
    "secret_id" "uuid" NOT NULL,
    CONSTRAINT "column_secret_binding_env_name_check" CHECK (("env_name" ~ '^[A-Za-z_][A-Za-z0-9_]*$'::"text"))
);


ALTER TABLE "public"."column_secret_binding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resource" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "operation" "public"."data_operation" NOT NULL,
    "actor_profile_id" "uuid" NOT NULL,
    "actor_key_id" "uuid",
    "before_state" "jsonb",
    "after_state" "jsonb",
    "diff" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "request_id" "text",
    "source" "public"."event_source" DEFAULT 'RAW_API'::"public"."event_source" NOT NULL
);


ALTER TABLE "public"."event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."key" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "hash" character(22) NOT NULL,
    "prefix" character(6) NOT NULL,
    "owner_profile_id" "uuid" NOT NULL
);


ALTER TABLE "public"."key" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "public"."profile_type" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "external_name" "text",
    "owner_user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "first_party" boolean DEFAULT false NOT NULL,
    "forked_from_version_id" "uuid"
);


ALTER TABLE "public"."program" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_file" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_profile_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "filetype" "public"."program_file_type" NOT NULL,
    "content" character varying(1000000) NOT NULL,
    "version_id" "uuid" NOT NULL
);


ALTER TABLE "public"."program_file" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_run" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "program_version_id" "uuid" NOT NULL,
    "target_cell_id" "uuid" NOT NULL,
    "input" "jsonb",
    "output" "jsonb"
);


ALTER TABLE "public"."program_run" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_secret_binding" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "program_id" "uuid" NOT NULL,
    "env_name" "text" NOT NULL,
    "secret_id" "uuid" NOT NULL,
    CONSTRAINT "program_secret_binding_env_name_check" CHECK (("env_name" ~ '^[A-Za-z_][A-Za-z0-9_]*$'::"text"))
);


ALTER TABLE "public"."program_secret_binding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_version" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "version" integer,
    "published_at" timestamp with time zone,
    "input_schema" "jsonb" NOT NULL,
    "output_config" "jsonb" NOT NULL,
    "secret_config" "jsonb",
    CONSTRAINT "program_version_publish_state_check" CHECK (((("published_at" IS NULL) AND ("version" IS NULL)) OR (("published_at" IS NOT NULL) AND ("version" IS NOT NULL)))),
    CONSTRAINT "program_version_secret_config_is_array" CHECK ((("secret_config" IS NULL) OR ("jsonb_typeof"("secret_config") = 'array'::"text")))
);


ALTER TABLE "public"."program_version" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "owner_profile_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Untitled Project'::"text" NOT NULL,
    "folder_path" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."project" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Untitled Source'::"text" NOT NULL,
    "payload_schema" "jsonb" DEFAULT '{"type": "object"}'::"jsonb" NOT NULL,
    "webhook_token" "text" DEFAULT "replace"(("gen_random_uuid"())::"text", '-'::"text", ''::"text") NOT NULL,
    CONSTRAINT "source_payload_schema_is_object" CHECK (("jsonb_typeof"("payload_schema") = 'object'::"text"))
);


ALTER TABLE "public"."source" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."source_event" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "raw_payload" "jsonb" NOT NULL,
    "parsed_payload" "jsonb",
    "parse_error" "text"
);


ALTER TABLE "public"."source_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."row" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "idx" bigint NOT NULL
);


ALTER TABLE "public"."row" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipe" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "mappings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "pipe_mappings_is_array" CHECK (("jsonb_typeof"("mappings") = 'array'::"text"))
);


ALTER TABLE "public"."pipe" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" DEFAULT 'Untitled Table'::"text" NOT NULL,
    "project_id" "uuid" NOT NULL
);


ALTER TABLE "public"."table" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cell"
    ADD CONSTRAINT "cell_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "testing"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cell"
    ADD CONSTRAINT "cell_row_id_column_id_key" UNIQUE ("row_id", "column_id");



ALTER TABLE ONLY "public"."column_dependency"
    ADD CONSTRAINT "column_dependency_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."column"
    ADD CONSTRAINT "column_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."column_secret_binding"
    ADD CONSTRAINT "column_secret_binding_column_id_env_name_key" UNIQUE ("column_id", "env_name");



ALTER TABLE ONLY "public"."column_secret_binding"
    ADD CONSTRAINT "column_secret_binding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."column"
    ADD CONSTRAINT "column_table_id_idx_key" UNIQUE ("table_id", "idx");



ALTER TABLE ONLY "public"."event"
    ADD CONSTRAINT "event_pkey" PRIMARY KEY ("id");


ALTER TABLE ONLY "public"."pipe"
    ADD CONSTRAINT "pipe_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."key"
    ADD CONSTRAINT "key_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_file"
    ADD CONSTRAINT "program_file_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "program_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_run"
    ADD CONSTRAINT "program_run_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_secret_binding"
    ADD CONSTRAINT "program_secret_binding_owner_user_id_program_id_env_name_key" UNIQUE ("owner_user_id", "program_id", "env_name");



ALTER TABLE ONLY "public"."program_secret_binding"
    ADD CONSTRAINT "program_secret_binding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_version"
    ADD CONSTRAINT "program_version_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source_event"
    ADD CONSTRAINT "source_event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source"
    ADD CONSTRAINT "source_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."source"
    ADD CONSTRAINT "source_webhook_token_key" UNIQUE ("webhook_token");



ALTER TABLE ONLY "public"."row"
    ADD CONSTRAINT "row_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."row"
    ADD CONSTRAINT "row_table_id_idx_key" UNIQUE ("table_id", "idx");



ALTER TABLE ONLY "public"."secret"
    ADD CONSTRAINT "secret_owner_user_id_category_name_key" UNIQUE ("owner_user_id", "category", "name");



ALTER TABLE ONLY "public"."secret"
    ADD CONSTRAINT "secret_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secret"
    ADD CONSTRAINT "secret_vault_secret_id_key" UNIQUE ("vault_secret_id");



ALTER TABLE ONLY "public"."table"
    ADD CONSTRAINT "table_pkey" PRIMARY KEY ("id");



CREATE INDEX "column_secret_binding_column_idx" ON "public"."column_secret_binding" USING "btree" ("column_id");



CREATE INDEX "event_actor_profile_created_at_idx" ON "public"."event" USING "btree" ("actor_profile_id", "created_at" DESC);



CREATE INDEX "event_entity_created_at_idx" ON "public"."event" USING "btree" ("resource", "entity_id", "created_at" DESC);



CREATE INDEX "event_request_id_idx" ON "public"."event" USING "btree" ("request_id");



CREATE INDEX "event_source_created_at_idx" ON "public"."event" USING "btree" ("source", "created_at" DESC);



CREATE INDEX "pipe_source_created_at_idx" ON "public"."pipe" USING "btree" ("source_id", "created_at" DESC);



CREATE INDEX "pipe_table_created_at_idx" ON "public"."pipe" USING "btree" ("table_id", "created_at" DESC);



CREATE INDEX "program_secret_binding_owner_program_idx" ON "public"."program_secret_binding" USING "btree" ("owner_user_id", "program_id");



CREATE UNIQUE INDEX "program_version_published_version_key" ON "public"."program_version" USING "btree" ("program_id", "version") WHERE ("version" IS NOT NULL);



CREATE UNIQUE INDEX "program_version_single_draft_key" ON "public"."program_version" USING "btree" ("program_id") WHERE ("published_at" IS NULL);



CREATE INDEX "project_owner_profile_created_at_idx" ON "public"."project" USING "btree" ("owner_profile_id", "created_at" DESC);



CREATE INDEX "source_event_project_created_at_idx" ON "public"."source_event" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "source_event_source_created_at_idx" ON "public"."source_event" USING "btree" ("source_id", "created_at" DESC);



CREATE INDEX "source_project_created_at_idx" ON "public"."source" USING "btree" ("project_id", "created_at" DESC);



CREATE INDEX "secret_owner_user_name_idx" ON "public"."secret" USING "btree" ("owner_user_id", "name");



CREATE INDEX "table_project_created_at_idx" ON "public"."table" USING "btree" ("project_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."cell" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "testing"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();


CREATE OR REPLACE TRIGGER "broadcast_tag_changes" AFTER INSERT OR DELETE OR UPDATE ON "testing"."tags" FOR EACH ROW EXECUTE FUNCTION "testing"."broadcast_tag_changes"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."column" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."column_dependency" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."column_secret_binding" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profile" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."program" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."program_file" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."program_run" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."program_secret_binding" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."program_version" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."project" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."source" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."pipe" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."row" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."secret" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."table" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."cell"
    ADD CONSTRAINT "cell_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "public"."column"("id");



ALTER TABLE ONLY "public"."cell"
    ADD CONSTRAINT "cell_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "public"."row"("id");



ALTER TABLE ONLY "public"."column_dependency"
    ADD CONSTRAINT "column_dependency_source_column_id_fkey" FOREIGN KEY ("source_column_id") REFERENCES "public"."column"("id");



ALTER TABLE ONLY "public"."column_dependency"
    ADD CONSTRAINT "column_dependency_target_column_id_fkey" FOREIGN KEY ("target_column_id") REFERENCES "public"."column"("id");



ALTER TABLE ONLY "public"."column"
    ADD CONSTRAINT "column_program_version_id_fkey" FOREIGN KEY ("program_version_id") REFERENCES "public"."program_version"("id");



ALTER TABLE ONLY "public"."column_secret_binding"
    ADD CONSTRAINT "column_secret_binding_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "public"."column"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."column_secret_binding"
    ADD CONSTRAINT "column_secret_binding_secret_id_fkey" FOREIGN KEY ("secret_id") REFERENCES "public"."secret"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."column"
    ADD CONSTRAINT "column_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table"("id");



ALTER TABLE ONLY "public"."event"
    ADD CONSTRAINT "event_actor_key_id_fkey" FOREIGN KEY ("actor_key_id") REFERENCES "public"."key"("id");



ALTER TABLE ONLY "public"."event"
    ADD CONSTRAINT "event_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."pipe"
    ADD CONSTRAINT "pipe_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipe"
    ADD CONSTRAINT "pipe_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "fk_program_forked_from" FOREIGN KEY ("forked_from_version_id") REFERENCES "public"."program_version"("id");



ALTER TABLE ONLY "public"."key"
    ADD CONSTRAINT "key_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."profile"
    ADD CONSTRAINT "profile_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."program_file"
    ADD CONSTRAINT "program_file_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."program_file"
    ADD CONSTRAINT "program_file_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."program_version"("id");



ALTER TABLE ONLY "public"."program"
    ADD CONSTRAINT "program_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."program_run"
    ADD CONSTRAINT "program_run_program_version_id_fkey" FOREIGN KEY ("program_version_id") REFERENCES "public"."program_version"("id");



ALTER TABLE ONLY "public"."program_run"
    ADD CONSTRAINT "program_run_target_cell_id_fkey" FOREIGN KEY ("target_cell_id") REFERENCES "public"."cell"("id");



ALTER TABLE ONLY "public"."program_secret_binding"
    ADD CONSTRAINT "program_secret_binding_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_secret_binding"
    ADD CONSTRAINT "program_secret_binding_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."program"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_secret_binding"
    ADD CONSTRAINT "program_secret_binding_secret_id_fkey" FOREIGN KEY ("secret_id") REFERENCES "public"."secret"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_version"
    ADD CONSTRAINT "program_version_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."program"("id");



ALTER TABLE ONLY "public"."project"
    ADD CONSTRAINT "project_owner_profile_id_fkey" FOREIGN KEY ("owner_profile_id") REFERENCES "public"."profile"("id");



ALTER TABLE ONLY "public"."source_event"
    ADD CONSTRAINT "source_event_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."source_event"
    ADD CONSTRAINT "source_event_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."source"
    ADD CONSTRAINT "source_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."row"
    ADD CONSTRAINT "row_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."table"("id");



ALTER TABLE ONLY "public"."secret"
    ADD CONSTRAINT "secret_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."secret"
    ADD CONSTRAINT "secret_vault_secret_id_fkey" FOREIGN KEY ("vault_secret_id") REFERENCES "vault"."secrets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table"
    ADD CONSTRAINT "table_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id");



CREATE POLICY "Users can manage their own column secret bindings" ON "public"."column_secret_binding" USING ((EXISTS ( SELECT 1
   FROM ((("public"."column"
     JOIN "public"."table" ON (("table"."id" = "column"."table_id")))
     JOIN "public"."project" ON (("project"."id" = "table"."project_id")))
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("column"."id" = "column_secret_binding"."column_id") AND ("profile"."owner_user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."column"
     JOIN "public"."table" ON (("table"."id" = "column"."table_id")))
     JOIN "public"."project" ON (("project"."id" = "table"."project_id")))
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("column"."id" = "column_secret_binding"."column_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own program secret bindings" ON "public"."program_secret_binding" USING (("owner_user_id" = "auth"."uid"())) WITH CHECK (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Users can view cells in their own tables" ON "public"."cell" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((("public"."row"
     JOIN "public"."table" ON (("table"."id" = "row"."table_id")))
     JOIN "public"."project" ON (("project"."id" = "table"."project_id")))
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("row"."id" = "cell"."row_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view columns in their own tables" ON "public"."column" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."table"
     JOIN "public"."project" ON (("project"."id" = "table"."project_id")))
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("table"."id" = "column"."table_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view rows in their own tables" ON "public"."row" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."table"
     JOIN "public"."project" ON (("project"."id" = "table"."project_id")))
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("table"."id" = "row"."table_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view tables in their own projects" ON "public"."table" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."project"
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("project"."id" = "table"."project_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own events" ON "public"."event" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profile"
  WHERE (("profile"."id" = "event"."actor_profile_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own profiles" ON "public"."profile" FOR SELECT USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own projects" ON "public"."project" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profile"
  WHERE (("profile"."id" = "project"."owner_profile_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view sources in their own projects" ON "public"."source" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."project"
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("project"."id" = "source"."project_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view source events in their own projects" ON "public"."source_event" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."project"
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("project"."id" = "source_event"."project_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view pipes in their own projects" ON "public"."pipe" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."table"
     JOIN "public"."project" ON (("project"."id" = "table"."project_id")))
     JOIN "public"."profile" ON (("profile"."id" = "project"."owner_profile_id")))
  WHERE (("table"."id" = "pipe"."table_id") AND ("profile"."owner_user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own secrets" ON "public"."secret" FOR SELECT USING (("owner_user_id" = "auth"."uid"()));


CREATE POLICY "Anyone can create testing tags" ON "testing"."tags" FOR INSERT TO "anon", "authenticated" WITH CHECK (true);


CREATE POLICY "Anyone can update testing tags" ON "testing"."tags" FOR UPDATE TO "anon", "authenticated" USING (true) WITH CHECK (true);


CREATE POLICY "Anyone can view testing tags" ON "testing"."tags" FOR SELECT TO "anon", "authenticated" USING (true);


CREATE POLICY "Anyone can receive testing tag broadcasts" ON "realtime"."messages" FOR SELECT TO "anon", "authenticated" USING ((( SELECT "realtime"."topic"() AS "topic") ~~ 'testing:tags:%'::"text") AND ("extension" = 'broadcast'::"text"));



ALTER TABLE "public"."cell" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "testing"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."column" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."column_dependency" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."column_secret_binding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."key" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_file" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_run" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_secret_binding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_version" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."source" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."source_event" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipe" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."row" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."secret" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."table" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."cell";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "testing"."tags";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."column";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."event";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profile";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."program";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."project";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."source";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."source_event";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pipe";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."row";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."table";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


GRANT USAGE ON SCHEMA "testing" TO "postgres";
GRANT USAGE ON SCHEMA "testing" TO "anon";
GRANT USAGE ON SCHEMA "testing" TO "authenticated";
GRANT USAGE ON SCHEMA "testing" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."secret" TO "anon";
GRANT ALL ON TABLE "public"."secret" TO "authenticated";
GRANT ALL ON TABLE "public"."secret" TO "service_role";



REVOKE ALL ON FUNCTION "public"."secret_store_create"("p_owner_user_id" "uuid", "p_name" "text", "p_category" "public"."secret_category", "p_plaintext_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secret_store_create"("p_owner_user_id" "uuid", "p_name" "text", "p_category" "public"."secret_category", "p_plaintext_value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."secret_store_delete"("p_secret_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secret_store_delete"("p_secret_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."secret_store_resolve"("p_owner_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secret_store_resolve"("p_owner_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."secret_store_resolve_selected"("p_owner_user_id" "uuid", "p_secret_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secret_store_resolve_selected"("p_owner_user_id" "uuid", "p_secret_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."secret_store_update"("p_secret_id" "uuid", "p_name" "text", "p_plaintext_value" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."secret_store_update"("p_secret_id" "uuid", "p_name" "text", "p_plaintext_value" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


GRANT ALL ON FUNCTION "testing"."broadcast_tag_changes"() TO "anon";
GRANT ALL ON FUNCTION "testing"."broadcast_tag_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "testing"."broadcast_tag_changes"() TO "service_role";


















GRANT ALL ON TABLE "public"."cell" TO "anon";
GRANT ALL ON TABLE "public"."cell" TO "authenticated";
GRANT ALL ON TABLE "public"."cell" TO "service_role";


GRANT ALL ON TABLE "testing"."tags" TO "anon";
GRANT ALL ON TABLE "testing"."tags" TO "authenticated";
GRANT ALL ON TABLE "testing"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."column" TO "anon";
GRANT ALL ON TABLE "public"."column" TO "authenticated";
GRANT ALL ON TABLE "public"."column" TO "service_role";



GRANT ALL ON TABLE "public"."column_dependency" TO "anon";
GRANT ALL ON TABLE "public"."column_dependency" TO "authenticated";
GRANT ALL ON TABLE "public"."column_dependency" TO "service_role";



GRANT ALL ON TABLE "public"."column_secret_binding" TO "anon";
GRANT ALL ON TABLE "public"."column_secret_binding" TO "authenticated";
GRANT ALL ON TABLE "public"."column_secret_binding" TO "service_role";



GRANT ALL ON TABLE "public"."event" TO "anon";
GRANT ALL ON TABLE "public"."event" TO "authenticated";
GRANT ALL ON TABLE "public"."event" TO "service_role";



GRANT ALL ON TABLE "public"."pipe" TO "anon";
GRANT ALL ON TABLE "public"."pipe" TO "authenticated";
GRANT ALL ON TABLE "public"."pipe" TO "service_role";



GRANT ALL ON TABLE "public"."key" TO "anon";
GRANT ALL ON TABLE "public"."key" TO "authenticated";
GRANT ALL ON TABLE "public"."key" TO "service_role";



GRANT ALL ON TABLE "public"."profile" TO "anon";
GRANT ALL ON TABLE "public"."profile" TO "authenticated";
GRANT ALL ON TABLE "public"."profile" TO "service_role";



GRANT ALL ON TABLE "public"."program" TO "anon";
GRANT ALL ON TABLE "public"."program" TO "authenticated";
GRANT ALL ON TABLE "public"."program" TO "service_role";



GRANT ALL ON TABLE "public"."program_file" TO "anon";
GRANT ALL ON TABLE "public"."program_file" TO "authenticated";
GRANT ALL ON TABLE "public"."program_file" TO "service_role";



GRANT ALL ON TABLE "public"."program_run" TO "anon";
GRANT ALL ON TABLE "public"."program_run" TO "authenticated";
GRANT ALL ON TABLE "public"."program_run" TO "service_role";



GRANT ALL ON TABLE "public"."program_secret_binding" TO "anon";
GRANT ALL ON TABLE "public"."program_secret_binding" TO "authenticated";
GRANT ALL ON TABLE "public"."program_secret_binding" TO "service_role";



GRANT ALL ON TABLE "public"."program_version" TO "anon";
GRANT ALL ON TABLE "public"."program_version" TO "authenticated";
GRANT ALL ON TABLE "public"."program_version" TO "service_role";



GRANT ALL ON TABLE "public"."project" TO "anon";
GRANT ALL ON TABLE "public"."project" TO "authenticated";
GRANT ALL ON TABLE "public"."project" TO "service_role";



GRANT ALL ON TABLE "public"."source" TO "anon";
GRANT ALL ON TABLE "public"."source" TO "authenticated";
GRANT ALL ON TABLE "public"."source" TO "service_role";



GRANT ALL ON TABLE "public"."source_event" TO "anon";
GRANT ALL ON TABLE "public"."source_event" TO "authenticated";
GRANT ALL ON TABLE "public"."source_event" TO "service_role";



GRANT ALL ON TABLE "public"."row" TO "anon";
GRANT ALL ON TABLE "public"."row" TO "authenticated";
GRANT ALL ON TABLE "public"."row" TO "service_role";



GRANT ALL ON TABLE "public"."table" TO "anon";
GRANT ALL ON TABLE "public"."table" TO "authenticated";
GRANT ALL ON TABLE "public"."table" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();

SELECT pg_catalog.set_config('search_path', 'public', false);
