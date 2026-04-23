"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "../../../lib/auth";
import { callMarbleApi } from "../../../lib/marble-api";
import { listSecretsForUser } from "../../../lib/secret-data";

type SecretMutationInput = {
  name?: string;
  value?: string;
};

export async function listSecrets() {
  const user = await requireUser();
  return listSecretsForUser(user.id);
}

export async function createSecret(input: { name: string; value: string }) {
  const secret = await callMarbleApi<
    Awaited<ReturnType<typeof listSecrets>>[number]
  >("/secrets", {
    body: {
      category: "UserDefined",
      name: input.name,
      value: input.value,
    },
    method: "POST",
    requestId: crypto.randomUUID(),
  });

  revalidatePath("/secrets");
  return secret;
}

export async function updateSecret(
  secretId: string,
  input: SecretMutationInput,
) {
  const body = {
    ...(input.name === undefined
      ? {}
      : {
          name: input.name,
        }),
    ...(input.value === undefined
      ? {}
      : {
          value: input.value,
        }),
  };

  if (Object.keys(body).length === 0) {
    throw new Error("Secret updates require a name change or a new value.");
  }

  const secret = await callMarbleApi<
    Awaited<ReturnType<typeof listSecrets>>[number]
  >(`/secrets/${secretId}`, {
    body,
    method: "PATCH",
    requestId: crypto.randomUUID(),
  });

  revalidatePath("/secrets");
  return secret;
}

export async function deleteSecret(secretId: string) {
  await callMarbleApi(`/secrets/${secretId}`, {
    method: "DELETE",
    requestId: crypto.randomUUID(),
  });

  revalidatePath("/secrets");
}
