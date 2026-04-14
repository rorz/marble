ALTER TABLE public.secret
ADD COLUMN vault_secret_id UUID;

UPDATE public.secret
SET vault_secret_id = vault.create_secret(value)
WHERE vault_secret_id IS NULL;

ALTER TABLE public.secret
ALTER COLUMN vault_secret_id SET NOT NULL;

ALTER TABLE public.secret
ADD CONSTRAINT secret_vault_secret_id_key UNIQUE (vault_secret_id);

ALTER TABLE public.secret
ADD CONSTRAINT secret_vault_secret_id_fkey FOREIGN KEY (vault_secret_id) REFERENCES vault.secrets (id) ON DELETE CASCADE;

ALTER TABLE public.secret
DROP COLUMN value;

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

REVOKE ALL ON FUNCTION public.secret_store_create(UUID, TEXT, public.secret_category, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.secret_store_update(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.secret_store_delete(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.secret_store_resolve(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.secret_store_create(UUID, TEXT, public.secret_category, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.secret_store_update(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.secret_store_delete(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.secret_store_resolve(UUID) TO service_role;
