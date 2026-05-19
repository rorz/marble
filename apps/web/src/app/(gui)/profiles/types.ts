import type { MarbleClient } from "@marble/sdk";

export type ProfileRecord = Awaited<
  ReturnType<MarbleClient["profiles"]["list"]>
>[number];

export type ProfileKeyRecord = Awaited<
  ReturnType<MarbleClient["keys"]["list"]>
>[number];

export type ManagedProfileRecord = ProfileRecord & {
  keys: ProfileKeyRecord[];
};
