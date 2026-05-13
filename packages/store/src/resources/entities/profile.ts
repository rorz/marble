import type { ResourceDeps } from "../../db";
import type { Entity, UpdateParams } from "../../types";
import { listOwnedProfileIds } from "../list-owned-profile-ids";
import { requireServiceSupabase, requireUserId } from "../require-deps";

export type Profile = Entity<"profile">;

type UpdateProfileInput = Partial<
  Pick<UpdateParams<"profile">, "externalName" | "icon" | "name">
>;

export type GetProfileInput = Pick<Profile, "id">;

export type UpdateProfileParams = Pick<Profile, "id"> & {
  values: UpdateProfileInput;
};

export class ProfileCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly get = ({ id }: GetProfileInput) =>
    this.deps.db.get("profile", id, {
      ownerUserId: requireUserId(this.deps, "Profile"),
    });

  public readonly list = (input: Partial<Pick<Profile, "type">> = {}) =>
    this.deps.db.list(
      "profile",
      {
        ownerUserId: requireUserId(this.deps, "Profile"),
        type: input.type,
      },
      {
        orderBy: [
          {
            ascending: false,
            column: "createdAt",
          },
        ],
      },
    );

  public readonly listIdsAsc = () => listOwnedProfileIds(this.deps, "Profile");

  public readonly update = async ({ id, values }: UpdateProfileParams) => {
    const { error } = await requireServiceSupabase(this.deps, "Profile")
      .from("profile")
      .update({
        external_name: values.externalName,
        icon: values.icon,
        name: values.name,
      })
      .eq("id", id)
      .eq("owner_user_id", requireUserId(this.deps, "Profile"));

    if (error) {
      throw new Error(error.message);
    }

    return this.get({
      id,
    });
  };
}
