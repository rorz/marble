CREATE TYPE secret_category AS ENUM('UserDefined', 'Managed');

CREATE TABLE
  "secret" (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    owner_user_id UUID NOT NULL REFERENCES auth.users (id),
    NAME TEXT NOT NULL CHECK (NAME ~ '^[A-Za-z_][A-Za-z0-9_]*$'),
    value TEXT NOT NULL CHECK (char_length(btrim(value)) > 0),
    category secret_category NOT NULL DEFAULT 'UserDefined',
    UNIQUE (owner_user_id, category, NAME)
  );

CREATE TRIGGER set_updated_at BEFORE
UPDATE ON "secret" FOR EACH ROW
EXECUTE FUNCTION set_updated_at ();

ALTER TABLE "secret" ENABLE ROW LEVEL SECURITY;

CREATE INDEX secret_owner_user_name_idx ON "secret" (owner_user_id, NAME);

CREATE POLICY "Users can view their own secrets" ON public.secret FOR SELECT USING (
  secret.owner_user_id = auth.uid()
);
