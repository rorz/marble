import type { ResourceDeps } from "../db";
import type { CreateParams, Entity, UpdateParams } from "../types";

export type Profile = Entity<"profile">;

type CreateProfileInput = Pick<CreateParams<"profile">, "name"> &
  Partial<Pick<CreateParams<"profile">, "externalName" | "icon" | "type">>;

type UpdateProfileInput = Partial<
  Pick<UpdateParams<"profile">, "externalName" | "icon" | "name" | "type">
>;

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

  public readonly create = async (input: CreateProfileInput) => {
    const { data, error } = await requireServiceSupabase(this.deps)
      .from("profile")
      .insert({
        external_name: input.externalName ?? null,
        icon: input.icon ?? null,
        name: input.name,
        owner_user_id: requireUserId(this.deps),
        type: input.type ?? "Agent",
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not create profile.");
    }

    return this.get(data.id);
  };

  public readonly delete = async (id: string) => {
    const profile = await this.get(id);

    if (profile.type !== "Agent") {
      throw new Error("The automatic human profile cannot be deleted here.");
    }

    const { error } = await requireServiceSupabase(this.deps)
      .from("profile")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", requireUserId(this.deps));

    if (error) {
      throw new Error(error.message);
    }

    return profile;
  };

  public readonly get = (id: string) =>
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

  public readonly update = async (id: string, input: UpdateProfileInput) => {
    const existing = await this.get(id);

    if (existing.type !== "Agent") {
      throw new Error("Only agent profiles can be edited here.");
    }

    const { error } = await requireServiceSupabase(this.deps)
      .from("profile")
      .update({
        external_name: input.externalName,
        icon: input.icon,
        name: input.name,
        type: input.type,
      })
      .eq("id", id)
      .eq("owner_user_id", requireUserId(this.deps));

    if (error) {
      throw new Error(error.message);
    }

    return this.get(id);
  };
}
