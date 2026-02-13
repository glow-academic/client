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
  ProfileItem,
  SafeSessionSnapshot,
  SettingsActiveClient,
} from "@/app/(main)/layout-server";
import { createSocketClient } from "@/lib/ws/socket";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/ws/types";
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
  | "guest"
  | "custom";

// ============================================================================
// TYPES (derived from LayoutContextResponse)
// ============================================================================

export type DepartmentItem = NonNullable<
  LayoutContextResponse["departments"]
>[number];
export type CohortItem = NonNullable<LayoutContextResponse["cohorts"]>[number];
export type SimulationContextItem = NonNullable<
  LayoutContextResponse["simulations"]
>[number];
export type DraftItem = NonNullable<LayoutContextResponse["drafts"]>[number];
export type RoleResourceItem = NonNullable<
  LayoutContextResponse["role_resources"]
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
  availableRoutes: string[];
  redirectPath: string;
  scopedRoles: string[]; // Roles that the effective profile has scope to see
  roleResources: RoleResourceItem[];

  // Settings data (from server)
  // Note: Settings are stored as flat fields (settings_*) in LayoutContextResponse
  // The layout-server.tsx transforms these into a nested SettingsActiveClient object
  // Currently not used in profile context, but available for future use
  settings: SettingsActiveClient | null;

  // Drafts data (from server)
  drafts: DraftItem[];
  selectedDraftId: string | null;
  setSelectedDraftId: (id: string | null) => void;

  // WebSocket connection (tied to profile)
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;

  // Artifact generation capability flags (from profile context SSR)
  artifactHasGeneration: Record<string, boolean>;

  // Server-driven routing data
  sidebarRoutes: LayoutContextResponse["sidebar_routes"];
  breadcrumbs: LayoutContextResponse["breadcrumbs"];
  pageAccess: LayoutContextResponse["page_access"];
  pageMetadata: LayoutContextResponse["page_metadata"];
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
  // Use LayoutContextResponse directly from OutputOf - it matches API response exactly (snake_case)
  // No need for manual type assertions - OpenAPI types are generated from server schema
  initial: LayoutContextResponse | null; // Can be null if user doesn't have access
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

  // Draft state
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);

  // Handle null initial (access denied case) - with server-side access control,
  // users without valid sessions won't reach pages (they see UnifiedAccessDenied).
  // However, we handle null gracefully for edge cases and loading states.
  // Construct profile objects from flat fields in LayoutContextResponse
  const profile = useMemo<ProfileItem | null>(() => {
    if (!initial) return null;
    return {
      id: initial.id ?? "",
      name: initial.name ?? null,
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
    };
  }, [initial]);

  // WebSocket connection state
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const connectionAttempts = useRef(0);
  const maxConnectionAttempts = 5;
  const currentRoomsRef = useRef<Set<string>>(new Set());

  // Get profile ID and session ID for socket connection
  const profileId = profile?.id ?? null;
  const sessionId = initial?.session_id ?? null;

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
      if (sessionId) {
        query["sessionId"] = sessionId;
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
    const allDepartmentIds = initial?.department_ids ?? [];
    return selectedDepartmentIds.length > 0
      ? selectedDepartmentIds
      : allDepartmentIds;
  }, [selectedDepartmentIds, initial?.department_ids]);

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
    departments: initial?.departments ?? [],
    departmentIds: initial?.department_ids ?? [],
    selectedDepartmentIds,
    setSelectedDepartmentIds,
    effectiveDepartmentIds,
    cohorts: initial?.cohorts ?? [], // Arrays directly (no .items property)
    cohortIds: initial?.cohort_ids ?? [],
    simulations: initial?.simulations ?? [], // Arrays directly (no .items property)
    simulationIds: initial?.simulation_ids ?? [],
    cohortMemberCounts: {}, // TODO: Compute from cohorts array if needed
    earliestAttemptDate: initial?.earliest_attempt_date ?? null,

    // Permissions data (from server) - handle null initial gracefully
    // LayoutContextResponse uses snake_case fields matching API response exactly (from OpenAPI schema)
    // No type assertions needed - types are auto-generated from server schema
    availableSections: initial?.available_sections ?? [],
    availableRoutes: initial?.available_routes ?? [],
    redirectPath: initial?.redirect_path ?? "/home",
    scopedRoles: initial?.scoped_roles ?? [],
    roleResources: initial?.role_resources ?? [],

    // Settings data (from server) - handle null initial gracefully
    // Note: Settings are stored as flat fields (settings_*) in LayoutContextResponse
    // The layout-server.tsx transforms these into a nested SettingsActiveClient object
    // Currently not used in profile context, but available for future use
    settings: null,

    // Drafts data (from server) - handle null initial gracefully
    drafts: initial?.drafts ?? [],
    selectedDraftId,
    setSelectedDraftId,

    // WebSocket connection (tied to profile)
    socket: socketRef.current,
    isConnected,

    // Artifact agent IDs for generation capability (from profile context SSR)
    artifactHasGeneration: initial?.artifact_has_generation ?? {},

    // Server-driven routing data
    sidebarRoutes: initial?.sidebar_routes ?? null,
    breadcrumbs: initial?.breadcrumbs ?? null,
    pageAccess: initial?.page_access ?? null,
    pageMetadata: initial?.page_metadata ?? null,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
