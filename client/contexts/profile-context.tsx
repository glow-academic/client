/**
 * Profile Context for managing the active user profile and simulation across the application.
 * This provides a centralized way to manage profile switching and ensures
 * all components stay in sync with the effective user's data (ID, role, name, etc.).
 *
 * Now also provides departments, cohorts, and breadcrumbs from a single data source.
 * Uses SSR + Server Actions pattern (no React Query)
 */
"use client";

import type { LayoutContextResponse } from "@/app/(main)/layout-server";
import {
  getFirstAvailableSectionForRole,
  getSectionRoute,
  isSectionAvailableForRole,
} from "@/utils/navigation-utils";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ProfileRole = "superadmin" | "admin" | "instructional" | "ta" | "guest";

// Use types from server response
type ProfileItem = LayoutContextResponse["actualProfile"];

// ============================================================================
// TYPES (derived from LayoutContextResponse)
// ============================================================================

export type DepartmentItem = LayoutContextResponse["departments"][number];
export type CohortItem = LayoutContextResponse["cohorts"]["items"][number];
export type SimulationContextItem =
  LayoutContextResponse["simulations"]["items"][number];

// A generic, fallback guest profile for when no user is logged in or during loading states.
const GUEST_PROFILE: ProfileItem = {
  id: "guest-profile-id",
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
  primaryDepartmentId: null,
};

interface ProfileContextType {
  // Profile data
  activeProfile: ProfileItem | null;
  simulatedProfile: ProfileItem | null;
  effectiveProfile: ProfileItem | null;
  isSimulating: boolean;
  isFullEmulation: boolean;
  isLoading: boolean;

  // Helper functions
  navigateToDefault: (role: ProfileRole) => void;
  isSectionAvailable: (section: string, role?: ProfileRole) => boolean;

  // Layout data (from useLayoutContext)
  departments: DepartmentItem[];
  departmentIds: string[];
  selectedDepartmentIds: string[];
  setSelectedDepartmentIds: (ids: string[]) => void;
  effectiveDepartmentIds: string[];
  cohorts: CohortItem[];
  cohortIds: string[];
  simulations: SimulationContextItem[];
  simulationIds: string[];
  cohortMemberCounts: Record<string, number>;
  simulatableProfiles: ProfileItem[];
  earliestAttemptDate: string | null;

  // Permissions data (from server)
  availableSections: string[];
  redirectPath: string;
}

export const ProfileContext = createContext<ProfileContextType | null>(null);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProviderClient");
  }
  return context;
};

interface ProfileProviderClientProps {
  children: React.ReactNode;
  initial: LayoutContextResponse;
}

export function ProfileProviderClient({
  children,
  initial,
}: ProfileProviderClientProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Department filter state
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    []
  );

  const bootstrapProfile = initial.actualProfile ?? null;
  const effectiveProfile = initial.effectiveProfile ?? null;

  // Compute effective department IDs (like cohorts in Home.tsx)
  const effectiveDepartmentIds = useMemo(() => {
    const allDepartmentIds = initial.departmentIds ?? [];
    return selectedDepartmentIds.length > 0
      ? selectedDepartmentIds
      : allDepartmentIds;
  }, [selectedDepartmentIds, initial.departmentIds]);

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

  const resolvedActiveProfile = useMemo<ProfileItem | null>(() => {
    // If not authenticated at all, fallback to guest
    if (!bootstrapProfile) return GUEST_PROFILE;

    // Three states:
    // 1. Normal: activeProfile = bootstrapProfile, effectiveProfile = bootstrapProfile
    // 2. Half emulation: activeProfile = bootstrapProfile, effectiveProfile = emulated profile
    // 3. Full emulation: activeProfile = effectiveProfile (emulated profile), effectiveProfile = emulated profile
    if (isFullEmulation && effectiveProfile) {
      return effectiveProfile; // Full emulation: use emulated profile as active
    } else {
      return bootstrapProfile; // Normal or half emulation: use user's actual profile as active
    }
  }, [bootstrapProfile, effectiveProfile, isFullEmulation]);

  const simulatedProfile = useMemo<ProfileItem | null>(() => {
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
      const targetRole = (role ||
        effectiveProfile?.role ||
        "guest") as ProfileRole;
      return isSectionAvailableForRole(section, targetRole);
    },
    [effectiveProfile?.role]
  );

  const value: ProfileContextType = {
    // Profile data
    activeProfile: resolvedActiveProfile,
    simulatedProfile,
    effectiveProfile:
      effectiveProfile ?? resolvedActiveProfile ?? GUEST_PROFILE,
    isSimulating: !!(
      bootstrapProfile &&
      effectiveProfile &&
      effectiveProfile.id !== bootstrapProfile.id
    ),
    isFullEmulation,
    isLoading: false, // Data comes from server, always available

    // Helper functions
    navigateToDefault,
    isSectionAvailable,

    // Layout data (from server)
    departments: initial.departments ?? [],
    departmentIds: initial.departmentIds ?? [],
    selectedDepartmentIds,
    setSelectedDepartmentIds,
    effectiveDepartmentIds,
    cohorts: initial.cohorts.items ?? [],
    cohortIds: initial.cohortIds ?? [],
    simulations: initial.simulations.items ?? [],
    simulationIds: initial.simulationIds ?? [],
    cohortMemberCounts: initial.cohorts.memberCounts ?? {},
    simulatableProfiles: initial.simulatableProfiles ?? [],
    earliestAttemptDate: initial.earliestAttemptDate ?? null,

    // Permissions data (from server)
    availableSections: initial.availableSections ?? [],
    redirectPath: initial.redirectPath ?? "/home",
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
