--
-- ENUMS
--
CREATE TYPE data_operation AS ENUM('Create', 'Read', 'Update', 'Delete');

CREATE TYPE profile_type AS ENUM('Human', 'Agent');

CREATE TYPE program_file_type AS ENUM('TypeScript', 'Json', 'Markdown');

CREATE TYPE event_source AS ENUM('WEB_APP', 'RAW_API', 'CLI');

CREATE TYPE secret_category AS ENUM('UserDefined', 'Managed');

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
CREATE TABLE
  "profile" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "type" profile_type NOT NULL,
    NAME TEXT NOT NULL,
    external_name TEXT,
    owner_user_id UUID REFERENCES auth.users (id) NOT NULL
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "profile" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "profile" ENABLE ROW LEVEL SECURITY;

CREATE TABLE
  "project" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_profile_id UUID REFERENCES profile (id) NOT NULL,
    NAME TEXT NOT NULL DEFAULT 'Untitled Project',
    folder_path TEXT[] NOT NULL DEFAULT '{}'::TEXT[]
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "project" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;

CREATE TABLE
  "table" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    NAME TEXT NOT NULL DEFAULT 'Untitled Table',
    project_id UUID REFERENCES "project" (id) NOT NULL
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "table" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "table" ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE
  "program_file" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_profile_id UUID REFERENCES profile (id) NOT NULL,
    filename TEXT NOT NULL,
    filetype program_file_type NOT NULL,
    CONTENT CHARACTER VARYING(1000000) NOT NULL,
    version_id UUID REFERENCES program_version (id) NOT NULL
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "program_file" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "program_file" ENABLE ROW LEVEL SECURITY;

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

CREATE TABLE
  "secret" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_user_id UUID NOT NULL REFERENCES auth.users (id),
    NAME TEXT NOT NULL CHECK (NAME ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
    category secret_category NOT NULL DEFAULT 'UserDefined',
    vault_secret_id UUID NOT NULL UNIQUE REFERENCES vault.secrets (id) ON DELETE CASCADE,
    UNIQUE (owner_user_id, category, NAME)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "secret" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "secret" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.secret_store_create(
  p_owner_user_id UUID,
  p_name TEXT,
  p_category public.secret_category,
  p_plaintext_value TEXT
) RETURNS public.secret
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.secret_store_update(
  p_secret_id UUID,
  p_name TEXT DEFAULT NULL,
  p_plaintext_value TEXT DEFAULT NULL
) RETURNS public.secret
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.secret_store_delete(
  p_secret_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.secret_store_resolve(
  p_owner_user_id UUID
) RETURNS TABLE (
  category public.secret_category,
  name TEXT,
  value TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    secret.category,
    secret.name,
    decrypted_secret.decrypted_secret AS value
  FROM public.secret
  JOIN vault.decrypted_secrets AS decrypted_secret
    ON decrypted_secret.id = secret.vault_secret_id
  WHERE secret.owner_user_id = p_owner_user_id
  ORDER BY secret.name ASC, secret.category ASC
$function$;

--
-- INDEXES
--
CREATE INDEX event_actor_profile_created_at_idx ON "event" (actor_profile_id, created_at DESC);

CREATE INDEX event_entity_created_at_idx ON "event" (resource, entity_id, created_at DESC);

CREATE INDEX event_request_id_idx ON "event" (request_id);

CREATE INDEX event_source_created_at_idx ON "event" (source, created_at DESC);

CREATE INDEX project_owner_profile_created_at_idx ON "project" (owner_profile_id, created_at DESC);

CREATE INDEX secret_owner_user_name_idx ON "secret" (owner_user_id, NAME);

CREATE INDEX table_project_created_at_idx ON "table" (project_id, created_at DESC);

--
-- REALTIME
--
ALTER PUBLICATION supabase_realtime ADD TABLE public.project;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profile;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table;
ALTER PUBLICATION supabase_realtime ADD TABLE public.row;
ALTER PUBLICATION supabase_realtime ADD TABLE public.column;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cell;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event;

--
-- POLICIES
--
CREATE POLICY "Users can view their own profiles" ON public.profile FOR SELECT USING (
  profile.owner_user_id = auth.uid()
);

CREATE POLICY "Users can view their own projects" ON public."project" FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.profile
    WHERE profile.id = "project".owner_profile_id
      AND profile.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view tables in their own projects" ON public."table" FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public."project"
    JOIN public.profile ON profile.id = "project".owner_profile_id
    WHERE "project".id = "table".project_id
      AND profile.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view rows in their own tables" ON public."row" FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public."table"
    JOIN public."project" ON "project".id = "table".project_id
    JOIN public.profile ON profile.id = "project".owner_profile_id
    WHERE "table".id = "row".table_id
      AND profile.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view columns in their own tables" ON public."column" FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public."table"
    JOIN public."project" ON "project".id = "table".project_id
    JOIN public.profile ON profile.id = "project".owner_profile_id
    WHERE "table".id = "column".table_id
      AND profile.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view cells in their own tables" ON public.cell FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public."row"
    JOIN public."table" ON "table".id = "row".table_id
    JOIN public."project" ON "project".id = "table".project_id
    JOIN public.profile ON profile.id = "project".owner_profile_id
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

CREATE POLICY "Users can view their own secrets" ON public.secret FOR SELECT USING (
  secret.owner_user_id = auth.uid()
);

REVOKE ALL ON FUNCTION public.secret_store_create(UUID, TEXT, public.secret_category, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.secret_store_update(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.secret_store_delete(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.secret_store_resolve(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.secret_store_create(UUID, TEXT, public.secret_category, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.secret_store_update(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.secret_store_delete(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.secret_store_resolve(UUID) TO service_role;

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
