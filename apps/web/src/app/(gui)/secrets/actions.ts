"use server";

import { requireUser } from "../../../lib/auth";
import { listSecretsForUser } from "../../../lib/secret-data";

export async function listSecrets() {
  const user = await requireUser();
  return listSecretsForUser(user.id);
}

export type SecretRecord = Awaited<ReturnType<typeof listSecrets>>[number];
