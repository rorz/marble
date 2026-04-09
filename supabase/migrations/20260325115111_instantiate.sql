--
-- ENUMS
--
CREATE TYPE data_operation AS ENUM('Create', 'Read', 'Update', 'Delete');

CREATE TYPE profile_type AS ENUM('Human', 'Agent');

CREATE TYPE program_file_type AS ENUM('TypeScript', 'Json', 'Markdown');

--
-- FUNCTIONS
--
CREATE
OR REPLACE FUNCTION set_updated_at () RETURNS TRIGGER LANGUAGE plpgsql AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

--
-- T A B L E S
--
-- Profile table
CREATE TABLE
  "profile" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "type" profile_type NOT NULL,
    NAME TEXT NOT NULL, -- e.g. "My Claude Agent"
    external_name TEXT, -- e.g. ClaudeCode
    owner_user_id UUID REFERENCES auth.users (id) NOT NULL
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "profile" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;

-- Table table
CREATE TABLE
  "table" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_profile_id UUID REFERENCES profile (id) NOT NULL,
    NAME TEXT NOT NULL DEFAULT 'Untitled Table'
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "table" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "table" ENABLE ROW LEVEL SECURITY;

-- Program
CREATE TABLE
  "program" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_profile_id UUID REFERENCES profile (id) NOT NULL,
    "name" TEXT NOT NULL,
    first_party BOOLEAN NOT NULL DEFAULT FALSE,
    forked_from_version_id UUID REFERENCES program_version (id) -- only set when forked
  );

CREATE TABLE
  "program_version" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    program_id UUID REFERENCES PROGRAM (id) NOT NULL,
    "version" INT NOT NULL,
    input_schema JSONB NOT NULL,
    output_config JSONB NOT NULL
  );

CREATE TABLE
  "program_file" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_profile_id UUID REFERENCES profile (id) NOT NULL,
    filename TEXT NOT NULL, -- with extension, e.g. "main.ts"
    filetype program_file_type NOT NULL,
    CONTENT CHARACTER VARYING(1000000) NOT NULL, -- 1M characters
    version_id UUID REFERENCES PROGRAM (id) NOT NULL
  );

CREATE TABLE
  "column" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    table_id UUID NOT NULL REFERENCES "table" (id),
    NAME TEXT NOT NULL,
    INDEX BIGINT NOT NULL,
    program_version_id UUID NOT NULL REFERENCES program_version (id),
    input_template TEXT NOT NULL,
    output_schema JSONB NOT NULL,
    UNIQUE (table_id, INDEX)
  );

CREATE TABLE
  "column_dependency" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    source_column_id UUID NOT NULL REFERENCES "column" (id),
    target_column_id UUID NOT NULL REFERENCES "column" (id)
  );

CREATE TABLE
  "row" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    table_id UUID NOT NULL REFERENCES "table" (id),
    INDEX BIGINT NOT NULL,
    UNIQUE (table_id, INDEX)
  );

CREATE TABLE
  "cell" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    column_id UUID NOT NULL REFERENCES "column" (id),
    row_id UUID NOT NULL REFERENCES ROW (id),
    manual_input TEXT,
    state JSONB
  );

CREATE TABLE
  "program_run" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    program_version_id UUID NOT NULL REFERENCES program_version (id),
    target_cell_id UUID NOT NULL REFERENCES cell (id),
    INPUT JSONB,
    output JSONB
  );

CREATE TABLE
  "key" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "hash" CHARACTER(22) NOT NULL,
    prefix CHARACTER(6) NOT NULL,
    owner_profile_id UUID NOT NULL REFERENCES "profile" (id)
  );

CREATE TABLE
  "event" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resource TEXT NOT NULL CHECK (resource IN ('Row', 'Column', 'Table', 'Program')), -- Not enum-ing this because breadth of resources is reasonably likely to change
    entity_id UUID NOT NULL,
    operation data_operation NOT NULL,
    owner_profile_id UUID NOT NULL REFERENCES "profile" (id)
  );