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
  LayoutContextResponse,
  SafeSessionSnapshot,
} from "@/app/(main)/layout-server";
import { createSocketClient } from "@/lib/ws/socket";
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
import { v4 as uuidv4 } from "uuid";

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
  emails: ["redacted@purdue.edu"],
  primaryEmail: "redacted@purdue.edu",
  role: "guest",
  active: true,
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
  earliestAttemptDate: string | null;

  // Permissions data (from server)
  availableSections: string[];
  redirectPath: string;
  scopedRoles: string[]; // Roles that the effective profile has scope to see

  // WebSocket connection (tied to profile)
  socket: Socket | null;
  isConnected: boolean;
  startingSimulationId: string | null;

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
  initial: LayoutContextResponse;
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

  const bootstrapProfile = initial.actualProfile ?? null;
  const effectiveProfile = initial.effectiveProfile ?? null;

  // WebSocket connection state
  const [isConnected, setIsConnected] = useState(false);
  const [startingSimulationId, setStartingSimulationId] = useState<
    string | null
  >(null);
  const socketRef = useRef<Socket | null>(null);
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 5;
  const currentRoomsRef = useRef<Set<string>>(new Set());

  /**
   * Stable guest id (per tab) used when profileId === null.
   * Using sessionStorage lets us survive re-renders & soft navigations.
   */
  const guestIdRef = useRef<string | null>(null);
  if (guestIdRef.current === null) {
    if (typeof window !== "undefined") {
      const existing = sessionStorage.getItem("guest-id");
      guestIdRef.current = existing ?? uuidv4();
      if (!existing) sessionStorage.setItem("guest-id", guestIdRef.current);
    } else {
      guestIdRef.current = uuidv4();
    }
  }

  // Get profile ID for socket connection
  const profileId = effectiveProfile?.id ?? null;

  // Initialize WebSocket connection when profileId is resolved (may be null for guest)
  useEffect(() => {
    // Capture current rooms at effect creation time for cleanup
    const roomsToCleanup = currentRoomsRef.current;

    // Clean up existing socket if profile changes
    if (socketRef.current) {
      roomsToCleanup.forEach((roomId) => {
        socketRef.current?.emit("leave_chat", {
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
      } else {
        // guest mode
        query["guestId"] = guestIdRef.current!;
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
      socket.on(
        "simulation_started",
        (data: {
          success: boolean;
          message: string;
          attempt_id: string;
          chat_id: string;
        }) => {
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

      socket.on(
        "create_practice_scenario_error",
        (data: { success: boolean; message: string }) => {
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
          socketRef.current?.emit("leave_chat", {
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
    const allDepartmentIds = initial.departmentIds ?? [];
    return selectedDepartmentIds.length > 0
      ? selectedDepartmentIds
      : allDepartmentIds;
  }, [selectedDepartmentIds, initial.departmentIds]);

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
        profile_id: data.profile_id ?? "",
        ...(data.scenario_id !== undefined && {
          scenario_id: data.scenario_id,
        }),
        ...(data.infinite !== undefined && { infinite: data.infinite }),
        ...(data.infinite_time_limit !== undefined && {
          infinite_time_limit: data.infinite_time_limit,
        }),
      };

      setStartingSimulationId(data.simulation_id);
      socketRef.current.emit("start_simulation", payload);
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
      const payload: Record<string, unknown> = {
        profile_id: data.profile_id ?? "",
      };
      if (data.persona_id !== undefined && data.persona_id !== null) {
        payload["persona_id"] = data.persona_id;
      }
      if (data.parameter_item_ids !== undefined) {
        payload["parameter_item_ids"] = data.parameter_item_ids;
      }
      if (data.department_id !== undefined && data.department_id !== null) {
        payload["department_id"] = data.department_id;
      }
      if (data.infinite_mode !== undefined) {
        payload["infinite_mode"] = data.infinite_mode;
      }
      if (
        data.infinite_time_limit !== undefined &&
        data.infinite_time_limit !== null
      ) {
        payload["infinite_time_limit"] = data.infinite_time_limit;
      }
      if (data.simulation_id !== undefined && data.simulation_id !== null) {
        payload["simulation_id"] = data.simulation_id;
      }

      if (data.simulation_id) {
        setStartingSimulationId(data.simulation_id);
      }
      socketRef.current.emit("create_practice_scenario", payload);
    },
    [isConnected]
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
    earliestAttemptDate: initial.earliestAttemptDate ?? null,

    // Permissions data (from server)
    availableSections: initial.availableSections ?? [],
    redirectPath: initial.redirectPath ?? "/home",
    scopedRoles: initial.scopedRoles ?? [],

    // WebSocket connection (tied to profile)
    socket: socketRef.current,
    isConnected,
    startingSimulationId,
    emitStartSimulation,
    emitCreatePracticeScenario,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
