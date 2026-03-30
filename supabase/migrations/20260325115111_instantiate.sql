-- Enums

CREATE TYPE column_program_runtime AS ENUM (
  'JavaScript',
  'Python'
);

CREATE TYPE column_program_external_instance_type AS ENUM (
  'Lite',
  'Basic',
  'Standard1',
  'Standard2',
  'Standard3',
  'Standard4'
);

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
  author_user_id uuid REFERENCES auth.users(id)
);

CREATE TABLE column_program (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id),
  first_party boolean NOT NULL DEFAULT false,
  runtime column_program_runtime NOT NULL,
  external_instance_type column_program_external_instance_type NOT NULL,
  code text NOT NULL,
  input_schema jsonb NOT NULL,
  output_schema jsonb NOT NULL
);

CREATE TABLE "column" (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id),
  table_id uuid REFERENCES "table"(id),
  "index" bigint NOT NULL UNIQUE,
  program_id uuid NOT NULL REFERENCES column_program(id),
  input jsonb NOT NULL
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
  table_id uuid REFERENCES "table"(id),
  "index" bigint NOT NULL UNIQUE
);

CREATE TABLE cell (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id),
  column_id uuid REFERENCES "column"(id),
  row_id uuid REFERENCES "row"(id),
  value jsonb
);

CREATE TABLE column_program_run (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  column_program_id uuid REFERENCES column_program(id),
  target_cell_id uuid REFERENCES cell(id),
  instigating_user_id uuid REFERENCES auth.users(id),
  input jsonb,
  output jsonb
);

-- Triggers: keep updated_at in sync

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "table"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON column_program
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "column"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON column_dependency
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON "row"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cell
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON column_program_run
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
