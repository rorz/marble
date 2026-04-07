-- Enums

CREATE TYPE program_runtime AS ENUM (
  'JavaScript',
  'Python'
);

-- CREATE TYPE cell_status AS ENUM (
--   'PENDING',
--   'ERRORED',
--   'SUCCEEDED'
-- )

-- CREATE TYPE program_external_instance_type AS ENUM (
--   'Lite',
--   'Basic',
--   'Standard1',
--   'Standard2',
--   'Standard3',
--   'Standard4'
-- );

-- Utility: auto-update updated_at on row modification

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tables (ordered by foreign-key dependencies)

CREATE TABLE "table" (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id),
  name text NOT NULL DEFAULT 'Untitled Table'
);

CREATE TABLE program (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  first_party boolean NOT NULL DEFAULT false,
  runtime program_runtime NOT NULL,
  -- external_instance_type program_external_instance_type NOT NULL,
  code text NOT NULL,
  input_schema jsonb NOT NULL,
  output_config jsonb NOT NULL
);

CREATE TABLE "column" (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id),
  table_id uuid NOT NULL REFERENCES "table"(id),
  name text NOT NULL,
  "index" bigint NOT NULL,
  program_id uuid NOT NULL REFERENCES program(id),
  input_template text NOT NULL,
  output_schema jsonb NOT NULL,
  UNIQUE (table_id, "index")
);

CREATE TABLE column_dependency (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_column_id uuid NOT NULL REFERENCES "column"(id),
  target_column_id uuid NOT NULL REFERENCES "column"(id)
);

CREATE TABLE "row" (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id),
  table_id uuid NOT NULL REFERENCES "table"(id),
  "index" bigint NOT NULL,
  UNIQUE (table_id, "index")
);

CREATE TABLE cell (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id),
  column_id uuid NOT NULL REFERENCES "column"(id),
  row_id uuid NOT NULL REFERENCES "row"(id),
  -- status NOT NULL cell_status,
  manual_input text,
  state jsonb
);

CREATE TABLE program_run (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  program_id uuid NOT NULL REFERENCES program(id),
  target_cell_id uuid NOT NULL REFERENCES cell(id),
  instigating_user_id uuid NOT NULL REFERENCES auth.users(id),
  input jsonb,
  output jsonb
);

-- Triggers: keep updated_at in sync

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "table"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON program
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "column"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON column_dependency
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "row"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cell
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON program_run
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS

ALTER TABLE "table" ENABLE ROW LEVEL SECURITY;
ALTER TABLE program ENABLE ROW LEVEL SECURITY;
ALTER TABLE "column" ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_dependency ENABLE ROW LEVEL SECURITY;
ALTER TABLE "row" ENABLE ROW LEVEL SECURITY;
ALTER TABLE cell ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_run ENABLE ROW LEVEL SECURITY;
