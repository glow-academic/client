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

type UserRole = "admin" | "instructional" | "instructor" | "ta" | "guest";

// Helper function to check if a user can simulate a specific role
const canUserSimulateRole = (userRole: UserRole, targetRole: UserRole): boolean => {
  // Admin can simulate all roles
  if (userRole === "admin") return true;
  
  // Instructional staff can simulate instructor and ta roles
  if (userRole === "instructional") {
    return ["instructor", "ta"].includes(targetRole);
  }
  
  // Instructor can simulate ta role
  if (userRole === "instructor") {
    return targetRole === "ta";
  }
  
  // TA cannot simulate any other roles
  if (userRole === "ta") return false;
  
  return false;
};

interface RoleContextType {
  effectiveRole: UserRole;
  simulatedRole: UserRole | null;
  isGuestMode: boolean;
  setRole: (role: UserRole | null, shouldNavigate?: boolean) => void;
  enableGuestMode: () => void;
  disableGuestMode: () => void;
  refreshRole: () => void;
  getFirstAvailableSection: (role: UserRole) => string;
  navigateToRoleDefault: (role: UserRole) => void;
  isSectionAvailable: (section: string, role?: UserRole) => boolean;
  // Debug utilities
  debug: {
    userRole?: UserRole;
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
  userRole?: UserRole;
}

export function RoleProvider({ children, userRole }: RoleProviderProps) {
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
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
    if (userRole && userRole !== "guest") {
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
      setSimulatedRole(storedRole as UserRole);
    }
  }, [isClient, userRole]);

  // Calculate effective role
  const effectiveRole: UserRole = React.useMemo(() => {
    if (!isClient) return "guest";

    if (isGuestMode) return "guest";
    if (simulatedRole) return simulatedRole;
    return userRole || "guest";
  }, [isClient, isGuestMode, simulatedRole, userRole]);

  const getFirstAvailableSection = React.useCallback((role: UserRole) => {
    return getFirstAvailableSectionForRole(role);
  }, []);

  const isSectionAvailable = React.useCallback((section: string, role?: UserRole) => {
    const targetRole = role || effectiveRole;
    return isSectionAvailableForRole(section, targetRole);
  }, [effectiveRole]);

  const navigateToRoleDefault = React.useCallback((role: UserRole) => {
    const defaultSection = getFirstAvailableSectionForRole(role);
    const route = getSectionRoute(defaultSection);
    router.push(route);
  }, [router]);

  const setRole = React.useCallback((role: UserRole | null, shouldNavigate: boolean = false) => {
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
      if (userRole) {
        navigateToRoleDefault(userRole);
      }
    }

    // Invalidate all queries
    queryClient.invalidateQueries();
  }, [isClient, simulatedRole, userRole, queryClient, navigateToRoleDefault]);

  const refreshRole = React.useCallback(() => {
    if (!isClient) return;

    // Force a refresh by invalidating queries
    queryClient.invalidateQueries();
  }, [isClient, queryClient]);

  // Debug information
  const debug = React.useMemo(
    () => ({
      userRole,
      isClient,
      localStorage: {
        simulatedRole: isClient ? localStorage.getItem("simulatedRole") : null,
        guestMode: isClient ? localStorage.getItem("guestMode") : null,
      },
    }),
    [userRole, isClient, simulatedRole, isGuestMode],
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

// Debug hook for development
export const useRoleDebug = () => {
  const { debug, effectiveRole, simulatedRole, isGuestMode } = useRole();

  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("Role Debug:", {
        effectiveRole,
        simulatedRole,
        isGuestMode,
        ...debug,
      });
    }
  }, [effectiveRole, simulatedRole, isGuestMode, debug]);

  return { effectiveRole, simulatedRole, isGuestMode, debug };
};
