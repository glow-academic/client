/**
 * Server component that fetches profile context data
 */
"use server";
import { getSession } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Session } from "next-auth";
import { cookies, headers } from "next/headers";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LayoutContextIn = InputOf<"/api/v4/auth/context", "post">;
type LayoutContextOut = OutputOf<"/api/v4/auth/context", "post">;
type DraftsIn = InputOf<"/api/v4/auth/drafts", "post">;
type DraftsOut = OutputOf<"/api/v4/auth/drafts", "post">;
type AnalyticsFiltersOut = OutputOf<"/api/v4/auth/analytics", "post">;
type CreateEmulationGrantIn = InputOf<"/api/v4/auth/emulate", "post">;
type CreateEmulationGrantOut = OutputOf<"/api/v4/auth/emulate", "post">;
type CreateFeedbackIn = InputOf<"/api/v4/artifacts/activity/problem", "post">;
type CreateFeedbackOut = OutputOf<"/api/v4/artifacts/activity/problem", "post">;
/** Page-specific refresh endpoint mapping */
const REFRESH_ENDPOINT_MAP: Record<string, string> = {
  training: "/artifacts/training/refresh",
  dashboard: "/artifacts/dashboard/refresh",
  leaderboard: "/artifacts/leaderboard/refresh",
  reports: "/artifacts/reports/refresh",
  pricing: "/artifacts/pricing/refresh",
  benchmark: "/artifacts/benchmark/refresh",
  activity: "/artifacts/activity/refresh",
  health: "/artifacts/health/refresh",
};
type AttemptFullIn = InputOf<"/api/v4/artifacts/attempt/get", "post">;
type AttemptFullOut = OutputOf<"/api/v4/artifacts/attempt/get", "post">;
type SearchSimulatableProfilesIn = InputOf<"/api/v4/auth/simulatable", "post">;
type SearchSimulatableProfilesOut = OutputOf<
  "/api/v4/auth/simulatable",
  "post"
>;
type SearchStaffIn = InputOf<"/api/v4/artifacts/profiles/bulk/search", "post">;
type SearchStaffOut = OutputOf<"/api/v4/artifacts/profiles/bulk/search", "post">;
// Use profiles/get with null target_profile_id to get create staff data (replaces staff/data/create)
type GetProfileIn = InputOf<"/api/v4/artifacts/profiles/get", "post">;
type GetProfileOut = OutputOf<"/api/v4/artifacts/profiles/get", "post">;
type ProcessCSVIn = InputOf<"/api/v4/artifacts/profiles/bulk/process", "post">;
type ProcessCSVOut = OutputOf<"/api/v4/artifacts/profiles/bulk/process", "post">;
type BulkCreateOrUpdateStaffIn = InputOf<"/api/v4/artifacts/profiles/bulk/save", "post">;
type BulkCreateOrUpdateStaffOut = OutputOf<"/api/v4/artifacts/profiles/bulk/save", "post">;
/** ---- Client-side settings type (excludes guestProfileId) ----
 * guestProfileId is server-side only and should not be exposed to client components
 *
 * Transforms flat settings_* fields from API response into nested settings object
 * Uses inferred types from LayoutContextOut to ensure type safety
 */
type SettingsFields = Pick<
  LayoutContextOut,
  | "settings_id"
  | "settings_success_threshold"
  | "settings_warning_threshold"
  | "settings_danger_threshold"
  | "settings_tokens"
>;

// Transform settings_* fields to nested structure (remove settings_ prefix)
type TransformSettings<T> = {
  [K in keyof T as K extends `settings_${infer Rest}` ? Rest : never]: T[K];
};

type SettingsTransformed = TransformSettings<SettingsFields>;

// Add guestProfileId for server-side use, then omit it for client
type SettingsWithGuest = SettingsTransformed & {
  guestProfileId?: string | null; // Server-side only
};

export type SettingsActiveClient = Omit<SettingsWithGuest, "guestProfileId">;

/** ---- Cached fetch ---- */
export const getLayoutContext = cache(
  async (input: LayoutContextIn): Promise<LayoutContextOut> => {
    // Profile IDs are automatically injected via X-Profile-Id header
    // by request-core.ts, so we don't need to pass them in the body anymore.
    // The backend reads them from request.state (set by router-level dependencies).
    // We still accept them in the input for backward compatibility, but they're ignored.

    // Forward cookies from server action context to API request
    // This is needed because server actions run server-side and cookies aren't automatically forwarded
    const cookieStore = await cookies();
    const cookieHeader = [
      cookieStore.get("department-id")?.value &&
        `department-id=${cookieStore.get("department-id")?.value}`,
    ]
      .filter(Boolean)
      .join("; ");

    // Forward pathname so server can compute sidebar, breadcrumbs, page metadata
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "/";

    const extraHeaders: Record<string, string> = {};
    if (cookieHeader) extraHeaders["Cookie"] = cookieHeader;
    extraHeaders["X-Pathname"] = pathname;

    const result = await api.post(
      "/auth/context",
      input,
      { headers: extraHeaders }
    );

    return result;
  }
);

/** ---- Cached drafts fetch (parallel with context) ---- */
export const getDrafts = cache(
  async (): Promise<DraftsOut> => {
    return api.post("/auth/drafts", {} as DraftsIn);
  }
);

/** ---- Cached analytics filters fetch (parallel with context) ---- */
export const getAnalyticsFilters = cache(
  async (): Promise<AnalyticsFiltersOut | null> => {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "/";

    const cookieStore = await cookies();
    const extraHeaders: Record<string, string> = { "X-Pathname": pathname };
    const cookieHeader = [
      cookieStore.get("department-id")?.value &&
        `department-id=${cookieStore.get("department-id")?.value}`,
    ]
      .filter(Boolean)
      .join("; ");
    if (cookieHeader) extraHeaders["Cookie"] = cookieHeader;

    try {
      return await api.post(
        "/auth/analytics",
        {} as InputOf<"/api/v4/auth/analytics", "post">,
        { headers: extraHeaders }
      );
    } catch {
      return null;
    }
  }
);

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for websocket/attempt pages.
 */
const getAttemptFull = async (
  _attemptId: string,
  input: AttemptFullIn
): Promise<AttemptFullOut> => {
  return api.post("/artifacts/attempt/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Export type for client (type-only imports) ---- */
export type LayoutContextResponse = LayoutContextOut;
export type DraftsResponse = DraftsOut;
export type AnalyticsFiltersResponse = AnalyticsFiltersOut;

/** ---- Helper to get validated profile ID (reusable for API calls) ----
 * @param session - Optional session to reuse. If not provided, will fetch session.
 * @returns Object with profileId (can be null)
 */
export async function getValidatedProfileId(session?: Session | null): Promise<{
  profileId: string | null;
}> {
  const resolvedSession = session ?? (await getSession());

  // Extract profile ID from session (works for both real and pseudo-sessions)
  const profileId = resolvedSession?.user?.profileId || null;

  return { profileId };
}

// Export ProfileItem type derived from server response
// Extracts profile fields from LayoutContextOut (effective profile fields: id, name, etc.)
// Uses inferred types to ensure type safety
export type ProfileItem = Pick<
  LayoutContextOut,
  | "id"
  | "name"
  | "role"
  | "active"
>;

export type SafeSessionSnapshot = {
  profileId: string | null;
  isAuthenticated: boolean; // true if user has real NextAuth session
};

/**
 * Fetches layout context data for the main layout
 *
 * Handles both auth modes:
 * - Authenticated users: Real NextAuth session with id_token
 * - Guest users: Pseudo-session from cookies (no id_token)
 *
 * Returns null initial if user doesn't have valid session or access,
 * which triggers access denied UI in the layout.
 *
 * @param session - Optional session to reuse. If not provided, will fetch session.
 */
export async function getLayoutContextData(session?: Session | null) {
  const resolvedSession = session ?? (await getSession());

  // Create session snapshot with authentication status
  // isAuthenticated distinguishes real sessions (has id_token) from pseudo-sessions (no id_token)
  const snapshot: SafeSessionSnapshot = {
    profileId: resolvedSession?.user?.profileId ?? null,
    // Only authenticated users have id_token (from Keycloak)
    // Sessions without id_token still render a layout context
    isAuthenticated: !!resolvedSession?.id_token,
  };

  // Extract profile ID from session
  let profileId = resolvedSession?.user?.profileId || null;
  let initial: LayoutContextOut | null = null;

  // Fetch profile context + drafts + analytics filters in parallel
  let draftsResult: DraftsOut | null = null;
  let analyticsFilters: AnalyticsFiltersOut | null = null;
  try {
    const [contextResult, draftsRes, filtersRes] = await Promise.all([
      getLayoutContext({ body: {} }),
      getDrafts(),
      getAnalyticsFilters(),
    ]);
    initial = contextResult;
    draftsResult = draftsRes;
    analyticsFilters = filtersRes;
    if (initial?.id) {
      profileId = initial.id;
    }
  } catch {
    // If context fetch fails (e.g., 403/404), return null
    // Layout will handle access denied via AccessControl component
    initial = null;
    draftsResult = null;
    analyticsFilters = null;
  }

  // Ensure we have profile ID - use from initial if extraction failed
  if (initial && !profileId && initial.id) {
    profileId = initial.id;
  }

  // Early return if no valid profile context (user not logged in or invalid session)
  // Only return null if we truly don't have valid profile data
  if (!initial || !initial.id) {
    // eslint-disable-next-line no-console
    console.log("Returning null initial:", {
      hasInitial: !!initial,
      profileId,
    });
    return {
      initial: null,
      snapshot,
      attemptData: null,
      activeSettings: null,
      drafts: [],
      analyticsFilters: null,
    };
  }

  // Read pathname from headers to check if we're on an attempt page
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  // Extract attemptId from pathname if we're on an attempt page
  const attemptMatch =
    pathname.match(/\/home\/([0-9a-f-]{36})/) ||
    pathname.match(/\/practice\/([0-9a-f-]{36})/);
  const attemptId = attemptMatch ? attemptMatch[1] : null;

  // Fetch attempt data if we have an attemptId (using resolved UUID)
  let attemptData: AttemptFullOut | null = null;
  if (attemptId && profileId) {
    try {
      attemptData = await getAttemptFull(attemptId, {
        body: { attempt_id: attemptId },
      });
    } catch {
      // If attempt fetch fails, just continue without attempt data
      // This can happen if the attempt doesn't exist or user doesn't have access
      attemptData = null;
    }
  }

  // Extract settings from profile context response
  // Transform flat settings_* fields into nested settings object
  // Extract guestProfileId before passing to client (server-side only)
  const activeSettingsClient: SettingsActiveClient | null = initial.settings_id
    ? {
        id: initial.settings_id ?? null,
        success_threshold: initial.settings_success_threshold ?? null,
        warning_threshold: initial.settings_warning_threshold ?? null,
        danger_threshold: initial.settings_danger_threshold ?? null,
        tokens: initial.settings_tokens ?? null,
      }
    : null;

  return {
    initial,
    snapshot,
    attemptData,
    activeSettings: activeSettingsClient,
    drafts: draftsResult?.drafts ?? [],
    analyticsFilters,
  };
}

/** ---- Strongly-typed server actions for Session Management (single source of truth) ---- */
type SwitchEffectiveProfileParams = {
  targetProfileId: string;
  returnUrl?: string;
};

type SwitchEffectiveProfileResult = {
  ok: boolean;
  reason?: string;
  grantId?: string;
  redirectUrl?: string;
  logoutUrl?: string;
  emulatePageUrl?: string;
};

async function createEmulationGrant(
  input: CreateEmulationGrantIn
): Promise<CreateEmulationGrantOut> {
  return api.post("/auth/emulate", input);
}

/**
 * Server action to start emulation via default-idp.
 * Returns a redirect URL to complete sign-in as the target profile.
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
    if (isSelf) {
      return { ok: false, reason: "Already using this profile" };
    }

    const res = await createEmulationGrant({
      body: {
        requester_profile_id: session.user.profileId,
        target_profile_id: input.targetProfileId,
        ttl_minutes: null, // Use server default (120 minutes)
        return_url: input.returnUrl ?? null,
      },
    });

    if (!res.allowed) {
      return { ok: false, reason: res.reason ?? "Emulation not allowed" };
    }
    if (!res.grant_id) {
      return { ok: false, reason: "Missing emulation grant" };
    }

    const result: SwitchEffectiveProfileResult = {
      ok: true,
      grantId: res.grant_id,
    };
    if (res.redirect_url) result.redirectUrl = res.redirect_url;
    if (res.logout_url) result.logoutUrl = res.logout_url;
    if (res.emulate_page_url) result.emulatePageUrl = res.emulate_page_url;

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: errorMessage };
  }
}

/** Server action to clear session cookies. */
export async function clearSessionCookies(): Promise<void> {
  "use server";
  try {
    const cookieStore = await cookies();
    cookieStore.delete("department-id");
    cookieStore.delete("realm-name");
  } catch {
    // Ignore errors - cookies might not exist
  }
}

/** ---- Strongly-typed server actions for Feedback (single source of truth) ---- */
export async function createFeedback(
  input: CreateFeedbackIn
): Promise<CreateFeedbackOut> {
  return api.post("/artifacts/activity/problem", input);
}

/** ---- Strongly-typed server actions for Analytics (single source of truth) ---- */
/** Page-targeted refresh: calls the correct /refresh endpoint for the given page. */
export async function refreshPage(page: string): Promise<void> {
  "use server";
  const endpoint = REFRESH_ENDPOINT_MAP[page];
  if (!endpoint) {
    throw new Error(`Unknown refresh page: ${page}`);
  }
  await api.post(endpoint as Parameters<typeof api.post>[0], { body: {} });
}

/** ---- Strongly-typed server actions for Profile Emulation (single source of truth) ---- */
export async function searchSimulatableProfiles(
  input: SearchSimulatableProfilesIn
): Promise<SearchSimulatableProfilesOut> {
  return api.post("/auth/simulatable", input);
}

/** ---- Strongly-typed server actions for Staff (single source of truth) ---- */
export async function searchStaff(
  input: SearchStaffIn
): Promise<SearchStaffOut> {
  "use server";
  return api.post("/artifacts/profiles/bulk/search", input);
}

export async function getCreateStaffData(
  input: CreateStaffDataIn
): Promise<CreateStaffDataOut> {
  "use server";
  return api.post("/staff/data/create", input);
}

export async function processCSV(input: ProcessCSVIn): Promise<ProcessCSVOut> {
  "use server";
  return api.post("/artifacts/profiles/bulk/process", input);
}

export async function bulkCreateOrUpdateStaff(
  input: BulkCreateOrUpdateStaffIn
): Promise<BulkCreateOrUpdateStaffOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/profiles/bulk/save", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type RefreshPageFn = (page: string) => Promise<void>;

export type {
  AnalyticsFiltersOut,
  AttemptFullIn,
  AttemptFullOut,
  BulkCreateOrUpdateStaffIn,
  BulkCreateOrUpdateStaffOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  GetProfileIn,
  GetProfileOut,
  ProcessCSVIn,
  ProcessCSVOut,
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SearchStaffIn,
  SearchStaffOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
};
