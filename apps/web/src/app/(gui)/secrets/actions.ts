"use server";

import { requireUser } from "../../../lib/auth";
import { listSecretsForUser } from "../../../lib/secret-data";

export const listSecrets = async () => {
  const user = await requireUser();
  return listSecretsForUser(user.id);
};

export type SecretRecord = Awaited<ReturnType<typeof listSecrets>>[number];
