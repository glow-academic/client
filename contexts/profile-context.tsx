/**
 * Profile Context for managing the active user profile across the application.
 * Provides identity, permissions, and role data.
 *
 * Note: Analytics filters, drafts, and group state are now per-page concerns,
 * not layout-level. Each page fetches its own facets from its endpoint.
 */
"use client";

import type { components } from "@/lib/api/schema";
import type { SafeSessionSnapshot } from "@/lib/auth";
import React, {
  createContext,
  useContext,
  useMemo,
} from "react";

// ============================================================================
// TYPES
// ============================================================================

/** Profile data from /{artifact}/context → .profile (ProfileSummary). */
export type ContextProfile = components["schemas"]["ProfileSummary"];

export type RoleResourceItem = NonNullable<
  ContextProfile["role_resources"]
>[number];

export type ProfileItem = Pick<ContextProfile, "id" | "name" | "role" | "active">;

interface ProfileContextType {
  // Profile data
  profile: ProfileItem | null;
  isAuthenticated: boolean; // true if user has real NextAuth session
  isEmulation: boolean; // true if viewing as another profile

  // Permissions data (from server)
  roleArtifacts: string[];
  rolePermissions: [string, string][]; // Full (artifact, operation) tuples for granular gating
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
  initial: ContextProfile | null;
  sessionSnapshot: SafeSessionSnapshot;
}

export function ProfileProviderClient({
  children,
  initial,
  sessionSnapshot,
}: ProfileProviderClientProps) {
  // Construct profile from ProfileSummary
  const profile = useMemo<ProfileItem | null>(() => {
    if (!initial) return null;
    return {
      id: initial.id ?? "",
      name: initial.name ?? "",
      role: initial.role ?? "guest",
      active: initial.active ?? false,
    };
  }, [initial]);

  const value: ProfileContextType = {
    // Profile data
    profile,
    isAuthenticated: sessionSnapshot.isAuthenticated,
    isEmulation: !!initial?.is_emulation,

    // Permissions data (from server)
    roleArtifacts: initial?.artifact_access ?? [],
    rolePermissions: (initial?.role_permissions ?? []) as [string, string][],
    scopedRoles: initial?.scoped_roles ?? [],
    roleResources: initial?.role_resources ?? [],
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
