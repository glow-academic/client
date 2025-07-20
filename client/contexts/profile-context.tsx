/**
 * Profile Context for managing the active user profile and simulation across the application.
 * This provides a centralized way to manage profile switching and ensures
 * all components stay in sync with the effective user's data (ID, role, name, etc.).
 */
"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { 
  getFirstAvailableSectionForRole, 
  getSectionRoute,
  isSectionAvailableForRole 
} from "@/utils/navigation-utils";
import { profiles } from "@/utils/drizzle/schema";
import { getProfile } from "@/utils/queries/profiles/get-profile";

type Profile = typeof profiles.$inferSelect;
type ProfileRole = Profile['role'];

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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  lastActive: new Date().toISOString(),
  defaultProfile: false,
};

interface ProfileContextType {
  activeProfile: Profile | null;
  simulatedProfile: Profile | null;
  effectiveProfile: Profile;
  isSimulating: boolean;
  isLoading: boolean;
  setSimulatedProfile: (profileId: string | null, shouldNavigate?: boolean) => void;
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

export function ProfileProvider({ children, activeProfile }: ProfileProviderProps) {
  const [simulatedProfileId, setSimulatedProfileId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    const storedId = localStorage.getItem("simulatedProfileId");
    if (storedId) {
      setSimulatedProfileId(storedId);
    }
  }, []);

  const { data: simulatedProfileData, isLoading: isSimulatingProfileLoading } = useQuery({
    queryKey: ['simulatedProfile', simulatedProfileId],
    queryFn: async () => {
      if (!simulatedProfileId) return null;
      return await getProfile(simulatedProfileId);
    },
    enabled: !!simulatedProfileId && isClient,
  });

  const { effectiveProfile, simulatedProfile, isLoading } = useMemo(() => {
    // During hydration or while fetching a simulation, the user is a generic guest.
    if (!isClient || isSimulatingProfileLoading) {
      return { effectiveProfile: GUEST_PROFILE, simulatedProfile: null, isLoading: true };
    }
    
    // If a simulation is active and loaded, it becomes the effective profile.
    if (simulatedProfileData) {
      return { effectiveProfile: simulatedProfileData, simulatedProfile: simulatedProfileData, isLoading: false };
    }

    // Otherwise, use the active logged-in profile from the auth layer.
    // This correctly handles users whose assigned role IS 'guest',
    // as well as falling back to the generic GUEST_PROFILE if no user is logged in at all.
    const finalProfile = activeProfile || GUEST_PROFILE;
    return { effectiveProfile: finalProfile, simulatedProfile: null, isLoading: false };

  }, [isClient, isSimulatingProfileLoading, simulatedProfileData, activeProfile]);

  const navigateToDefault = React.useCallback((role: ProfileRole) => {
    const defaultSection = getFirstAvailableSectionForRole(role);
    const route = getSectionRoute(defaultSection);
    router.push(route);
  }, [router]);

  const setSimulatedProfile = React.useCallback((profileId: string | null, shouldNavigate: boolean = true) => {
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
  }, [isClient, queryClient, navigateToDefault, activeProfile]);

  const clearSimulation = React.useCallback(() => {
    setSimulatedProfile(null);
  }, [setSimulatedProfile]);

  const isSectionAvailable = React.useCallback((section: string, role?: ProfileRole) => {
    const targetRole = role || effectiveProfile.role;
    return isSectionAvailableForRole(section, targetRole);
  }, [effectiveProfile.role]);
  
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

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}