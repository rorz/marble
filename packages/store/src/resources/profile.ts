import type { ResourceDeps } from "../db";
import type { Entity, UpdateParams } from "../types";

export type Profile = Entity<"profile">;

type UpdateProfileInput = Partial<
  Pick<UpdateParams<"profile">, "externalName" | "icon" | "name">
>;

export type GetProfileInput = Pick<Profile, "id">;

export type UpdateProfileParams = Pick<Profile, "id"> & {
  values: UpdateProfileInput;
};

function requireUserId(deps: ResourceDeps) {
  if (!deps.context.userId) {
    throw new Error("Profile operations require a user session.");
  }

  return deps.context.userId;
}

function requireServiceSupabase(deps: ResourceDeps) {
  if (!deps.serviceSupabase) {
    throw new Error("Profile mutations require a service Supabase client.");
  }

  return deps.serviceSupabase;
}

export class ProfileCollection {
  public constructor(private readonly deps: ResourceDeps) {}

  public readonly get = ({ id }: GetProfileInput) =>
    this.deps.db.get("profile", id, {
      ownerUserId: requireUserId(this.deps),
    });

  public readonly list = (input: Partial<Pick<Profile, "type">> = {}) =>
    this.deps.db.list(
      "profile",
      {
        ownerUserId: requireUserId(this.deps),
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

  public readonly listIdsAsc = async () => {
    const supabase = requireServiceSupabase(this.deps);
    const { data, error } = await supabase
      .from("profile")
      .select("id")
      .eq("owner_user_id", requireUserId(this.deps))
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((profile) => profile.id);
  };

  public readonly update = async ({ id, values }: UpdateProfileParams) => {
    const { error } = await requireServiceSupabase(this.deps)
      .from("profile")
      .update({
        external_name: values.externalName,
        icon: values.icon,
        name: values.name,
      })
      .eq("id", id)
      .eq("owner_user_id", requireUserId(this.deps));

    if (error) {
      throw new Error(error.message);
    }

    return this.get({
      id,
    });
  };
}
