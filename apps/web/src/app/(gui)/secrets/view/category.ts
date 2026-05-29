import type { SecretRecord } from "../actions";

type SecretCategory = SecretRecord["category"];

type SecretCategoryCopy = {
  detailDescription: string | null;
  rowDescription: string;
};

const secretCategoryCopyByCategory = {
  Managed: {
    detailDescription:
      "Marble created this secret for system use. Its value is still hidden, and replacing it here overwrites the stored value.",
    rowDescription: "Marble-managed secret",
  },
  UserDefined: {
    detailDescription: null,
    rowDescription: "Custom secret",
  },
} satisfies Record<SecretCategory, SecretCategoryCopy>;

export const getSecretCategoryCopy = (category: SecretCategory) => {
  return secretCategoryCopyByCategory[category];
};
