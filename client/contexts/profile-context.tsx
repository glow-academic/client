/**
 * Profile Context for managing the active user profile and simulation across the application.
 * This provides a centralized way to manage profile switching and ensures
 * all components stay in sync with the effective user's data (ID, role, name, etc.).
 */
"use client";

import { useProfile as useProfileQuery } from "@/lib/api/hooks/profiles";
import { profiles } from "@/utils/drizzle/schema";
import {
  getFirstAvailableSectionForRole,
  getSectionRoute,
  isSectionAvailableForRole,
} from "@/utils/navigation-utils";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import React, { createContext, useCallback, useContext, useMemo } from "react";

type Profile = typeof profiles.$inferSelect;
type ProfileRole = Profile["role"];

// A generic, fallback guest profile for when no user is logged in or during loading states.
const GUEST_PROFILE: Profile = {
  id: "guest-profile-id",
  userId: null,
  firstName: "Guest",
  lastName: "User",
  alias: "guest",
  role: "guest",
  active: true,
  viewedIntro: true,
  viewedChat: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
  reqPerDay: null,
};

interface ProfileContextType {
  activeProfile: Profile | null;
  simulatedProfile: Profile | null;
  effectiveProfile: Profile | null;
  isSimulating: boolean;
  isLoading: boolean;
  navigateToDefault: (role: ProfileRole) => void;
  isSectionAvailable: (section: string, role?: ProfileRole) => boolean;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};

interface ProfileProviderProps {
  children: React.ReactNode;
  activeProfile: Profile | null;
  isProfileLoading?: boolean;
}

export function ProfileProvider({
  children,
  activeProfile: bootstrapProfile, // server-provided profile of the signed-in user (or null)
  isProfileLoading = false,
}: ProfileProviderProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const effectiveId =
    session?.effectiveProfileId ??
    session?.user?.profileId ??
    bootstrapProfile?.id ??
    null;

  const { data: effectiveProfile, isLoading: isEffLoading } = useProfileQuery(
    effectiveId || "",
    !!effectiveId && effectiveId !== "guest-profile-id"
  );

  // Determine if we're in full emulation mode (when "Emulate" button was pressed)
  const isFullEmulation = useMemo(() => {
    return !!(
      bootstrapProfile &&
      effectiveProfile &&
      effectiveProfile.id !== bootstrapProfile.id &&
      session?.emulationTTL && // Full emulation is enabled when TTL is set
      session?.fullEmulation // And the full emulation flag is set
    );
  }, [
    bootstrapProfile,
    effectiveProfile,
    session?.emulationTTL,
    session?.fullEmulation,
  ]);

  const resolvedActiveProfile = useMemo<Profile | null>(() => {
    // When authenticated but no effective fetched yet, show null/loading
    if (status === "loading" || isProfileLoading || isEffLoading) return null;
    // If not authenticated at all, fallback to guest
    if (status === "unauthenticated" && !bootstrapProfile) return GUEST_PROFILE;

    // Three states:
    // 1. Normal: activeProfile = bootstrapProfile, effectiveProfile = bootstrapProfile
    // 2. Half emulation: activeProfile = bootstrapProfile, effectiveProfile = emulated profile
    // 3. Full emulation: activeProfile = effectiveProfile (emulated profile), effectiveProfile = emulated profile
    if (isFullEmulation && effectiveProfile) {
      return effectiveProfile; // Full emulation: use emulated profile as active
    } else {
      return bootstrapProfile; // Normal or half emulation: use user's actual profile as active
    }
  }, [
    status,
    isProfileLoading,
    isEffLoading,
    bootstrapProfile,
    effectiveProfile,
    isFullEmulation,
  ]);

  const simulatedProfile = useMemo<Profile | null>(() => {
    if (!effectiveProfile || !bootstrapProfile) return null;
    // If effective profile differs from bootstrapProfile, we are simulating
    // simulatedProfile represents the profile we're emulating (effectiveProfile)
    if (effectiveProfile.id !== bootstrapProfile.id) {
      return effectiveProfile;
    }
    return null;
  }, [bootstrapProfile, effectiveProfile]);

  const navigateToDefault = useCallback(
    (role: ProfileRole) => {
      const defaultSection = getFirstAvailableSectionForRole(role);
      const route = getSectionRoute(defaultSection, pathname);
      router.push(route);
    },
    [router, pathname]
  );

  const isSectionAvailable = useCallback(
    (section: string, role?: ProfileRole) => {
      const targetRole = role || effectiveProfile?.role || "guest";
      return isSectionAvailableForRole(section, targetRole);
    },
    [effectiveProfile?.role]
  );

  const value: ProfileContextType = {
    activeProfile: resolvedActiveProfile,
    simulatedProfile,
    effectiveProfile:
      effectiveProfile ?? resolvedActiveProfile ?? GUEST_PROFILE,
    isSimulating: !!(
      bootstrapProfile &&
      effectiveProfile &&
      effectiveProfile.id !== bootstrapProfile.id
    ),
    isLoading: status === "loading" || isProfileLoading || isEffLoading,
    navigateToDefault,
    isSectionAvailable,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
