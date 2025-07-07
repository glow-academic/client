/**
 * Role Context for managing role simulation across the application
 * This provides a centralized way to manage role switching and ensures
 * all components stay in sync when the effective role changes.
 */
"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { 
  getFirstAvailableSectionForRole, 
  getSectionRoute,
  isSectionAvailableForRole 
} from "@/utils/navigation-utils";

type ProfileRole = "admin" | "instructional" | "instructor" | "ta" | "guest";

interface RoleContextType {
  effectiveRole: ProfileRole;
  simulatedRole: ProfileRole | null;
  isGuestMode: boolean;
  setRole: (role: ProfileRole | null, shouldNavigate?: boolean) => void;
  enableGuestMode: () => void;
  disableGuestMode: () => void;
  refreshRole: () => void;
  getFirstAvailableSection: (role: ProfileRole) => string;
  navigateToRoleDefault: (role: ProfileRole) => void;
  isSectionAvailable: (section: string, role?: ProfileRole) => boolean;
  // Debug utilities
  debug: {
    ProfileRole?: ProfileRole | undefined;
    isClient: boolean;
    localStorage: {
      simulatedRole: string | null;
      guestMode: string | null;
    };
  };
}

const RoleContext = createContext<RoleContextType | null>(null);

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return context;
};

interface RoleProviderProps {
  children: React.ReactNode;
  ProfileRole?: ProfileRole | undefined;
}

export function RoleProvider({ children, ProfileRole }: RoleProviderProps) {
  const [simulatedRole, setSimulatedRole] = useState<ProfileRole | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  // Handle client-side mounting
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load initial state from localStorage - but only if no actual user is logged in
  useEffect(() => {
    if (!isClient) return;

    // If we have an actual user role, don't load guest mode from localStorage
    // This prevents guest mode from interfering with actual authentication
    if (ProfileRole && ProfileRole !== "guest") {
      // Clear any guest mode that might be lingering
      localStorage.removeItem("guestMode");
      setIsGuestMode(false);
      
      // IMPORTANT: When a user has just logged in with their actual credentials,
      // we should NOT load any simulated roles from localStorage.
      // This prevents old simulated roles from interfering with fresh logins.
      // Users can explicitly switch roles using the role switcher if needed.
      localStorage.removeItem("simulatedRole");
      setSimulatedRole(null);
      return;
    }

    // Only load guest mode if no actual user is logged in
    const storedRole = localStorage.getItem("simulatedRole");
    const storedGuestMode = localStorage.getItem("guestMode") === "true";

    if (storedGuestMode || storedRole === "guest") {
      setIsGuestMode(true);
      setSimulatedRole("guest");
    } else if (
      storedRole &&
      ["admin", "instructional", "instructor", "ta"].includes(storedRole)
    ) {
      setSimulatedRole(storedRole as ProfileRole);
    }
  }, [isClient, ProfileRole]);

  // Calculate effective role
  const effectiveRole: ProfileRole = React.useMemo(() => {
    if (!isClient) return "guest";

    if (isGuestMode) return "guest";
    if (simulatedRole) return simulatedRole;
    return ProfileRole || "guest";
  }, [isClient, isGuestMode, simulatedRole, ProfileRole]);

  const getFirstAvailableSection = React.useCallback((role: ProfileRole) => {
    return getFirstAvailableSectionForRole(role);
  }, []);

  const isSectionAvailable = React.useCallback((section: string, role?: ProfileRole) => {
    const targetRole = role || effectiveRole;
    return isSectionAvailableForRole(section, targetRole);
  }, [effectiveRole]);

  const navigateToRoleDefault = React.useCallback((role: ProfileRole) => {
    const defaultSection = getFirstAvailableSectionForRole(role);
    const route = getSectionRoute(defaultSection);
    router.push(route);
  }, [router]);

  const setRole = React.useCallback((role: ProfileRole | null, shouldNavigate: boolean = false) => {
    if (!isClient) return;

    const previousRole = effectiveRole;
    setSimulatedRole(role);

    if (role) {
      localStorage.setItem("simulatedRole", role);
      if (role === "guest") {
        localStorage.setItem("guestMode", "true");
        setIsGuestMode(true);
      } else {
        localStorage.removeItem("guestMode");
        setIsGuestMode(false);
      }
    } else {
      localStorage.removeItem("simulatedRole");
      localStorage.removeItem("guestMode");
      setIsGuestMode(false);
    }

    // Invalidate all queries to force re-fetch with new role
    queryClient.invalidateQueries();

    // Navigate to the appropriate page for the new role ONLY if explicitly requested
    if (shouldNavigate && role && role !== previousRole) {
      // Small delay to ensure state updates are processed
      setTimeout(() => {
        navigateToRoleDefault(role);
      }, 100);
    }

    // Force a small delay to ensure all components re-render
    setTimeout(() => {
      queryClient.invalidateQueries();
    }, 200);
  }, [isClient, effectiveRole, queryClient, navigateToRoleDefault]);

  const enableGuestMode = React.useCallback(() => {
    if (!isClient) return;

    setIsGuestMode(true);
    setSimulatedRole("guest");
    localStorage.setItem("guestMode", "true");
    localStorage.setItem("simulatedRole", "guest");

    // Navigate to guest default page
    navigateToRoleDefault("guest");

    // Invalidate all queries
    queryClient.invalidateQueries();
  }, [isClient, queryClient, navigateToRoleDefault]);

  const disableGuestMode = React.useCallback(() => {
    if (!isClient) return;

    setIsGuestMode(false);
    localStorage.removeItem("guestMode");

    // If we were in guest mode, clear the simulated role too
    if (simulatedRole === "guest") {
      setSimulatedRole(null);
      localStorage.removeItem("simulatedRole");
      
      // Navigate to the user's actual role default page
      if (ProfileRole) {
        navigateToRoleDefault(ProfileRole);
      }
    }

    // Invalidate all queries
    queryClient.invalidateQueries();
  }, [isClient, simulatedRole, ProfileRole, queryClient, navigateToRoleDefault]);

  const refreshRole = React.useCallback(() => {
    if (!isClient) return;

    // Force a refresh by invalidating queries
    queryClient.invalidateQueries();
  }, [isClient, queryClient]);

  // Debug information
  const debug = React.useMemo(
    () => ({
      ProfileRole,
      isClient,
      localStorage: {
        simulatedRole: isClient ? localStorage.getItem("simulatedRole") : null,
        guestMode: isClient ? localStorage.getItem("guestMode") : null,
      },
    }),
    [ProfileRole, isClient],
  );

  const value: RoleContextType = {
    effectiveRole,
    simulatedRole,
    isGuestMode,
    setRole,
    enableGuestMode,
    disableGuestMode,
    refreshRole,
    getFirstAvailableSection,
    navigateToRoleDefault,
    isSectionAvailable,
    debug,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}