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
type ProfileContextIn = InputOf<"/api/v5/profiles/context", "post">;
type ProfileContextOut = OutputOf<"/api/v5/profiles/context", "post">;

type CreateFeedbackIn = InputOf<"/api/v5/activity/problem", "post">;
type CreateFeedbackOut = OutputOf<"/api/v5/activity/problem", "post">;
/** Page-specific refresh endpoint mapping */
const REFRESH_ENDPOINT_MAP: Record<string, string> = {
  chat: "/chat/refresh",
  dashboard: "/dashboard/refresh",
  leaderboard: "/leaderboard/refresh",
  reports: "/reports/refresh",
  pricing: "/pricing/refresh",
  benchmark: "/benchmark/refresh",
  activity: "/activity/refresh",
  health: "/health/refresh",
};
type AttemptFullIn = InputOf<"/attempt/get", "post">;
type AttemptFullOut = OutputOf<"/attempt/get", "post">;
/** ---- Response type alias ---- */
export type AuthProfileResponse = ProfileContextOut;

/** ---- Shared header builder ---- */
async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  const extraHeaders: Record<string, string> = {};
  extraHeaders["X-Pathname"] = pathname;
  return extraHeaders;
}

/** ---- Profile context fetch (canonical: /artifacts/profiles/context) ---- */
export const getProfileContext = cache(
  async (): Promise<ProfileContextOut> => {
    const extraHeaders = await buildAuthHeaders();
    return api.post("/profiles/context", { body: {} } as ProfileContextIn, { headers: extraHeaders });
  }
);


/** ---- Group messages server action (canonical: /artifacts/group/get) ---- */
type GroupMessagesIn = InputOf<"/group/get", "post">;
type GroupMessagesOut = OutputOf<"/group/get", "post">;

export async function getGroupMessages(
  input: GroupMessagesIn
): Promise<GroupMessagesOut> {
  return api.post("/group/get", input);
}

/** ---- Group search server action (canonical: /artifacts/group/search) ---- */
type GroupSearchIn = InputOf<"/group/search", "post">;
type GroupSearchOut = OutputOf<"/group/search", "post">;

export async function searchGroups(
  input: GroupSearchIn
): Promise<GroupSearchOut> {
  "use server";
  return api.post("/group/search", input);
}


/** ---- Helper to get validated profile ID (reusable for API calls) ----
 * @param session - Optional session to reuse. If not provided, will fetch session.
 * @returns Object with profileId (can be null)
 */
export async function getValidatedProfileId(): Promise<{
  profileId: string | null;
}> {
  try {
    const profile = await getProfileContext();
    return { profileId: profile?.id ?? null };
  } catch {
    return { profileId: null };
  }
}

// Export ProfileItem type derived from server response
export type ProfileItem = Pick<
  ProfileContextOut,
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
 * Fetches layout context data for the main layout.
 * Single call — profile context includes identity, permissions, and theme primitives.
 */
export async function getLayoutContextData(session?: Session | null) {
  const resolvedSession = session ?? (await getSession());

  const isAuthenticated = !!resolvedSession?.id_token;
  const idToken = resolvedSession?.id_token ?? null;

  let profileData: ProfileContextOut | null = null;

  try {
    profileData = await getProfileContext();
  } catch {
    const snapshot: SafeSessionSnapshot = { profileId: null, isAuthenticated, idToken };
    return { profileData: null, snapshot };
  }

  if (!profileData?.id) {
    const snapshot: SafeSessionSnapshot = { profileId: null, isAuthenticated, idToken };
    return { profileData: null, snapshot };
  }

  const snapshot: SafeSessionSnapshot = {
    profileId: profileData.id,
    isAuthenticated,
    idToken,
  };

  return { profileData, snapshot };
}

/** Server action to clear session state. */
export async function clearSessionCookies(): Promise<void> {
  "use server";
}

/** ---- Strongly-typed server actions for Feedback (single source of truth) ---- */
export async function createFeedback(
  input: CreateFeedbackIn
): Promise<CreateFeedbackOut> {
  return api.post("/activity/problem", input);
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
  home: "/home/export",
  dashboard: "/dashboard/export",
  leaderboard: "/leaderboard/export",
  reports: "/reports/export",
  pricing: "/pricing/export",
  practice: "/practice/export",
  personas: "/personas/export",
  scenarios: "/scenarios/export",
  simulations: "/simulations/export",
  cohorts: "/cohorts/export",
};

/** Page-targeted export: calls the correct /export endpoint for the given page. */
export async function exportPage(
  page: string,
  filters: Record<string, unknown>,
): Promise<{ content: string; file_name: string; mime_type: string; row_count: number }> {
  "use server";
  const endpoint = EXPORT_ENDPOINT_MAP[page];
  if (!endpoint) throw new Error(`No export for page: ${page}`);
  return api.post(endpoint as Parameters<typeof api.post>[0], { body: filters }) as Promise<{ content: string; file_name: string; mime_type: string; row_count: number }>;
}

/** ---- Export types for client component (type-only imports) ---- */
export type RefreshPageFn = (page: string) => Promise<void>;
export type ExportPageFn = typeof exportPage;

export type {
  AttemptFullIn,
  AttemptFullOut,
  CreateFeedbackIn,
  CreateFeedbackOut,
  GroupMessagesIn,
  GroupMessagesOut,
  GroupSearchIn,
  GroupSearchOut,
};
