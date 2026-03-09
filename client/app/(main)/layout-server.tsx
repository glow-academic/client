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
type AuthProfileIn = InputOf<"/auth/profile", "post">;
type AuthProfileOut = OutputOf<"/auth/profile", "post">;
type AuthSettingsIn = InputOf<"/auth/settings", "post">;
type AuthSettingsOut = OutputOf<"/auth/settings", "post">;

type EmulateProfileIn = InputOf<"/api/v5/artifacts/profiles/emulate", "post">;
type EmulateProfileOut = OutputOf<"/api/v5/artifacts/profiles/emulate", "post">;
type UnemulateProfileOut = OutputOf<"/api/v5/artifacts/profiles/unemulate", "post">;
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
type SearchProfilesIn = InputOf<"/api/v5/artifacts/profiles/search", "post">;
type SearchProfilesOut = OutputOf<"/api/v5/artifacts/profiles/search", "post">;
/** ---- Auth response type aliases ---- */
export type AuthProfileResponse = AuthProfileOut;
export type AuthSettingsResponse = AuthSettingsOut;

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


/** ---- Generate messages server action ---- */
type GenerateMessagesIn = InputOf<"/auth/generate", "post">;
type GenerateMessagesOut = OutputOf<"/auth/generate", "post">;

export async function getGenerateMessages(
  input: GenerateMessagesIn
): Promise<GenerateMessagesOut> {
  return api.post("/auth/generate", input);
}


/** ---- Helper to get validated profile ID (reusable for API calls) ----
 * @param session - Optional session to reuse. If not provided, will fetch session.
 * @returns Object with profileId (can be null)
 */
export async function getValidatedProfileId(): Promise<{
  profileId: string | null;
}> {
  try {
    const profile = await getAuthProfile();
    return { profileId: profile?.id ?? null };
  } catch {
    return { profileId: null };
  }
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
  idToken: string | null; // JWT for API auth (server resolves identity from this)
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

  // isAuthenticated distinguishes real sessions (has id_token) from pseudo-sessions (no id_token)
  const isAuthenticated = !!resolvedSession?.id_token;
  const idToken = resolvedSession?.id_token ?? null;

  let profileData: AuthProfileOut | null = null;
  let settingsData: AuthSettingsOut | null = null;

  try {
    const [profileRes, settingsRes] = await Promise.all([
      getAuthProfile(),
      getAuthSettings(),
    ]);
    profileData = profileRes;
    settingsData = settingsRes;
  } catch {
    // If fetch fails (e.g., 403/404), return null
    const snapshot: SafeSessionSnapshot = { profileId: null, isAuthenticated, idToken };
    return {
      profileData: null,
      settingsData: null,
      snapshot,
    };
  }

  // Early return if no valid profile context
  if (!profileData?.id) {
    const snapshot: SafeSessionSnapshot = { profileId: null, isAuthenticated, idToken };
    return {
      profileData: null,
      settingsData: null,
      snapshot,
    };
  }

  // profileId comes from server response (resolved from JWT by middleware)
  const snapshot: SafeSessionSnapshot = {
    profileId: profileData.id,
    isAuthenticated,
    idToken,
  };

  return {
    profileData,
    settingsData,
    snapshot,
  };
}

/** ---- Strongly-typed server actions for Session Management (single source of truth) ---- */
type SwitchEffectiveProfileParams = {
  targetProfileId: string;
};

type SwitchEffectiveProfileResult = {
  ok: boolean;
  reason?: string;
};

/**
 * Server action to start emulation.
 * Creates a grant in the DB — resolve_identity() picks it up on next request.
 * Client just needs to reload the page after this succeeds.
 */
export async function switchEffectiveProfile(
  input: SwitchEffectiveProfileParams
): Promise<SwitchEffectiveProfileResult> {
  try {
    const res = await api.post("/artifacts/profiles/emulate", {
      body: {
        target_profile_id: input.targetProfileId,
      },
    } as EmulateProfileIn);

    if (!res.allowed) {
      return { ok: false, reason: res.reason ?? "Emulation not allowed" };
    }

    return { ok: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: errorMessage };
  }
}

type ExitEmulationResult = {
  ok: boolean;
  reason?: string;
};

/**
 * Server action to exit the innermost emulation layer.
 * Consumes the innermost grant — resolve_identity() peels one layer on next request.
 * Client just needs to reload the page after this succeeds.
 */
export async function exitEmulation(): Promise<ExitEmulationResult> {
  try {
    const res = await api.post("/artifacts/profiles/unemulate", {
      body: {},
    });

    if (!res.ok) {
      return { ok: false, reason: res.reason ?? "Failed to exit emulation" };
    }

    return { ok: true };
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
export async function searchProfiles(
  input: SearchProfilesIn
): Promise<SearchProfilesOut> {
  return api.post("/artifacts/profiles/search", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type RefreshPageFn = (page: string) => Promise<void>;
export type ExportPageFn = typeof exportPage;

export type {
  AttemptFullIn,
  AttemptFullOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  ExitEmulationResult,
  GenerateMessagesIn,
  GenerateMessagesOut,
  SearchProfilesIn,
  SearchProfilesOut,
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
};
