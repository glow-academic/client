/**
 * Profile Context for managing the active user profile and simulation across the application.
 * This provides a centralized way to manage profile switching and ensures
 * all components stay in sync with the effective user's data (ID, role, name, etc.).
 *
 * Now also provides departments, cohorts, and breadcrumbs from a single data source.
 * Uses SSR + Server Actions pattern (no React Query)
 */
"use client";

import type {
  AnalyticsFiltersResponse,
  AuthProfileResponse,
  ProfileItem,
  SafeSessionSnapshot,
} from "@/app/(main)/layout-server";
import { usePathname, useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ProfileRole =
  | "superadmin"
  | "admin"
  | "instructional"
  | "member"
  | "guest"
  | "custom";

// ============================================================================
// TYPES (derived from LayoutContextResponse)
// ============================================================================

export type RoleResourceItem = NonNullable<
  AuthProfileResponse["role_resources"]
>[number];

// Note: With server-side access control, users without valid sessions won't reach pages
// (they see UnifiedAccessDenied). However, we handle null profiles gracefully for
// edge cases, loading states, and WebSocket connections that may legitimately use null profileId.

interface ProfileContextType {
  // Profile data
  profile: ProfileItem | null;
  isLoading: boolean;
  isAuthenticated: boolean; // true if user has real NextAuth session

  // Helper functions
  navigateToDefault: (role: ProfileRole) => void;
  isSectionAvailable: (section: string, role?: ProfileRole) => boolean;

  // Layout data (from useLayoutContext)
  departmentIds: string[];
  selectedDepartmentIds: string[];
  setSelectedDepartmentIds: (ids: string[]) => void;
  effectiveDepartmentIds: string[];
  cohortIds: string[];

  // Analytics filters (from server — per-page filter config + options)
  analyticsFilters: AnalyticsFiltersResponse | null;

  // Permissions data (from server)
  availableSections: string[];
  availableRoutes: string[];
  redirectPath: string;
  scopedRoles: string[]; // Roles that the effective profile has scope to see
  roleResources: RoleResourceItem[];
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
  initial: AuthProfileResponse | null;
  sessionSnapshot: SafeSessionSnapshot;
  analyticsFilters: AnalyticsFiltersResponse | null;
}

export function ProfileProviderClient({
  children,
  initial,
  sessionSnapshot,
  analyticsFilters,
}: ProfileProviderClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Department filter state
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    []
  );

  // Handle null initial (access denied case) - with server-side access control,
  // users without valid sessions won't reach pages (they see UnifiedAccessDenied).
  // However, we handle null gracefully for edge cases and loading states.
  // Construct profile objects from flat fields in LayoutContextResponse
  const profile = useMemo<ProfileItem | null>(() => {
    if (!initial) return null;
    return {
      id: initial.id ?? "",
      name: initial.name ?? null,
      role: initial.role ?? "guest",
      active: initial.active ?? false,
    };
  }, [initial]);

  // Compute effective department IDs from analytics filters
  const allDepartmentIds = useMemo(
    () => analyticsFilters?.department_options?.map((o) => o.value) ?? [],
    [analyticsFilters]
  );
  const effectiveDepartmentIds = useMemo(() => {
    return selectedDepartmentIds.length > 0
      ? selectedDepartmentIds
      : allDepartmentIds;
  }, [selectedDepartmentIds, allDepartmentIds]);

  const navigateToDefault = useCallback(
    (role: ProfileRole) => {
      const availableSections = initial?.available_sections ?? [];
      const defaultSection =
        availableSections.length > 0
          ? availableSections[0]
          : "home";
      // Use redirect_path from server if available, otherwise construct from section
      const route = initial?.redirect_path || `/${defaultSection}`;
      router.push(route);
    },
    [router, pathname, initial?.available_sections]
  );

  const isSectionAvailable = useCallback(
    (section: string, role?: ProfileRole) => {
      const availableSections = initial?.available_sections ?? [];
      return availableSections.includes(section);
    },
    [profile?.role, initial?.available_sections]
  );

  const value: ProfileContextType = {
    // Profile data
    profile,
    isLoading: false, // Data comes from server, always available
    isAuthenticated: sessionSnapshot.isAuthenticated,

    // Helper functions
    navigateToDefault,
    isSectionAvailable,

    // Layout data (from server) - handle null initial gracefully
    departmentIds: allDepartmentIds,
    selectedDepartmentIds,
    setSelectedDepartmentIds,
    effectiveDepartmentIds,
    cohortIds: analyticsFilters?.cohort_options?.map((o) => o.value) ?? [],

    // Analytics filters (from server — per-page filter config + options)
    analyticsFilters: analyticsFilters ?? null,

    // Permissions data (from server)
    availableSections: initial?.available_sections ?? [],
    availableRoutes: initial?.available_routes ?? [],
    redirectPath: initial?.redirect_path ?? "/home",
    scopedRoles: initial?.scoped_roles ?? [],
    roleResources: initial?.role_resources ?? [],
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
