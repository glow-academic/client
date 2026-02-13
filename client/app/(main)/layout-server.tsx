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
type AuthProfileIn = InputOf<"/api/v4/auth/profile", "post">;
type AuthProfileOut = OutputOf<"/api/v4/auth/profile", "post">;
type AuthSettingsIn = InputOf<"/api/v4/auth/settings", "post">;
type AuthSettingsOut = OutputOf<"/api/v4/auth/settings", "post">;
type AuthPageIn = InputOf<"/api/v4/auth/page", "post">;
type AuthPageOut = OutputOf<"/api/v4/auth/page", "post">;
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
/** ---- Auth response type aliases ---- */
export type AuthProfileResponse = AuthProfileOut;
export type AuthSettingsResponse = AuthSettingsOut;
export type AuthPageResponse = AuthPageOut;

/** ---- Shared header builder for auth endpoints ---- */
async function buildAuthHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const cookieHeader = [
    cookieStore.get("department-id")?.value &&
      `department-id=${cookieStore.get("department-id")?.value}`,
  ]
    .filter(Boolean)
    .join("; ");

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  const extraHeaders: Record<string, string> = {};
  if (cookieHeader) extraHeaders["Cookie"] = cookieHeader;
  extraHeaders["X-Pathname"] = pathname;
  return extraHeaders;
}

/** ---- Cached fetch (legacy — still used by internal consumers) ---- */
export const getLayoutContext = cache(
  async (input: LayoutContextIn): Promise<LayoutContextOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/auth/context", input, { headers: extraHeaders });
  }
);

/** ---- New split auth fetches ---- */
export const getAuthProfile = cache(
  async (): Promise<AuthProfileOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/auth/profile", {} as AuthProfileIn, { headers: extraHeaders });
  }
);

export const getAuthSettings = cache(
  async (): Promise<AuthSettingsOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/auth/settings", {} as AuthSettingsIn, { headers: extraHeaders });
  }
);

export const getAuthPage = cache(
  async (): Promise<AuthPageOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/auth/page", {} as AuthPageIn, { headers: extraHeaders });
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
export type ProfileItem = Pick<
  AuthProfileOut,
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
  let profileData: AuthProfileOut | null = null;
  let settingsData: AuthSettingsOut | null = null;
  let pageData: AuthPageOut | null = null;

  // Fetch profile + settings + page + drafts + analytics filters in parallel
  let draftsResult: DraftsOut | null = null;
  let analyticsFilters: AnalyticsFiltersOut | null = null;
  try {
    const [profileRes, settingsRes, pageRes, draftsRes, filtersRes] = await Promise.all([
      getAuthProfile(),
      getAuthSettings(),
      getAuthPage(),
      getDrafts(),
      getAnalyticsFilters(),
    ]);
    profileData = profileRes;
    settingsData = settingsRes;
    pageData = pageRes;
    draftsResult = draftsRes;
    analyticsFilters = filtersRes;
    if (profileData?.id) {
      profileId = profileData.id;
    }
  } catch {
    // If fetch fails (e.g., 403/404), return null
    profileData = null;
    settingsData = null;
    pageData = null;
    draftsResult = null;
    analyticsFilters = null;
  }

  // Ensure we have profile ID
  if (profileData && !profileId && profileData.id) {
    profileId = profileData.id;
  }

  // Early return if no valid profile context
  if (!profileData || !profileData.id) {
    // eslint-disable-next-line no-console
    console.log("Returning null profileData:", {
      hasProfileData: !!profileData,
      profileId,
    });
    return {
      profileData: null,
      settingsData: null,
      pageData: null,
      snapshot,
      attemptData: null,
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
      attemptData = null;
    }
  }

  return {
    profileData,
    settingsData,
    pageData,
    snapshot,
    attemptData,
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
