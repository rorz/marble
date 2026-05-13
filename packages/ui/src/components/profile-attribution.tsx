"use client";

import { cx } from "../utils/cx";

export type MarbleProfileAttributionProfile = {
  externalName?: null | string;
  icon?: null | string;
  id: string;
  name: string;
  type: "Agent" | "Human";
};

export type MarbleProfileAttributionProps = {
  className?: string;
  maxVisible?: number;
  profiles: MarbleProfileAttributionProfile[];
};

const resolveProfileGlyph = (profile: MarbleProfileAttributionProfile) => {
  if (profile.type === "Human") {
    return "H";
  }

  return profile.icon?.trim() || "🤖";
};

const ProfileMark = ({
  profile,
  stacked = false,
}: {
  profile: MarbleProfileAttributionProfile;
  stacked?: boolean;
}) => {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none inset-shadow-2xs inset-shadow-white/70",
        profile.type === "Human"
          ? "border-taupe-700 bg-taupe-600 font-semibold text-white"
          : "border-taupe-200 bg-linear-to-br from-white via-taupe-50 to-orange-50",
        stacked && "-ml-1 first:ml-0",
      )}
    >
      {resolveProfileGlyph(profile)}
    </span>
  );
};

export const MarbleProfileAttribution = ({
  className,
  maxVisible = 2,
  profiles,
}: MarbleProfileAttributionProps) => {
  const visibleProfiles = profiles.slice(0, maxVisible);
  const overflowCount = Math.max(0, profiles.length - visibleProfiles.length);
  const leadProfile = profiles[0];

  if (!leadProfile) {
    return null;
  }

  if (profiles.length === 1) {
    return (
      <div
        className={cx(
          "flex min-w-0 items-center gap-1.5 text-[11px] text-taupe-600",
          className,
        )}
      >
        <ProfileMark profile={leadProfile} />
        <span className="truncate font-medium text-taupe-700">
          {leadProfile.name}
        </span>
        {leadProfile.externalName ? (
          <span className="truncate text-taupe-500">
            {leadProfile.externalName}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex min-w-0 items-center gap-1.5 text-[11px] text-taupe-600",
        className,
      )}
    >
      <span className="flex shrink-0 items-center pl-1">
        {visibleProfiles.map((profile) => (
          <ProfileMark
            key={profile.id}
            profile={profile}
            stacked
          />
        ))}
      </span>
      <span className="truncate font-medium text-taupe-700">
        {leadProfile.name}
        {overflowCount > 0 ? ` + ${overflowCount} more` : ""}
      </span>
      <span className="truncate text-taupe-500">{profiles.length} agents</span>
    </div>
  );
};
