/**
 * Profile Context for managing the active user profile across the application.
 * Provides identity, permissions, department filters, and analytics filter state.
 * Uses SSR + Server Actions pattern (no React Query).
 */
"use client";

import type {
  AnalyticsFiltersResponse,
  AuthProfileResponse,
  ProfileItem,
  SafeSessionSnapshot,
} from "@/app/(main)/layout-server";
import React, {
  createContext,
  useContext,
  useMemo,
  useState,
} from "react";

// ============================================================================
// TYPES
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
  isAuthenticated: boolean; // true if user has real NextAuth session

  // Layout data
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
  // Department filter state
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>(
    []
  );

  // Handle null initial (access denied case) - with server-side access control,
  // users without valid sessions won't reach pages (they see UnifiedAccessDenied).
  // However, we handle null gracefully for edge cases and loading states.
  // Construct profile from AuthProfileResponse
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

  const value: ProfileContextType = {
    // Profile data
    profile,
    isAuthenticated: sessionSnapshot.isAuthenticated,

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
