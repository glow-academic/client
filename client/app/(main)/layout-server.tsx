/**
 * Server component that fetches profile context data
 */
"use server";
import { getSession } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Session } from "next-auth";
import { headers } from "next/headers";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type AuthProfileIn = InputOf<"/api/v5/auth/profile", "post">;
type AuthProfileOut = OutputOf<"/api/v5/auth/profile", "post">;
type AuthSettingsIn = InputOf<"/api/v5/auth/settings", "post">;
type AuthSettingsOut = OutputOf<"/api/v5/auth/settings", "post">;
type AuthPageIn = InputOf<"/api/v5/auth/page", "post">;
type AuthPageOut = OutputOf<"/api/v5/auth/page", "post">;
type DraftsIn = InputOf<"/api/v5/auth/drafts", "post">;
type DraftsOut = OutputOf<"/api/v5/auth/drafts", "post">;
type AnalyticsFiltersOut = OutputOf<"/api/v5/auth/analytics", "post">;
type CreateEmulationGrantIn = InputOf<"/api/v5/auth/emulate", "post">;
type CreateEmulationGrantOut = OutputOf<"/api/v5/auth/emulate", "post">;
type CreateFeedbackIn = InputOf<"/api/v5/artifacts/activity/problem", "post">;
type CreateFeedbackOut = OutputOf<"/api/v5/artifacts/activity/problem", "post">;
/** Page-specific refresh endpoint mapping */
const REFRESH_ENDPOINT_MAP: Record<string, string> = {
  chat: "/artifacts/chat/refresh",
  dashboard: "/artifacts/dashboard/refresh",
  leaderboard: "/artifacts/leaderboard/refresh",
  reports: "/artifacts/reports/refresh",
  pricing: "/artifacts/pricing/refresh",
  benchmark: "/artifacts/benchmark/refresh",
  activity: "/artifacts/activity/refresh",
  health: "/artifacts/health/refresh",
};
type AttemptFullIn = InputOf<"/api/v5/artifacts/attempt/get", "post">;
type AttemptFullOut = OutputOf<"/api/v5/artifacts/attempt/get", "post">;
type SearchSimulatableProfilesIn = InputOf<"/api/v5/auth/simulatable", "post">;
type SearchSimulatableProfilesOut = OutputOf<
  "/api/v5/auth/simulatable",
  "post"
>;
/** ---- Auth response type aliases ---- */
export type AuthProfileResponse = AuthProfileOut;
export type AuthSettingsResponse = AuthSettingsOut;
export type AuthPageResponse = AuthPageOut;

/** ---- Shared header builder for auth endpoints ---- */
async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  const extraHeaders: Record<string, string> = {};
  extraHeaders["X-Pathname"] = pathname;
  return extraHeaders;
}

/** ---- Split auth fetches ---- */
export const getAuthProfile = cache(
  async (): Promise<AuthProfileOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/auth/profile", { body: {} } as AuthProfileIn, { headers: extraHeaders });
  }
);

export const getAuthSettings = cache(
  async (): Promise<AuthSettingsOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/auth/settings", { body: {} } as AuthSettingsIn, { headers: extraHeaders });
  }
);

export const getAuthPage = cache(
  async (): Promise<AuthPageOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/auth/page", { body: {} } as AuthPageIn, { headers: extraHeaders });
  }
);

/** ---- Cached drafts fetch (parallel with context) ---- */
export const getDrafts = cache(
  async (): Promise<DraftsOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/auth/drafts", { body: {} } as DraftsIn, { headers: extraHeaders });
  }
);

/** ---- Cached analytics filters fetch (parallel with context) ---- */
export const getAnalyticsFilters = cache(
  async (): Promise<AnalyticsFiltersOut | null> => {
    try {
      const extraHeaders = await buildAuthHeaders();
      return await api.post(
        "/auth/analytics",
        { body: {} } as InputOf<"/api/v5/auth/analytics", "post">,
        { headers: extraHeaders }
      );
    } catch {
      return null;
    }
  }
);

/** ---- Resolve group_id (cached per request) ---- */
type ResolveGroupIn = InputOf<"/api/v5/auth/group", "post">;
type ResolveGroupOut = OutputOf<"/api/v5/auth/group", "post">;

export const resolveGroupId = cache(
  async (params: {
    draft_id?: string | null;
    artifact_type?: string | null;
    attempt_id?: string | null;
    test_id?: string | null;
  }): Promise<ResolveGroupOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post(
      "/auth/group",
      {
        body: {
          draft_id: params.draft_id ?? null,
          artifact_type: params.artifact_type ?? null,
          attempt_id: params.attempt_id ?? null,
          test_id: params.test_id ?? null,
        },
      } as ResolveGroupIn,
      { headers: extraHeaders },
    );
  },
);

/** ---- Generate messages server action ---- */
type GenerateMessagesIn = InputOf<"/api/v5/auth/generate", "post">;
type GenerateMessagesOut = OutputOf<"/api/v5/auth/generate", "post">;

export async function getGenerateMessages(
  input: GenerateMessagesIn
): Promise<GenerateMessagesOut> {
  return api.post("/auth/generate", input);
}

/** ---- Export type for client (type-only imports) ---- */
export type DraftsResponse = DraftsOut;
export type AnalyticsFiltersResponse = AnalyticsFiltersOut;
export type ResolveGroupResponse = ResolveGroupOut;

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

  let profileData: AuthProfileOut | null = null;
  let settingsData: AuthSettingsOut | null = null;
  let pageData: AuthPageOut | null = null;
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
  } catch {
    // If fetch fails (e.g., 403/404), return null
    return {
      profileData: null,
      settingsData: null,
      pageData: null,
      snapshot,
      drafts: [],
      analyticsFilters: null,
    };
  }

  // Early return if no valid profile context
  if (!profileData?.id) {
    return {
      profileData: null,
      settingsData: null,
      pageData: null,
      snapshot,
      drafts: [],
      analyticsFilters: null,
    };
  }

  return {
    profileData,
    settingsData,
    pageData,
    snapshot,
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

/** Server action to clear session state. */
export async function clearSessionCookies(): Promise<void> {
  "use server";
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

/** Page-specific export endpoint mapping */
const EXPORT_ENDPOINT_MAP: Record<string, string> = {
  home: "/artifacts/home/export",
  dashboard: "/artifacts/dashboard/export",
  leaderboard: "/artifacts/leaderboard/export",
  reports: "/artifacts/reports/export",
  pricing: "/artifacts/pricing/export",
  practice: "/artifacts/practice/export",
  personas: "/artifacts/personas/export",
  scenarios: "/artifacts/scenarios/export",
  simulations: "/artifacts/simulations/export",
  cohorts: "/artifacts/cohorts/export",
};

/** Page-targeted export: calls the correct /export endpoint for the given page. */
export async function exportPage(
  page: string,
  filters: Record<string, unknown>,
): Promise<{ upload_id: string; file_name: string; row_count: number }> {
  "use server";
  const endpoint = EXPORT_ENDPOINT_MAP[page];
  if (!endpoint) throw new Error(`No export for page: ${page}`);
  return api.post(endpoint as Parameters<typeof api.post>[0], { body: filters }) as Promise<{ upload_id: string; file_name: string; row_count: number }>;
}

/** ---- Strongly-typed server actions for Profile Emulation (single source of truth) ---- */
export async function searchSimulatableProfiles(
  input: SearchSimulatableProfilesIn
): Promise<SearchSimulatableProfilesOut> {
  return api.post("/auth/simulatable", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type RefreshPageFn = (page: string) => Promise<void>;
export type ExportPageFn = typeof exportPage;

export type {
  AnalyticsFiltersOut,
  AttemptFullIn,
  AttemptFullOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  GenerateMessagesIn,
  GenerateMessagesOut,
  SearchSimulatableProfilesIn,
  SearchSimulatableProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
};
