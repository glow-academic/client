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
  isProfileLoading?: boolean;
}

export function ProfileProvider({
  children,
  activeProfile,
  isProfileLoading = false,
}: ProfileProviderProps) {
  const [isEmulateMode, setIsEmulateMode] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("emulate") === "true"
  );
  const [simulatedProfileId, setSimulatedProfileId] = useState<string | null>(
    () =>
      typeof window === "undefined"
        ? null
        : localStorage.getItem("simulatedProfileId")
  );
  const [isClient, setIsClient] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Keep local emulate flag in sync with localStorage and custom events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateEmulateFromStorage = () => {
      try {
        setIsEmulateMode(localStorage.getItem("emulate") === "true");
      } catch {
        setIsEmulateMode(false);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "emulate") {
        updateEmulateFromStorage();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(
      "profile:emulate-changed",
      updateEmulateFromStorage as EventListener
    );
    // Initialize once on mount
    updateEmulateFromStorage();

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "profile:emulate-changed",
        updateEmulateFromStorage as EventListener
      );
    };
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
    // During hydration, show loading state
    if (!isClient) {
      return {
        effectiveProfile: null,
        simulatedProfile: null,
        isLoading: true,
      };
    }

    // Check for guest mode in localStorage
    const isGuestMode =
      isClient && localStorage.getItem("guestMode") === "true";

    // If guest mode is active, use guest profile
    if (isGuestMode) {
      return {
        effectiveProfile: GUEST_PROFILE,
        simulatedProfile: GUEST_PROFILE,
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

    // If we're still loading the simulated profile, show loading
    if (isSimulatingProfileLoading) {
      return {
        effectiveProfile: null,
        simulatedProfile: null,
        isLoading: true,
      };
    }

    // If we're still loading the main profile query, show loading
    if (isProfileLoading) {
      return {
        effectiveProfile: null,
        simulatedProfile: null,
        isLoading: true,
      };
    }

    // If we have an active profile, use it
    if (activeProfile) {
      return {
        effectiveProfile: activeProfile,
        simulatedProfile: null,
        isLoading: false,
      };
    }

    // At this point we *know* we have no session *and* no profile. It's truly guest mode.
    return {
      effectiveProfile: GUEST_PROFILE,
      simulatedProfile: null,
      isLoading: false,
    };
  }, [
    isClient,
    isSimulatingProfileLoading,
    isProfileLoading,
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

      queryClient.invalidateQueries({ queryKey: ["simulatedProfile"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });

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

  const resolvedActiveProfile = useMemo<Profile | null>(() => {
    if (isEmulateMode && effectiveProfile) return effectiveProfile;
    return activeProfile;
  }, [isEmulateMode, effectiveProfile, activeProfile]);

  const value: ProfileContextType = {
    activeProfile: resolvedActiveProfile,
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
