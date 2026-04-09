-- Enums
-- CREATE TYPE cell_status AS ENUM (
--   'PENDING',
--   'ERRORED',
--   'SUCCEEDED'
-- )
-- create type 
-- Utility: auto-update updated_at on row modification
CREATE
OR REPLACE FUNCTION set_updated_at () RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tables (ordered by foreign-key dependencies)
CREATE TABLE
  "table" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    author_user_id UUID REFERENCES auth.users (id),
    NAME TEXT NOT NULL DEFAULT 'Untitled Table'
  );

CREATE TABLE
  PROGRAM (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    author_user_id UUID REFERENCES auth.users (id),
    NAME TEXT NOT NULL,
    first_party BOOLEAN NOT NULL DEFAULT FALSE,
    -- external_instance_type program_external_instance_type NOT NULL,
    code TEXT NOT NULL,
    input_schema jsonb NOT NULL,
    output_config jsonb NOT NULL
  );

CREATE TABLE
  "column" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    author_user_id UUID REFERENCES auth.users (id),
    table_id UUID NOT NULL REFERENCES "table" (id),
    NAME TEXT NOT NULL,
    "index" BIGINT NOT NULL,
    program_id UUID NOT NULL REFERENCES PROGRAM (id),
    input_template TEXT NOT NULL,
    output_schema jsonb NOT NULL,
    UNIQUE (table_id, "index")
  );

CREATE TABLE
  column_dependency (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    source_column_id UUID NOT NULL REFERENCES "column" (id),
    target_column_id UUID NOT NULL REFERENCES "column" (id)
  );

CREATE TABLE
  "row" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    author_user_id UUID REFERENCES auth.users (id),
    table_id UUID NOT NULL REFERENCES "table" (id),
    "index" BIGINT NOT NULL,
    UNIQUE (table_id, "index")
  );

CREATE TABLE
  cell (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    author_user_id UUID REFERENCES auth.users (id),
    column_id UUID NOT NULL REFERENCES "column" (id),
    row_id UUID NOT NULL REFERENCES "row" (id),
    -- status NOT NULL cell_status,
    manual_input TEXT,
    state jsonb
  );

CREATE TABLE
  program_run (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    program_id UUID NOT NULL REFERENCES PROGRAM (id),
    target_cell_id UUID NOT NULL REFERENCES cell (id),
    instigating_user_id UUID NOT NULL REFERENCES auth.users (id),
    INPUT jsonb,
    output jsonb
  );

-- Triggers: keep updated_at in sync
CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "table" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON PROGRAM FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "column" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON column_dependency FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "row" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON cell FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON program_run FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

-- RLS
ALTER TABLE "table" ENABLE ROW LEVEL SECURITY;

ALTER TABLE PROGRAM ENABLE ROW LEVEL SECURITY;

ALTER TABLE "column" ENABLE ROW LEVEL SECURITY;

ALTER TABLE column_dependency ENABLE ROW LEVEL SECURITY;

ALTER TABLE "row" ENABLE ROW LEVEL SECURITY;

ALTER TABLE cell ENABLE ROW LEVEL SECURITY;

ALTER TABLE program_run ENABLE ROW LEVEL SECURITY;