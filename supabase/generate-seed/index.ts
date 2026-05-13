#!/usr/bin/env bun

/**
 * Reads program fixtures from seed-fixtures/programs/ and operator accounts
 * from .private/accounts.json (optional, gitignored), and writes seed.sql.
 *
 * Each program directory contains:
 *   package.json        -> name
 *   input-schema.json   -> input_schema          (JSON Schema)
 *   output-config.json  -> output_config         (ProgramOutputConfig)
 *   index.ts            -> code
 *
 * Operator accounts file:
 *   { "accounts": [{ "email": "you@example.com", "password": "..." }] }
 *
 * seed.sql is consumed by `supabase db reset` (local) and
 * `supabase db reset --linked` (linked project) per [db.seed] in config.toml.
 *
 * Run: bun run --filter=@marble/supabase gen:seed
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAccountsSql, readAccountsFile } from "./accounts";

type JsonObject = Record<string, unknown>;
type ProgramFileType = "Json" | "Markdown" | "TypeScript";

interface ProgramFile {
  content: string;
  filename: string;
  filetype: ProgramFileType;
}

interface ProgramSeed {
  files: ProgramFile[];
  firstParty: boolean;
  inputSchema: string;
  name: string;
  outputConfig: string;
  slug: string;
}

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(THIS_DIR, "../seed-fixtures/programs");
const ACCOUNTS_FILE = resolve(THIS_DIR, "../.private/accounts.json");
const OUTPUT_FILE = resolve(THIS_DIR, "../seed.sql");

const isErrnoException = (error: unknown): error is NodeJS.ErrnoException => {
  return error instanceof Error && "code" in error;
};

const isJsonObject = (value: unknown): value is JsonObject => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readOptionalJson = (path: string): unknown | null => {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
};

const readJsonObject = (path: string): JsonObject => {
  const value = readOptionalJson(path);
  return isJsonObject(value) ? value : {};
};

const readOptionalText = (path: string): string | null => {
  try {
    return readFileSync(path, "utf-8").trim();
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
};

const readRequiredText = (path: string): string => {
  return readOptionalText(path) ?? "";
};

const sqlEscape = (value: string): string => {
  return value.replaceAll("'", "''");
};

const getFileType = (filename: string): ProgramFileType => {
  if (filename.endsWith(".ts")) {
    return "TypeScript";
  }

  if (filename.endsWith(".json")) {
    return "Json";
  }

  if (filename.endsWith(".md")) {
    return "Markdown";
  }

  return "TypeScript";
};

const getProgramName = (dirName: string, dir: string): string => {
  const packageJson = readOptionalJson(join(dir, "package.json"));

  if (isJsonObject(packageJson) && typeof packageJson.name === "string") {
    return packageJson.name;
  }

  return dirName;
};

const buildProgramSeed = (dirName: string): ProgramSeed => {
  const dir = join(FIXTURES_DIR, dirName);
  const inputSchema = readJsonObject(join(dir, "input-schema.json"));
  const outputConfig = readJsonObject(join(dir, "output-config.json"));

  const files = readdirSync(dir, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      content: readRequiredText(join(dir, entry.name)),
      filename: entry.name,
      filetype: getFileType(entry.name),
    }));

  return {
    files,
    firstParty: true,
    inputSchema: JSON.stringify(inputSchema),
    name: getProgramName(dirName, dir),
    outputConfig: JSON.stringify(outputConfig),
    slug: dirName,
  };
};

const programDirs = readdirSync(FIXTURES_DIR, {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const programs = programDirs.map(buildProgramSeed);
const accounts = readAccountsFile(ACCOUNTS_FILE);
const accountsSql = buildAccountsSql(accounts);

const programInserts = programs
  .map((program) => {
    const slug = program.slug.replaceAll("-", "_");

    const fileInserts = program.files
      .map(
        (file, index) => `
inserted_file_${slug}_${index} AS (
  INSERT INTO public."program_file" (owner_profile_id, version_id, filename, filetype, content)
  SELECT p.id, v.id, '${file.filename}', '${file.filetype}', '${sqlEscape(file.content)}'
  FROM system_profile p, inserted_version_${slug} v
  RETURNING id
)`,
      )
      .join(",");

    return `
-- ${program.name}
inserted_program_${slug} AS (
  INSERT INTO public."program" (owner_profile_id, name, first_party)
  SELECT id, '${sqlEscape(program.name)}', ${program.firstParty} FROM system_profile
  RETURNING id
),
inserted_version_${slug} AS (
  INSERT INTO public."program_version" (program_id, "version", input_schema, output_config, published_at)
  SELECT id, 1, '${sqlEscape(program.inputSchema)}', '${sqlEscape(program.outputConfig)}', NOW() FROM inserted_program_${slug}
  RETURNING id
),${fileInserts}`;
  })
  .join(",\n");

const programVersionCtes = programs
  .map(
    (program) =>
      `program_version_${program.slug.replaceAll("-", "_")} AS (
  SELECT id FROM inserted_version_${program.slug.replaceAll("-", "_")} LIMIT 1
)`,
  )
  .join(",\n\n");

const seed = `-- Auto-generated by generate-seed/index.ts - do not edit by hand.
-- Sources: seed-fixtures/programs/ and .private/accounts.json

-- 1. Create a dummy user in auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) 
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'seed@example.com', 'crypt', NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 2. Operator accounts (from .private/accounts.json; passwords hashed via pgcrypto)
${accountsSql}

WITH

-- Adopt the auto-created Agent profile (minted by the on_auth_user_created
-- trigger) as the system profile that owns the seeded data. Each user has
-- exactly one Agent profile, so we update the trigger's row in place.
system_profile AS (
  UPDATE public."profile"
  SET name = 'System Agent', external_name = 'system', icon = '🤖'
  WHERE owner_user_id = '00000000-0000-0000-0000-000000000000'
    AND type = 'Agent'
  RETURNING id
),

-- Programs (from fixtures)
${programInserts},

${programVersionCtes},

-- Demo project + table

inserted_project AS (
  INSERT INTO public."project" (owner_profile_id, name, folder_path)
  SELECT id, 'Demo Project', '{}'::TEXT[] FROM system_profile
  RETURNING id
),

inserted_table AS (
  INSERT INTO public."table" (project_id, name)
  SELECT id, 'Demo Table' FROM inserted_project
  RETURNING id
),

-- Demo row

inserted_row AS (
  INSERT INTO public."row" (table_id, "idx")
  SELECT id, 0 FROM inserted_table
  RETURNING id
),

-- Demo columns: col 0 = user input, col 1 = uppercase transform

inserted_col1 AS (
  INSERT INTO public."column" (table_id, name, "idx", program_version_id, input_template, output_schema)
  SELECT
    t.id,
    'Input',
    0,
    p.id,
    '{"format": "string"}',
    '{"type":"string","description":"Standard text value"}'
  FROM inserted_table t, program_version_user_input p
  RETURNING id
),

inserted_col2 AS (
  INSERT INTO public."column" (table_id, name, "idx", program_version_id, input_template, output_schema)
  SELECT
    t.id,
    'Uppercased',
    1,
    p.id,
    '{"text_to_format.$": "$.columns.' || c1.id || '.value"}',
    '{"type":"string","description":"The capitalized string"}'
  FROM inserted_table t, program_version_uppercase_string p, inserted_col1 c1
  RETURNING id
),

-- Dependency: col 1 (uppercase) depends on col 0 (user input)

_dep AS (
  INSERT INTO public."column_dependency" (source_column_id, target_column_id)
  SELECT c1.id, c2.id
  FROM inserted_col1 c1, inserted_col2 c2
),

-- Demo cells

_cell1 AS (
  INSERT INTO public."cell" (column_id, row_id, manual_input)
  SELECT c1.id, r.id, 'hello world'
  FROM inserted_col1 c1, inserted_row r
),

_cell2 AS (
  INSERT INTO public."cell" (column_id, row_id)
  SELECT c2.id, r.id
  FROM inserted_col2 c2, inserted_row r
)

SELECT 1;
`;

writeFileSync(OUTPUT_FILE, seed, "utf-8");

console.log(`Generated ${OUTPUT_FILE}`);
console.log(
  `  ${programs.length} programs: ${programs.map((program) => program.slug).join(", ")}`,
);
console.log(
  accounts.length === 0
    ? "  0 accounts (.private/accounts.json missing or empty)"
    : `  ${accounts.length} accounts: ${accounts.map((account) => account.email).join(", ")}`,
);
