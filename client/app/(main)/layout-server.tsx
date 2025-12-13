/**
 * Server component that fetches profile context data
 */
"use server";
import { getSession, update } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { headers } from "next/headers";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LayoutContextIn = InputOf<"/api/v3/profile/context", "post">;
type LayoutContextOut = OutputOf<"/api/v3/profile/context", "post">;
type AuthorizeEmulationIn = InputOf<
  "/api/v3/profile/authorize-emulation",
  "post"
>;
type AuthorizeEmulationOut = OutputOf<
  "/api/v3/profile/authorize-emulation",
  "post"
>;
type CreateFeedbackIn = InputOf<"/api/v3/feedback/create", "post">;
type CreateFeedbackOut = OutputOf<"/api/v3/feedback/create", "post">;
type RefreshAnalyticsIn = InputOf<"/api/v3/analytics/refresh", "post">;
type RefreshAnalyticsOut = OutputOf<"/api/v3/analytics/refresh", "post">;
type AttemptFullIn = InputOf<"/api/v3/attempts/full", "post">;
type AttemptFullOut = OutputOf<"/api/v3/attempts/full", "post">;
type SearchSimulatableProfilesIn = InputOf<
  "/api/v3/profile/search-simulatable-profiles",
  "post"
>;
type SearchSimulatableProfilesOut = OutputOf<
  "/api/v3/profile/search-simulatable-profiles",
  "post"
>;
type SearchStaffIn = InputOf<"/api/v3/profile/staff/search-staff", "post">;
type SearchStaffOut = OutputOf<"/api/v3/profile/staff/search-staff", "post">;
type CreateStaffDataIn = InputOf<
  "/api/v3/profile/staff/create-staff-data",
  "post"
>;
type CreateStaffDataOut = OutputOf<
  "/api/v3/profile/staff/create-staff-data",
  "post"
>;
type ProcessCSVIn = InputOf<"/api/v3/profile/staff/process-csv", "post">;
type ProcessCSVOut = OutputOf<"/api/v3/profile/staff/process-csv", "post">;
type BulkCreateOrUpdateStaffIn = InputOf<
  "/api/v3/profile/staff/bulk-create-or-update-staff",
  "post"
>;
type BulkCreateOrUpdateStaffOut = OutputOf<
  "/api/v3/profile/staff/bulk-create-or-update-staff",
  "post"
>;
type SettingsActiveIn = InputOf<"/api/v3/settings/active", "post">;
type SettingsActiveOut = OutputOf<"/api/v3/settings/active", "post">;

/** ---- Client-side settings type (excludes guestProfileId) ----
 * guestProfileId is server-side only and should not be exposed to client components
 */
export type SettingsActiveClient = Omit<SettingsActiveOut, "guestProfileId">;

/** ---- Cached fetch ---- */
const getLayoutContext = cache(
  async (input: LayoutContextIn): Promise<LayoutContextOut> => {
    return api.post("/profile/context", input);
  }
);

const getActiveSettings = cache(
  async (input: SettingsActiveIn): Promise<SettingsActiveOut> => {
    return api.post("/settings/active", input);
  }
);

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for websocket/attempt pages.
 */
const getAttemptFull = async (
  _attemptId: string,
  input: AttemptFullIn
): Promise<AttemptFullOut> => {
  return api.post("/attempts/full", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Export type for client (type-only imports) ---- */
export type LayoutContextResponse = LayoutContextOut;

// Export ProfileItem type derived from server response
export type ProfileItem = LayoutContextResponse["actualProfile"];

export type SafeSessionSnapshot = {
  effectiveProfileId: string | null;
  fullEmulation: boolean;
  emulationTTL: number | null;
};

export async function getLayoutContextData() {
  const session = await getSession();

  const snapshot: SafeSessionSnapshot = {
    effectiveProfileId: session?.effectiveProfileId ?? null,
    fullEmulation: !!session?.fullEmulation,
    emulationTTL: session?.emulationTTL ?? null,
  };

  // CRITICAL: Fetch settings FIRST to get guest profile ID
  // This ensures we always have a valid UUID before making other API calls
  let activeSettings: SettingsActiveOut | null = null;
  let guestProfileId: string | null = null;

  try {
    // Use null or empty string for unauthenticated users (not "guest-profile-id")
    // Empty string is preferred to avoid type ambiguity in SQL
    const settingsProfileId = session?.effectiveProfileId || null;
    activeSettings = await getActiveSettings({
      body: { profileId: settingsProfileId },
    });
    guestProfileId = activeSettings?.guestProfileId || null;
  } catch {
    // If settings fetch fails, just continue without settings data
    // This can happen if no active settings exist
    activeSettings = null;
  }

  // Resolve profile IDs: use guestProfileId or defaultAccountProfileId from settings if session IDs are null/empty
  // Check for default account mode first (stored in localStorage, but we can't access it server-side)
  // So we'll check for it in requireAuth() instead
  const effectiveProfileIdRaw = session?.effectiveProfileId || null;
  const actualProfileIdRaw = session?.user?.profileId || null;

  // For now, use guestProfileId as fallback (default account will be handled in requireAuth)
  const effectiveProfileId = effectiveProfileIdRaw || guestProfileId;
  const actualProfileId = actualProfileIdRaw || guestProfileId;

  // If we still don't have valid IDs, return early with null initial
  // This allows the layout to handle access denied gracefully
  if (!effectiveProfileId || !actualProfileId) {
    // Extract guestProfileId before passing to client (server-side only)
    const { guestProfileId: _, ...settingsWithoutGuest } = activeSettings || {};
    return {
      initial: null,
      snapshot,
      attemptData: null,
      activeSettings: settingsWithoutGuest as SettingsActiveClient | null,
    };
  }

  // Now fetch profile context with resolved UUIDs (no string literals)
  // Let errors propagate - if user doesn't have access, endpoint will return 403/404
  let initial: LayoutContextOut | null = null;
  try {
    initial = await getLayoutContext({
      body: {
        actualProfileId,
        effectiveProfileId,
        pathname: "/", // layout-level; pages can still supply their own on demand
      },
    });
  } catch {
    // If context fetch fails (e.g., 403/404), return null
    // Layout will handle access denied via AccessControl component
    initial = null;
  }

  // Read pathname from headers to check if we're on an attempt page
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  // Extract attemptId from pathname if we're on an attempt page
  const attemptMatch =
    pathname.match(/\/home\/a\/([^/]+)/) ||
    pathname.match(/\/practice\/a\/([^/]+)/);
  const attemptId = attemptMatch ? attemptMatch[1] : null;

  // Fetch attempt data if we have an attemptId (using resolved UUID)
  let attemptData: AttemptFullOut | null = null;
  if (attemptId && effectiveProfileId) {
    try {
      attemptData = await getAttemptFull(attemptId, {
        body: { attemptId, profileId: effectiveProfileId },
      });
    } catch {
      // If attempt fetch fails, just continue without attempt data
      // This can happen if the attempt doesn't exist or user doesn't have access
      attemptData = null;
    }
  }

  // Extract guestProfileId before passing to client (server-side only)
  const { guestProfileId: _, ...settingsWithoutGuest } = activeSettings || {};
  const activeSettingsClient: SettingsActiveClient | null = activeSettings
    ? (settingsWithoutGuest as SettingsActiveClient)
    : null;

  return {
    initial,
    snapshot,
    attemptData,
    activeSettings: activeSettingsClient,
  };
}

/** ---- Strongly-typed server actions for Session Management (single source of truth) ---- */
type SwitchEffectiveProfileParams = {
  targetProfileId: string;
  fullEmulation?: boolean;
  emulationTTL?: number | null;
};

type SwitchEffectiveProfileResult = {
  ok: boolean;
  reason?: string;
};

async function authorizeEmulation(
  input: AuthorizeEmulationIn
): Promise<AuthorizeEmulationOut> {
  return api.post("/profile/authorize-emulation", input);
}

/**
 * Server action to switch the effective profile in the session.
 * This replaces client-side useSession().update() calls.
 * Uses server-side session mutation via NextAuth's unstable_update.
 */
export async function switchEffectiveProfile(
  input: SwitchEffectiveProfileParams
): Promise<SwitchEffectiveProfileResult> {
  try {
    const session = await getSession();
    if (!session?.user?.profileId) {
      return { ok: false, reason: "Unauthorized" };
    }

    const isSelf = input.targetProfileId === session.user.profileId;

    if (!isSelf) {
      const res = await authorizeEmulation({
        body: {
          requesterProfileId: session.user.profileId,
          targetProfileId: input.targetProfileId,
        },
      });

      if (!res.allowed) {
        return { ok: false, reason: res.reason ?? "Emulation not allowed" };
      }
    }

    // Update session server-side
    await update({
      effectiveProfileId: input.targetProfileId,
      fullEmulation: !!input.fullEmulation && !isSelf,
      emulationTTL: isSelf
        ? null
        : (input.emulationTTL ?? Date.now() + 2 * 60 * 60 * 1000),
    });

    return { ok: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: errorMessage };
  }
}

/** ---- Strongly-typed server actions for Feedback (single source of truth) ---- */
export async function createFeedback(
  input: CreateFeedbackIn
): Promise<CreateFeedbackOut> {
  return api.post("/feedback/create", input);
}

/** ---- Strongly-typed server actions for Analytics (single source of truth) ---- */
export async function refreshAnalytics(
  input: RefreshAnalyticsIn
): Promise<RefreshAnalyticsOut> {
  return api.post("/analytics/refresh", input);
}

/** ---- Strongly-typed server actions for Profile Emulation (single source of truth) ---- */
export async function searchSimulatableProfiles(
  input: SearchSimulatableProfilesIn
): Promise<SearchSimulatableProfilesOut> {
  return api.post("/profile/search-simulatable-profiles", input);
}

/** ---- Strongly-typed server actions for Staff (single source of truth) ---- */
export async function searchStaff(
  input: SearchStaffIn
): Promise<SearchStaffOut> {
  "use server";
  return api.post("/profile/staff/search-staff", input);
}

export async function getCreateStaffData(
  input: CreateStaffDataIn
): Promise<CreateStaffDataOut> {
  "use server";
  return api.post("/profile/staff/create-staff-data", input);
}

export async function processCSV(input: ProcessCSVIn): Promise<ProcessCSVOut> {
  "use server";
  return api.post("/profile/staff/process-csv", input);
}

export async function bulkCreateOrUpdateStaff(
  input: BulkCreateOrUpdateStaffIn
): Promise<BulkCreateOrUpdateStaffOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/profile/staff/bulk-create-or-update-staff", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AttemptFullIn,
  AttemptFullOut,
  BulkCreateOrUpdateStaffIn,
  BulkCreateOrUpdateStaffOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  CreateStaffDataIn,
  CreateStaffDataOut,
  ProcessCSVIn,
  ProcessCSVOut,
  RefreshAnalyticsIn,
  RefreshAnalyticsOut,
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SearchStaffIn,
  SearchStaffOut,
  SettingsActiveIn,
  SettingsActiveOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
};
