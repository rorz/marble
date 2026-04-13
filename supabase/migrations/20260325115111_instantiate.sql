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

-- Program table
CREATE TABLE
  "program" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_profile_id UUID REFERENCES profile (id) NOT NULL,
    "name" TEXT NOT NULL,
    first_party BOOLEAN NOT NULL DEFAULT FALSE,
    forked_from_version_id UUID
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "program" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "program" ENABLE ROW LEVEL SECURITY;

-- Program Version table
CREATE TABLE
  "program_version" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    program_id UUID REFERENCES PROGRAM (id) NOT NULL,
    "version" INT NOT NULL,
    input_schema JSONB NOT NULL,
    output_config JSONB NOT NULL,
    UNIQUE (program_id, VERSION)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "program_version" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "program_version" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "program"
ADD CONSTRAINT fk_program_forked_from FOREIGN KEY (forked_from_version_id) REFERENCES "program_version" (id);

-- Program File table
CREATE TABLE
  "program_file" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_profile_id UUID REFERENCES profile (id) NOT NULL,
    filename TEXT NOT NULL, -- with extension, e.g. "main.ts"
    filetype program_file_type NOT NULL,
    CONTENT CHARACTER VARYING(1000000) NOT NULL, -- 1M characters
    version_id UUID REFERENCES program_version (id) NOT NULL
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "program_file" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "program_file" ENABLE ROW LEVEL SECURITY;

-- Column table
CREATE TABLE
  "column" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    table_id UUID NOT NULL REFERENCES "table" (id),
    NAME TEXT NOT NULL,
    idx BIGINT NOT NULL,
    program_version_id UUID NOT NULL REFERENCES program_version (id),
    input_template TEXT NOT NULL,
    output_schema JSONB NOT NULL,
    UNIQUE (table_id, idx)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "column" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "column" ENABLE ROW LEVEL SECURITY;

-- Column Dependency table
CREATE TABLE
  "column_dependency" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    source_column_id UUID NOT NULL REFERENCES "column" (id),
    target_column_id UUID NOT NULL REFERENCES "column" (id)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "column_dependency" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "column_dependency" ENABLE ROW LEVEL SECURITY;

-- Row table
CREATE TABLE
  "row" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    table_id UUID NOT NULL REFERENCES "table" (id),
    idx BIGINT NOT NULL,
    UNIQUE (table_id, idx)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "row" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "row" ENABLE ROW LEVEL SECURITY;

-- Cell table
CREATE TABLE
  "cell" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    column_id UUID NOT NULL REFERENCES "column" (id),
    row_id UUID NOT NULL REFERENCES ROW (id),
    manual_input TEXT,
    state JSONB,
    UNIQUE (row_id, column_id)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "cell" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "cell" ENABLE ROW LEVEL SECURITY;

-- Program Run table
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

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "program_run" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "program_run" ENABLE ROW LEVEL SECURITY;

-- Key table
CREATE TABLE
  "key" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    "hash" CHARACTER(22) NOT NULL,
    prefix CHARACTER(6) NOT NULL,
    owner_profile_id UUID NOT NULL REFERENCES "profile" (id)
  );

ALTER TABLE "key" ENABLE ROW LEVEL SECURITY;

-- Event table
CREATE TABLE
  "event" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resource TEXT NOT NULL,
    entity_id UUID NOT NULL,
    operation data_operation NOT NULL,
    actor_profile_id UUID REFERENCES "profile" (id),
    actor_key_id UUID REFERENCES "key" (id),
    before_state JSONB,
    after_state JSONB,
    diff JSONB NOT NULL DEFAULT '[]'::jsonb,
    record_owner_profile_id UUID REFERENCES "profile" (id),
    request_id TEXT,
    source TEXT NOT NULL DEFAULT 'system'
  );

ALTER TABLE "event" ENABLE ROW LEVEL SECURITY;

CREATE INDEX event_actor_profile_created_at_idx ON "event" (actor_profile_id, created_at DESC);

CREATE INDEX event_entity_created_at_idx ON "event" (resource, entity_id, created_at DESC);

CREATE INDEX event_record_owner_profile_created_at_idx ON "event" (record_owner_profile_id, created_at DESC);

CREATE INDEX event_request_id_idx ON "event" (request_id);

CREATE INDEX event_source_created_at_idx ON "event" (source, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_request_headers() 
RETURNS JSONB AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.headers', true), ''),
    '{}'
  )::jsonb;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.audit_request_header(header_name TEXT) 
RETURNS TEXT AS $$
  SELECT public.audit_request_headers() ->> LOWER(header_name);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.try_parse_uuid(raw_value TEXT) 
RETURNS UUID AS $$
BEGIN
  IF raw_value IS NULL OR BTRIM(raw_value) = '' THEN
    RETURN NULL;
  END IF;

  RETURN raw_value::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.current_event_actor_key_id() 
RETURNS UUID AS $$
  SELECT public.try_parse_uuid(
    public.audit_request_header('x-marble-auth-key-id')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.current_event_request_id() 
RETURNS TEXT AS $$
  SELECT NULLIF(public.audit_request_header('x-marble-request-id'), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.current_event_source() 
RETURNS TEXT AS $$
  SELECT COALESCE(
    NULLIF(public.audit_request_header('x-marble-actor-source'), ''),
    'system'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.current_event_actor_profile_id() 
RETURNS UUID AS $$
DECLARE
  actor_profile_id UUID;
BEGIN
  actor_profile_id := public.try_parse_uuid(
    public.audit_request_header('x-marble-auth-profile-id')
  );

  IF actor_profile_id IS NOT NULL THEN
    RETURN actor_profile_id;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT profile.id
  INTO actor_profile_id
  FROM public.profile
  WHERE profile.owner_user_id = auth.uid()
  ORDER BY profile.created_at ASC
  LIMIT 1;

  RETURN actor_profile_id;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.normalize_event_row(
  resource_name TEXT,
  row_state JSONB
) RETURNS JSONB AS $$
DECLARE
  normalized JSONB;
BEGIN
  IF row_state IS NULL THEN
    RETURN NULL;
  END IF;

  normalized := row_state - 'created_at' - 'updated_at';

  IF resource_name = 'key' THEN
    normalized := normalized - 'hash';
  END IF;

  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.jsonb_diff(
  before_state JSONB,
  after_state JSONB,
  path TEXT[] DEFAULT ARRAY[]::TEXT[]
) RETURNS JSONB AS $$
DECLARE
  after_type TEXT := COALESCE(jsonb_typeof(after_state), 'null');
  before_type TEXT := COALESCE(jsonb_typeof(before_state), 'null');
  changes JSONB := '[]'::jsonb;
  key TEXT;
BEGIN
  IF before_state = after_state THEN
    RETURN changes;
  END IF;

  IF (
    before_type IN ('null', 'object')
    AND after_type IN ('null', 'object')
    AND (before_type = 'object' OR after_type = 'object')
  ) THEN
    FOR key IN
      SELECT DISTINCT entry_key
      FROM (
        SELECT jsonb_object_keys(
          CASE
            WHEN before_type = 'object' THEN before_state
            ELSE '{}'::jsonb
          END
        ) AS entry_key
        UNION
        SELECT jsonb_object_keys(
          CASE
            WHEN after_type = 'object' THEN after_state
            ELSE '{}'::jsonb
          END
        ) AS entry_key
      ) AS keys
      ORDER BY entry_key
    LOOP
      changes := changes || public.jsonb_diff(
        CASE
          WHEN before_type = 'object' THEN before_state -> key
          ELSE NULL
        END,
        CASE
          WHEN after_type = 'object' THEN after_state -> key
          ELSE NULL
        END,
        path || key
      );
    END LOOP;

    RETURN changes;
  END IF;

  RETURN jsonb_build_array(
    jsonb_build_object(
      'after', after_state,
      'before', before_state,
      'path', to_jsonb(path)
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.resolve_event_record_owner_profile_id(
  resource_name TEXT,
  before_state JSONB,
  after_state JSONB
) RETURNS UUID AS $$
DECLARE
  profile_id UUID;
  row_state JSONB := COALESCE(after_state, before_state);
BEGIN
  IF row_state IS NULL THEN
    RETURN NULL;
  END IF;

  CASE resource_name
    WHEN 'profile' THEN
      RETURN public.try_parse_uuid(row_state ->> 'id');
    WHEN 'program' THEN
      RETURN public.try_parse_uuid(row_state ->> 'owner_profile_id');
    WHEN 'program_file' THEN
      RETURN public.try_parse_uuid(row_state ->> 'owner_profile_id');
    WHEN 'table' THEN
      RETURN public.try_parse_uuid(row_state ->> 'owner_profile_id');
    WHEN 'key' THEN
      RETURN public.try_parse_uuid(row_state ->> 'owner_profile_id');
    WHEN 'program_version' THEN
      SELECT program.owner_profile_id
      INTO profile_id
      FROM public.program
      WHERE program.id = public.try_parse_uuid(row_state ->> 'program_id');

      RETURN profile_id;
    WHEN 'column' THEN
      SELECT "table".owner_profile_id
      INTO profile_id
      FROM public."table"
      WHERE "table".id = public.try_parse_uuid(row_state ->> 'table_id');

      RETURN profile_id;
    WHEN 'row' THEN
      SELECT "table".owner_profile_id
      INTO profile_id
      FROM public."table"
      WHERE "table".id = public.try_parse_uuid(row_state ->> 'table_id');

      RETURN profile_id;
    WHEN 'cell' THEN
      SELECT "table".owner_profile_id
      INTO profile_id
      FROM public."row"
      JOIN public."table" ON "table".id = "row".table_id
      WHERE "row".id = public.try_parse_uuid(row_state ->> 'row_id');

      RETURN profile_id;
    WHEN 'column_dependency' THEN
      SELECT "table".owner_profile_id
      INTO profile_id
      FROM public."column"
      JOIN public."table" ON "table".id = "column".table_id
      WHERE "column".id = public.try_parse_uuid(
        COALESCE(
          row_state ->> 'target_column_id',
          row_state ->> 'source_column_id'
        )
      );

      RETURN profile_id;
    WHEN 'program_run' THEN
      SELECT "table".owner_profile_id
      INTO profile_id
      FROM public.cell
      JOIN public."row" ON "row".id = cell.row_id
      JOIN public."table" ON "table".id = "row".table_id
      WHERE cell.id = public.try_parse_uuid(row_state ->> 'target_cell_id');

      IF profile_id IS NOT NULL THEN
        RETURN profile_id;
      END IF;

      SELECT program.owner_profile_id
      INTO profile_id
      FROM public.program_version
      JOIN public.program ON program.id = program_version.program_id
      WHERE program_version.id = public.try_parse_uuid(
        row_state ->> 'program_version_id'
      );

      RETURN profile_id;
    ELSE
      IF row_state ? 'owner_profile_id' THEN
        RETURN public.try_parse_uuid(row_state ->> 'owner_profile_id');
      END IF;

      RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.capture_event() 
RETURNS TRIGGER AS $$
DECLARE
  actor_key_id UUID;
  actor_profile_id UUID;
  after_state JSONB;
  before_state JSONB;
  changes JSONB;
  entity_id UUID;
  operation data_operation;
  record_owner_profile_id UUID;
  request_id TEXT;
  source TEXT;
BEGIN
  CASE TG_OP
    WHEN 'INSERT' THEN
      operation := 'Create';
      before_state := NULL;
      after_state := public.normalize_event_row(TG_TABLE_NAME, to_jsonb(NEW));
      entity_id := public.try_parse_uuid(after_state ->> 'id');
    WHEN 'UPDATE' THEN
      operation := 'Update';
      before_state := public.normalize_event_row(TG_TABLE_NAME, to_jsonb(OLD));
      after_state := public.normalize_event_row(TG_TABLE_NAME, to_jsonb(NEW));
      entity_id := public.try_parse_uuid(
        COALESCE(after_state ->> 'id', before_state ->> 'id')
      );
    WHEN 'DELETE' THEN
      operation := 'Delete';
      before_state := public.normalize_event_row(TG_TABLE_NAME, to_jsonb(OLD));
      after_state := NULL;
      entity_id := public.try_parse_uuid(before_state ->> 'id');
    ELSE
      RETURN COALESCE(NEW, OLD);
  END CASE;

  changes := public.jsonb_diff(before_state, after_state);

  IF TG_OP = 'UPDATE' AND jsonb_array_length(changes) = 0 THEN
    RETURN NEW;
  END IF;

  actor_profile_id := public.current_event_actor_profile_id();
  actor_key_id := public.current_event_actor_key_id();
  request_id := public.current_event_request_id();
  source := public.current_event_source();

  IF source IN ('api', 'cli', 'webapp') AND actor_profile_id IS NULL THEN
    RAISE EXCEPTION
      'Missing actor profile id for % %',
      TG_TABLE_NAME,
      TG_OP;
  END IF;

  record_owner_profile_id := public.resolve_event_record_owner_profile_id(
    TG_TABLE_NAME,
    before_state,
    after_state
  );

  INSERT INTO public.event (
    actor_key_id,
    actor_profile_id,
    after_state,
    before_state,
    diff,
    entity_id,
    operation,
    record_owner_profile_id,
    request_id,
    resource,
    source
  )
  VALUES (
    actor_key_id,
    actor_profile_id,
    after_state,
    before_state,
    changes,
    entity_id,
    operation,
    record_owner_profile_id,
    request_id,
    TG_TABLE_NAME,
    source
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "profile" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "table" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "program" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "program_version" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "program_file" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "column" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "column_dependency" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "row" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "cell" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "program_run" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

CREATE TRIGGER capture_event_after_mutation AFTER INSERT OR UPDATE OR DELETE ON "key" FOR EACH ROW
EXECUTE FUNCTION public.capture_event();

ALTER PUBLICATION supabase_realtime ADD TABLE public.event;

CREATE POLICY "Users can view related events" ON public.event FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.profile
    WHERE profile.owner_user_id = auth.uid()
      AND (
        profile.id = event.actor_profile_id
        OR profile.id = event.record_owner_profile_id
      )
  )
);

--
-- TRIGGER ON USER CREATION
--
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profile (owner_user_id, name, type)
  VALUES (new.id, 'Me', 'Human');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
