CREATE TABLE
  "program_secret_binding" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES "program" (id) ON DELETE CASCADE,
    env_name TEXT NOT NULL CHECK (env_name~'^[A-Za-z_][A-Za-z0-9_]*$'),
    secret_id UUID NOT NULL REFERENCES "secret" (id) ON DELETE CASCADE,
    UNIQUE (owner_user_id, program_id, env_name)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "program_secret_binding" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "program_secret_binding" ENABLE ROW LEVEL SECURITY;

CREATE TABLE
  "column_secret_binding" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    column_id UUID NOT NULL REFERENCES "column" (id) ON DELETE CASCADE,
    env_name TEXT NOT NULL CHECK (env_name~'^[A-Za-z_][A-Za-z0-9_]*$'),
    secret_id UUID NOT NULL REFERENCES "secret" (id) ON DELETE CASCADE,
    UNIQUE (column_id, env_name)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "column_secret_binding" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "column_secret_binding" ENABLE ROW LEVEL SECURITY;

CREATE
OR REPLACE FUNCTION public.secret_store_resolve_selected (
  p_owner_user_id UUID,
  p_secret_ids UUID[]
) RETURNS TABLE (
  id UUID,
  category public.secret_category,
  NAME TEXT,
  VALUE TEXT
) LANGUAGE SQL SECURITY DEFINER
SET
  search_path TO '' AS $function$
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
$function$;

CREATE INDEX program_secret_binding_owner_program_idx ON "program_secret_binding" (owner_user_id, program_id);

CREATE INDEX column_secret_binding_column_idx ON "column_secret_binding" (column_id);

CREATE POLICY "Users can manage their own program secret bindings" ON public.program_secret_binding FOR ALL
  USING (program_secret_binding.owner_user_id=auth.uid ())
  WITH CHECK (program_secret_binding.owner_user_id=auth.uid ());

CREATE POLICY "Users can manage their own column secret bindings" ON public.column_secret_binding FOR ALL
  USING (
    EXISTS (
      SELECT
        1
      FROM
        public."column"
        JOIN public."table" ON "table".id="column".table_id
        JOIN public.project ON project.id="table".project_id
        JOIN public.profile ON profile.id=project.owner_profile_id
      WHERE
        "column".id=column_secret_binding.column_id
        AND profile.owner_user_id=auth.uid ()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT
        1
      FROM
        public."column"
        JOIN public."table" ON "table".id="column".table_id
        JOIN public.project ON project.id="table".project_id
        JOIN public.profile ON profile.id=project.owner_profile_id
      WHERE
        "column".id=column_secret_binding.column_id
        AND profile.owner_user_id=auth.uid ()
    )
  );

REVOKE ALL ON FUNCTION public.secret_store_resolve_selected (UUID, UUID[])
FROM
  PUBLIC,
  anon,
  authenticated;

GRANT
EXECUTE ON FUNCTION public.secret_store_resolve_selected (UUID, UUID[]) TO service_role;
