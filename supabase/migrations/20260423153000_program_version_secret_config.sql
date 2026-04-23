ALTER TABLE "program_version"
ADD COLUMN "secret_config" JSONB;

ALTER TABLE "program_version"
ADD CONSTRAINT "program_version_secret_config_is_array"
CHECK (
  "secret_config" IS NULL
  OR jsonb_typeof("secret_config") = 'array'
);
