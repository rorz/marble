--
-- ENUMS
--
CREATE TYPE data_operation AS ENUM('Create', 'Read', 'Update', 'Delete');

CREATE TYPE profile_type AS ENUM('Human', 'Agent');

CREATE TYPE program_file_type AS ENUM('TypeScript', 'Json', 'Markdown');

CREATE TYPE event_source AS ENUM('WEB_APP', 'RAW_API', 'CLI');

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

CREATE POLICY "Users can view their own profiles" ON public.profile FOR SELECT USING (
  profile.owner_user_id = auth.uid()
);

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
    actor_profile_id UUID NOT NULL REFERENCES "profile" (id),
    actor_key_id UUID REFERENCES "key" (id),
    before_state JSONB,
    after_state JSONB,
    diff JSONB NOT NULL DEFAULT '[]'::jsonb,
    request_id TEXT,
    source event_source NOT NULL DEFAULT 'RAW_API'
  );

ALTER TABLE "event" ENABLE ROW LEVEL SECURITY;

CREATE INDEX event_actor_profile_created_at_idx ON "event" (actor_profile_id, created_at DESC);

CREATE INDEX event_entity_created_at_idx ON "event" (resource, entity_id, created_at DESC);

CREATE INDEX event_request_id_idx ON "event" (request_id);

CREATE INDEX event_source_created_at_idx ON "event" (source, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.table;
ALTER PUBLICATION supabase_realtime ADD TABLE public.row;
ALTER PUBLICATION supabase_realtime ADD TABLE public.column;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cell;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event;

CREATE POLICY "Users can view tables they own" ON public."table" FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.profile
    WHERE profile.id = "table".owner_profile_id
      AND profile.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view rows in their own tables" ON public."row" FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public."table"
    JOIN public.profile ON profile.id = "table".owner_profile_id
    WHERE "table".id = "row".table_id
      AND profile.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view columns in their own tables" ON public."column" FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public."table"
    JOIN public.profile ON profile.id = "table".owner_profile_id
    WHERE "table".id = "column".table_id
      AND profile.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view cells in their own tables" ON public.cell FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public."row"
    JOIN public."table" ON "table".id = "row".table_id
    JOIN public.profile ON profile.id = "table".owner_profile_id
    WHERE "row".id = cell.row_id
      AND profile.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own events" ON public.event FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.profile
    WHERE profile.id = event.actor_profile_id
      AND profile.owner_user_id = auth.uid()
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
