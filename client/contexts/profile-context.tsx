/**
 * Profile Context for managing the active user profile across the application.
 * Provides identity, permissions, and role data.
 *
 * Note: Analytics filters, drafts, and group state are now per-page concerns,
 * not layout-level. Each page fetches its own facets from its endpoint.
 */
"use client";

import type {
  AuthProfileResponse,
  ProfileItem,
  SafeSessionSnapshot,
} from "@/app/(main)/layout-server";
import React, {
  createContext,
  useContext,
  useMemo,
} from "react";

// ============================================================================
// TYPES
// ============================================================================

export type RoleResourceItem = NonNullable<
  AuthProfileResponse["role_resources"]
>[number];

interface ProfileContextType {
  // Profile data
  profile: ProfileItem | null;
  isAuthenticated: boolean; // true if user has real NextAuth session

  // Permissions data (from server)
  availableSections: string[];
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
}

export function ProfileProviderClient({
  children,
  initial,
  sessionSnapshot,
}: ProfileProviderClientProps) {
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

  const value: ProfileContextType = {
    // Profile data
    profile,
    isAuthenticated: sessionSnapshot.isAuthenticated,

    // Permissions data (from server)
    availableSections: initial?.available_sections ?? [],
    scopedRoles: initial?.scoped_roles ?? [],
    roleResources: initial?.role_resources ?? [],
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
