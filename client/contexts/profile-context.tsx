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
  LayoutContextOut,
  SafeSessionSnapshot,
} from "@/app/(main)/layout-server";
import { createSocketClient } from "@/lib/ws/socket";
import type { ServerToClientEvents } from "@/lib/ws/types";
import {
  getFirstAvailableSectionForRole,
  getSectionRoute,
  isSectionAvailableForRole,
} from "@/utils/navigation-utils";
import { usePathname, useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Socket } from "socket.io-client";
import { toast } from "sonner";

type ProfileRole =
  | "superadmin"
  | "admin"
  | "instructional"
  | "member"
  | "guest";

// Use types from server response
// ProfileItem is constructed from flat fields in LayoutContextResponse
// Actual profile uses actual_* fields, effective profile uses unprefixed fields
type ProfileItem = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  emails: string[];
  primary_email: string | null;
  role: string;
  active: boolean;
  req_per_day: number | null;
  last_login: string | null;
  last_active: string | null;
  created_at: string | null;
  updated_at: string | null;
  primary_department_id: string | null;
};

// ============================================================================
// TYPES (derived from LayoutContextResponse)
// ============================================================================

export type DepartmentItem = LayoutContextResponse["departments"][number];
export type CohortItem = LayoutContextResponse["cohorts"][number];
export type SimulationContextItem =
  LayoutContextResponse["simulations"][number];

// Note: With server-side access control, users without valid sessions won't reach pages
// (they see UnifiedAccessDenied). However, we handle null profiles gracefully for
// edge cases, loading states, and WebSocket connections that may legitimately use null profileId.

interface ProfileContextType {
  // Profile data
  activeProfile: ProfileItem | null;
  simulatedProfile: ProfileItem | null;
  effectiveProfile: ProfileItem | null;
  isSimulating: boolean;
  isFullEmulation: boolean;
  isLoading: boolean;
  isAuthenticated: boolean; // true if user has real NextAuth session

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
  earliestAttemptDate: string | null;

  // Permissions data (from server)
  availableSections: string[];
  redirectPath: string;
  scopedRoles: string[]; // Roles that the effective profile has scope to see

  // Settings data (from server)
  settings: LayoutContextResponse["settings"] | null;

  // WebSocket connection (tied to profile)
  socket: Socket | null;
  isConnected: boolean;
  startingSimulationId: string | null;
  startingEvalId: string | null;
  setStartingEvalId: ((evalId: string | null) => void) | null;

  // WebSocket helper methods
  emitStartSimulation: (data: {
    simulation_id: string;
    profile_id?: string | null;
    scenario_id?: string | null;
    infinite?: boolean;
    infinite_time_limit?: number | null;
  }) => void;
  emitCreatePracticeScenario: (data: {
    persona_id?: string | null;
    parameter_item_ids?: string[];
    department_id?: string | null;
    infinite_mode?: boolean;
    infinite_time_limit?: number | null;
    simulation_id?: string | null;
    profile_id?: string | null;
  }) => void;
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
  // Use LayoutContextOut directly from OutputOf - it matches API response exactly (snake_case)
  // No need for manual type assertions - OpenAPI types are generated from server schema
  initial: LayoutContextOut | null; // Can be null if user doesn't have access
  sessionSnapshot: SafeSessionSnapshot;
}

export function ProfileProviderClient({
  children,
  initial,
  sessionSnapshot,
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
  // Construct profile objects from flat fields in LayoutContextOut
  const bootstrapProfile: ProfileItem | null = initial
    ? {
        id: initial.actual_id ?? "",
        first_name: initial.actual_first_name ?? null,
        last_name: initial.actual_last_name ?? null,
        emails: initial.actual_emails ?? [],
        primary_email: initial.actual_primary_email ?? null,
        role: initial.actual_role ?? "guest",
        active: initial.actual_active ?? false,
        req_per_day: initial.actual_req_per_day ?? null,
        last_login: initial.actual_last_login ?? null,
        last_active: initial.actual_last_active ?? null,
        created_at: initial.actual_created_at ?? null,
        updated_at: initial.actual_updated_at ?? null,
        primary_department_id: initial.actual_primary_department_id ?? null,
      }
    : null;
  const effectiveProfile: ProfileItem | null = initial
    ? {
        id: initial.id ?? "",
        first_name: initial.first_name ?? null,
        last_name: initial.last_name ?? null,
        emails: initial.emails ?? [],
        primary_email: initial.primary_email ?? null,
        role: initial.role ?? "guest",
        active: initial.active ?? false,
        req_per_day: initial.req_per_day ?? null,
        last_login: initial.last_login ?? null,
        last_active: initial.last_active ?? null,
        created_at: initial.created_at ?? null,
        updated_at: initial.updated_at ?? null,
        primary_department_id: initial.primary_department_id ?? null,
      }
    : null;

  // WebSocket connection state
  const [isConnected, setIsConnected] = useState(false);
  const [startingSimulationId, setStartingSimulationId] = useState<
    string | null
  >(null);
  const [startingEvalId, setStartingEvalId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 5;
  const currentRoomsRef = useRef<Set<string>>(new Set());

  // Get profile ID for socket connection
  const profileId = effectiveProfile?.id ?? null;

  // Initialize WebSocket connection when profileId is resolved
  // Note: profileId may be null for legitimate guest connections (e.g., practice page with guest role)
  useEffect(() => {
    // Capture current rooms at effect creation time for cleanup
    const roomsToCleanup = currentRoomsRef.current;

    // Clean up existing socket if profile changes
    if (socketRef.current) {
      roomsToCleanup.forEach((roomId) => {
        socketRef.current?.emit("simulation_leave", {
          chat_id: roomId,
          chat_type: "any",
        });
      });
      roomsToCleanup.clear();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }

    const connectWebSocket = async () => {
      const query: Record<string, string | number | undefined> = {
        timestamp: Date.now(),
        EIO: "4",
      };
      if (profileId) {
        query["profileId"] = profileId;
      }

      const socket = await createSocketClient(query);

      socketRef.current = socket;

      socket.on("connect", () => {
        setIsConnected(true);
        connectionAttempts.current = 0;
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
      });

      socket.on("connect_error", (_error: Error) => {
        connectionAttempts.current++;
        setIsConnected(false);

        if (connectionAttempts.current >= maxConnectionAttempts) {
          toast.error(
            "Unable to connect to real-time updates. Some features may be limited."
          );
        }
      });

      // Set up event handlers for simulation tracking
      // Note: Socket.IO server-to-client events use requestBody as payload
      // Listen for simulations_started event (used by start.py)
      socket.on(
        "simulations_started",
        (
          data: Parameters<ServerToClientEvents["simulations_started"]>[0]
        ) => {
          setStartingSimulationId(null);
          if (data.success) {
            toast.success(data.message);
            window.dispatchEvent(
              new CustomEvent("simulationStarted", {
                detail: { attemptId: data.attempt_id },
              })
            );
          } else {
            toast.error(data.message);
          }
        }
      );

      // Listen for simulation start errors (used by start.py, replaces practice errors)
      socket.on(
        "simulations_start_error",
        (
          data: Parameters<ServerToClientEvents["simulations_start_error"]>[0]
        ) => {
          setStartingSimulationId(null);
          toast.error(data.message);
          window.dispatchEvent(new CustomEvent("simulationError"));
        }
      );
    };

    connectWebSocket();

    return () => {
      if (socketRef.current) {
        // Leave all rooms before disconnecting using captured rooms
        roomsToCleanup.forEach((roomId) => {
          socketRef.current?.emit("simulation_leave", {
            chat_id: roomId,
            chat_type: "any",
          });
        });
        roomsToCleanup.clear();

        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [profileId]);

  // Compute effective department IDs (like cohorts in Home.tsx)
  const effectiveDepartmentIds = useMemo(() => {
    const allDepartmentIds = initial?.departmentIds ?? [];
    return selectedDepartmentIds.length > 0
      ? selectedDepartmentIds
      : allDepartmentIds;
  }, [selectedDepartmentIds, initial?.departmentIds]);

  // Determine if we're in full emulation mode (when "Emulate" button was pressed)
  const isFullEmulation = useMemo(() => {
    return Boolean(
      bootstrapProfile &&
        effectiveProfile &&
        effectiveProfile.id !== bootstrapProfile.id &&
        sessionSnapshot.emulationTTL &&
        sessionSnapshot.fullEmulation
    );
  }, [
    bootstrapProfile,
    effectiveProfile,
    sessionSnapshot.emulationTTL,
    sessionSnapshot.fullEmulation,
  ]);

  const resolvedActiveProfile = useMemo<ProfileItem | null>(() => {
    // With server-side access control, if bootstrapProfile is null, user shouldn't be here
    // (handled by layout). However, handle null gracefully for edge cases.
    if (!bootstrapProfile) return null;

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

  // WebSocket helper methods
  const emitStartSimulation = useCallback(
    (data: {
      simulation_id: string;
      profile_id?: string | null;
      scenario_id?: string | null;
      infinite?: boolean;
      infinite_time_limit?: number | null;
    }) => {
      if (!socketRef.current || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      const payload = {
        simulation_id: data.simulation_id,
        ...(data.scenario_id !== undefined && {
          scenario_id: data.scenario_id,
        }),
        ...(data.infinite !== undefined && { infinite: data.infinite }),
        ...(data.infinite_time_limit !== undefined && {
          infinite_time_limit: data.infinite_time_limit,
        }),
      };
      if (data.profile_id) {
        payload.profile_id = data.profile_id;
      }

      setStartingSimulationId(data.simulation_id);
      socketRef.current.emit("simulation_start", payload);
    },
    [isConnected]
  );

  const emitCreatePracticeScenario = useCallback(
    (data: {
      persona_id?: string | null;
      parameter_item_ids?: string[];
      department_id?: string | null;
      infinite_mode?: boolean;
      infinite_time_limit?: number | null;
      simulation_id?: string | null;
      profile_id?: string | null;
    }) => {
      if (!socketRef.current || !isConnected) {
        toast.error("WebSocket not connected. Please refresh the page.");
        return;
      }
      // Convert practice payload to start simulation payload with practice_mode=True
      const payload: Record<string, unknown> = {
        practice_mode: true,
        ...(data.profile_id ? { profile_id: data.profile_id } : {}),
      };
      if (data.persona_id !== undefined && data.persona_id !== null) {
        payload["practice_persona_id"] = data.persona_id;
      }
      if (data.parameter_item_ids !== undefined) {
        payload["practice_parameter_item_ids"] = data.parameter_item_ids;
      }
      if (data.department_id !== undefined && data.department_id !== null) {
        payload["practice_department_id"] = data.department_id;
      }
      if (data.infinite_mode !== undefined) {
        payload["infinite"] = data.infinite_mode;
      }
      // Note: simulation_id is optional in practice mode (will be found by server)

      socketRef.current.emit("simulation_start", payload);
    },
    [isConnected]
  );

  // #region agent log
  React.useEffect(() => {
    fetch("http://127.0.0.1:7242/ingest/c8b3b631-8d97-43e2-acb2-6df2c63b5121", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "profile-context.tsx:416",
        message: "Profile context value computed",
        data: {
          hasInitial: !!initial,
          hasEffectiveProfile: !!effectiveProfile,
          hasResolvedActiveProfile: !!resolvedActiveProfile,
          effectiveProfileId: effectiveProfile?.id,
          resolvedActiveProfileId: resolvedActiveProfile?.id,
          bootstrapProfileId: bootstrapProfile?.id,
          initialKeys: initial ? Object.keys(initial).filter(k => k.includes('section') || k.includes('redirect') || k.includes('scoped')) : [],
          availableSectionsCamel: (initial as any)?.availableSections,
          availableSectionsSnake: (initial as any)?.available_sections,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run9",
        hypothesisId: "L",
      }),
    }).catch(() => {});
  }, [initial, effectiveProfile, resolvedActiveProfile, bootstrapProfile]);
  // #endregion

  const value: ProfileContextType = {
    // Profile data
    activeProfile: resolvedActiveProfile,
    simulatedProfile,
    effectiveProfile: effectiveProfile ?? resolvedActiveProfile ?? null,
    isSimulating: !!(
      bootstrapProfile &&
      effectiveProfile &&
      effectiveProfile.id !== bootstrapProfile.id
    ),
    isFullEmulation,
    isLoading: false, // Data comes from server, always available
    isAuthenticated: sessionSnapshot.isAuthenticated,

    // Helper functions
    navigateToDefault,
    isSectionAvailable,

    // Layout data (from server) - handle null initial gracefully
    departments: initial?.departments ?? [],
    departmentIds: initial?.departmentIds ?? [],
    selectedDepartmentIds,
    setSelectedDepartmentIds,
    effectiveDepartmentIds,
    cohorts: initial?.cohorts ?? [], // Arrays directly (no .items property)
    cohortIds: initial?.cohortIds ?? [],
    simulations: initial?.simulations ?? [], // Arrays directly (no .items property)
    simulationIds: initial?.simulationIds ?? [],
    cohortMemberCounts: {}, // TODO: Compute from cohorts array if needed
    earliestAttemptDate: initial?.earliestAttemptDate ?? null,

    // Permissions data (from server) - handle null initial gracefully
    // LayoutContextOut uses snake_case fields matching API response exactly (from OpenAPI schema)
    // No type assertions needed - types are auto-generated from server schema
    availableSections: initial?.available_sections ?? [],
    redirectPath: initial?.redirect_path ?? "/home",
    scopedRoles: initial?.scoped_roles ?? [],

    // Settings data (from server) - handle null initial gracefully
    settings: initial?.settings ?? null,

    // WebSocket connection (tied to profile)
    socket: socketRef.current,
    isConnected,
    startingSimulationId,
    startingEvalId,
    setStartingEvalId,
    emitStartSimulation,
    emitCreatePracticeScenario,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
