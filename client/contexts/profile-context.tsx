/**
 * Profile Context for managing the active user profile and simulation across the application.
 * This provides a centralized way to manage profile switching and ensures
 * all components stay in sync with the effective user's data (ID, role, name, etc.).
 *
 * Now also provides departments, cohorts, and breadcrumbs from a single data source.
 */
"use client";

import { api } from "@/lib/api/fetcher";
import { layoutContextKeys } from "@/lib/api/v2/keys";
import { ProfileRole } from "@/lib/api/v2/schemas/base";
import { ProfileItem } from "@/lib/api/v2/schemas/profile";
import {
  getFirstAvailableSectionForRole,
  getSectionRoute,
  isSectionAvailableForRole,
} from "@/utils/navigation-utils";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { z } from "zod";

// ============================================================================
// INTERNAL TYPES (for consolidated API)
// ============================================================================

const DepartmentItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CohortItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  departmentId: z.string(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const BreadcrumbItemSchema = z.object({
  segment: z.string(),
  title: z.string(),
  context: z.string().optional().nullable(),
});

const CohortsDataSchema = z.object({
  items: z.array(CohortItemSchema),
  memberCounts: z.record(z.string(), z.number()),
});

const SimulationContextItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  departmentId: z.string(),
  timeLimit: z.number().nullable(),
  active: z.boolean(),
  practiceSimulation: z.boolean(),
  defaultSimulation: z.boolean(),
});

const SimulationsDataSchema = z.object({
  items: z.array(SimulationContextItemSchema),
});

// Import ProfileItemSchema from centralized location
import { ProfileItemSchema } from "@/lib/api/v2/schemas/profile";

const LayoutContextResponseSchema = z.object({
  actualProfile: ProfileItemSchema,
  effectiveProfile: ProfileItemSchema,
  departments: z.array(DepartmentItemSchema),
  departmentIds: z.array(z.string()),
  cohorts: CohortsDataSchema,
  cohortIds: z.array(z.string()),
  simulations: SimulationsDataSchema,
  simulationIds: z.array(z.string()),
  breadcrumbs: z.array(BreadcrumbItemSchema),
  simulatableProfiles: z.array(ProfileItemSchema),
  earliestAttemptDate: z.string().nullable(),
  availableSections: z.array(z.string()),
  redirectPath: z.string(),
});

export type BreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>;
export type DepartmentItem = z.infer<typeof DepartmentItemSchema>;
export type CohortItem = z.infer<typeof CohortItemSchema>;
export type SimulationContextItem = z.infer<typeof SimulationContextItemSchema>;

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
  breadcrumbs: BreadcrumbItem[];
  simulatableProfiles: ProfileItem[];
  earliestAttemptDate: string | null;

  // Permissions data (from server)
  availableSections: string[];
  redirectPath: string;
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
}

export function ProfileProvider({ children }: ProfileProviderProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Department filter state
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    []
  );

  // Internal hook: Get ALL data from consolidated API (single source of truth!)
  const effectiveProfileId = session?.effectiveProfileId ?? "";

  const { data: layoutData, isLoading: layoutLoading } = useQuery({
    queryKey: layoutContextKeys.detail(effectiveProfileId, pathname ?? "/"),
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/profile/context", {
        method: "POST",
        body: JSON.stringify({
          effectiveProfileId,
          pathname: pathname ?? "/",
        }),
      });
      return LayoutContextResponseSchema.parse(res);
    },
    enabled: !!effectiveProfileId,
    staleTime: 10 * 60 * 1000, // 10 minutes (up from 5)
    structuralSharing: true, // Enable deep equality check
    gcTime: 15 * 60 * 1000, // Cache for 15 minutes
  });

  const bootstrapProfile = layoutData?.actualProfile ?? null;
  const effectiveProfile = layoutData?.effectiveProfile ?? null;

  // Compute effective department IDs (like cohorts in Home.tsx)
  const effectiveDepartmentIds = useMemo(() => {
    const allDepartmentIds = layoutData?.departmentIds ?? [];
    return selectedDepartmentIds.length > 0
      ? selectedDepartmentIds
      : allDepartmentIds;
  }, [selectedDepartmentIds, layoutData?.departmentIds]);

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
    // When authenticated but no effective fetched yet, show null/loading
    if (status === "loading" || layoutLoading) return null;
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
    layoutLoading,
    bootstrapProfile,
    effectiveProfile,
    isFullEmulation,
  ]);

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
      const targetRole = role || effectiveProfile?.role || "guest";
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
    isLoading: status === "loading" || layoutLoading,

    // Helper functions
    navigateToDefault,
    isSectionAvailable,

    // Layout data (from useLayoutContext)
    departments: layoutData?.departments ?? [],
    departmentIds: layoutData?.departmentIds ?? [],
    selectedDepartmentIds,
    setSelectedDepartmentIds,
    effectiveDepartmentIds,
    cohorts: layoutData?.cohorts.items ?? [],
    cohortIds: layoutData?.cohortIds ?? [],
    simulations: layoutData?.simulations.items ?? [],
    simulationIds: layoutData?.simulationIds ?? [],
    cohortMemberCounts: layoutData?.cohorts.memberCounts ?? {},
    breadcrumbs: layoutData?.breadcrumbs ?? [],
    simulatableProfiles: layoutData?.simulatableProfiles ?? [],
    earliestAttemptDate: layoutData?.earliestAttemptDate ?? null,

    // Permissions data (from server)
    availableSections: layoutData?.availableSections ?? [],
    redirectPath: layoutData?.redirectPath ?? "/home",
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
