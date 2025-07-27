/**
 * Profile Context for managing the active user profile and simulation across the application.
 * This provides a centralized way to manage profile switching and ensures
 * all components stay in sync with the effective user's data (ID, role, name, etc.).
 */
"use client";

import { profiles } from "@/utils/drizzle/schema";
import {
  getFirstAvailableSectionForRole,
  getSectionRoute,
  isSectionAvailableForRole,
} from "@/utils/navigation-utils";
import { getProfile } from "@/utils/queries/profiles/get-profile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Profile = typeof profiles.$inferSelect;
type ProfileRole = Profile["role"];

// A generic, fallback guest profile for when no user is logged in or during loading states.
const GUEST_PROFILE: Profile = {
  id: "guest-profile-id",
  userId: null,
  firstName: "Guest",
  lastName: "User",
  alias: "Guest",
  role: "guest",
  active: true,
  viewedIntro: true,
  viewedChat: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
};

interface ProfileContextType {
  activeProfile: Profile | null;
  simulatedProfile: Profile | null;
  effectiveProfile: Profile | null;
  isSimulating: boolean;
  isLoading: boolean;
  setSimulatedProfile: (
    profileId: string | null,
    shouldNavigate?: boolean
  ) => void;
  clearSimulation: () => void;
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
}

export function ProfileProvider({
  children,
  activeProfile,
}: ProfileProviderProps) {
  const [simulatedProfileId, setSimulatedProfileId] = useState<string | null>(
    null
  );
  const [isClient, setIsClient] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsClient(true);
    const storedId = localStorage.getItem("simulatedProfileId");
    if (storedId) {
      setSimulatedProfileId(storedId);
    }
  }, []);

  const { data: simulatedProfileData, isLoading: isSimulatingProfileLoading } =
    useQuery({
      queryKey: ["simulatedProfile", simulatedProfileId],
      queryFn: async () => {
        if (!simulatedProfileId) return null;
        return await getProfile(simulatedProfileId);
      },
      enabled: !!simulatedProfileId && isClient,
    });

  const { effectiveProfile, simulatedProfile, isLoading } = useMemo(() => {
    // During hydration or while fetching a simulation, don't default to guest
    if (!isClient || isSimulatingProfileLoading) {
      return {
        effectiveProfile: null,
        simulatedProfile: null,
        isLoading: true,
      };
    }

    // Check for guest mode in localStorage
    const isGuestMode =
      isClient && localStorage.getItem("guestMode") === "true";
    const simulatedRole = isClient
      ? localStorage.getItem("simulatedRole")
      : null;

    // If guest mode is active, use guest profile
    if (isGuestMode) {
      const guestProfile = {
        ...GUEST_PROFILE,
        role: (simulatedRole as ProfileRole) || "guest",
      };
      return {
        effectiveProfile: guestProfile,
        simulatedProfile: guestProfile,
        isLoading: false,
      };
    }

    // If a simulation is active and loaded, it becomes the effective profile.
    if (simulatedProfileData) {
      return {
        effectiveProfile: simulatedProfileData,
        simulatedProfile: simulatedProfileData,
        isLoading: false,
      };
    }

    // Otherwise, use the active logged-in profile from the auth layer.
    // This correctly handles users whose assigned role IS 'guest',
    // as well as falling back to the generic GUEST_PROFILE if no user is logged in at all.
    const finalProfile = activeProfile || GUEST_PROFILE;
    return {
      effectiveProfile: finalProfile,
      simulatedProfile: null,
      isLoading: false,
    };
  }, [
    isClient,
    isSimulatingProfileLoading,
    simulatedProfileData,
    activeProfile,
  ]);

  const navigateToDefault = React.useCallback(
    (role: ProfileRole) => {
      const defaultSection = getFirstAvailableSectionForRole(role);
      const route = getSectionRoute(defaultSection, pathname);
      router.push(route);
    },
    [router, pathname]
  );

  const setSimulatedProfile = React.useCallback(
    (profileId: string | null, shouldNavigate: boolean = true) => {
      if (!isClient) return;

      setSimulatedProfileId(profileId);

      if (profileId) {
        localStorage.setItem("simulatedProfileId", profileId);
      } else {
        localStorage.removeItem("simulatedProfileId");
      }

      queryClient.invalidateQueries();

      // Optional: Handle navigation after state change
      if (shouldNavigate && !profileId && activeProfile) {
        navigateToDefault(activeProfile.role);
      }
    },
    [isClient, queryClient, navigateToDefault, activeProfile]
  );

  const clearSimulation = React.useCallback(() => {
    setSimulatedProfile(null);
  }, [setSimulatedProfile]);

  const isSectionAvailable = React.useCallback(
    (section: string, role?: ProfileRole) => {
      const targetRole = role || effectiveProfile?.role || "guest";
      return isSectionAvailableForRole(section, targetRole);
    },
    [effectiveProfile?.role]
  );

  const value: ProfileContextType = {
    activeProfile,
    simulatedProfile,
    effectiveProfile,
    isSimulating: !!simulatedProfile,
    isLoading,
    setSimulatedProfile,
    clearSimulation,
    navigateToDefault,
    isSectionAvailable,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
