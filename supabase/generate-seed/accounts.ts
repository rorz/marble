import { readFileSync } from "node:fs";

export interface Account {
  email: string;
  password: string;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isAccount(value: unknown): value is Account {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Account).email === "string" &&
    typeof (value as Account).password === "string"
  );
}

export function readAccountsFile(path: string): Account[] {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (error) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const parsed = JSON.parse(raw) as {
    accounts?: unknown;
  };
  if (!Array.isArray(parsed.accounts)) {
    throw new Error(
      `${path}: expected { "accounts": [{ "email", "password" }] }.`,
    );
  }

  return parsed.accounts.map((entry, index) => {
    if (!isAccount(entry)) {
      throw new Error(
        `${path}: accounts[${index}] must be { email, password }.`,
      );
    }

    return entry;
  });
}

function buildAccountSql(account: Account): string {
  const email = account.email.replaceAll("'", "''");
  const password = account.password.replaceAll("'", "''");

  return `
  -- ${email}
  new_user_id := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id,
    'authenticated', 'authenticated',
    '${email}',
    extensions.crypt('${password}', extensions.gen_salt('bf', 10)),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    '{}'::jsonb,
    NOW(), NOW(),
    '', '', '', ''
  );
  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    new_user_id::text, new_user_id,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', '${email}',
      'email_verified', true,
      'phone_verified', false
    ),
    'email', NOW(), NOW(), NOW()
  );`;
}

export function buildAccountsSql(accounts: Account[]): string {
  if (accounts.length === 0) {
    return "-- No operator accounts to seed (.private/accounts.json missing or empty).";
  }

  return `DO $$
DECLARE
  new_user_id uuid;
BEGIN${accounts.map(buildAccountSql).join("")}
END $$;`;
}
