/**
 * Server component that fetches profile context data
 */
"use server";
import { getSession, update } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Session } from "next-auth";
import { cookies, headers } from "next/headers";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LayoutContextIn = InputOf<"/api/v3/profile/context", "post">;
type LayoutContextOut = OutputOf<"/api/v3/profile/context", "post">;
type AuthorizeEmulationIn = InputOf<"/api/v3/profile/emulate", "post">;
type AuthorizeEmulationOut = OutputOf<"/api/v3/profile/emulate", "post">;
type CreateFeedbackIn = InputOf<"/api/v3/feedback/create", "post">;
type CreateFeedbackOut = OutputOf<"/api/v3/feedback/create", "post">;
type RefreshAnalyticsIn = InputOf<"/api/v3/analytics/refresh", "post">;
type RefreshAnalyticsOut = OutputOf<"/api/v3/analytics/refresh", "post">;
type AttemptFullIn = InputOf<"/api/v3/attempts/simulation", "post">;
type AttemptFullOut = OutputOf<"/api/v3/attempts/simulation", "post">;
type SearchSimulatableProfilesIn = InputOf<
  "/api/v3/profile/simulatable",
  "post"
>;
type SearchSimulatableProfilesOut = OutputOf<
  "/api/v3/profile/simulatable",
  "post"
>;
type SearchStaffIn = InputOf<"/api/v3/staff/search", "post">;
type SearchStaffOut = OutputOf<"/api/v3/staff/search", "post">;
type CreateStaffDataIn = InputOf<"/api/v3/staff/data/create", "post">;
type CreateStaffDataOut = OutputOf<"/api/v3/staff/data/create", "post">;
type ProcessCSVIn = InputOf<"/api/v3/staff/csv", "post">;
type ProcessCSVOut = OutputOf<"/api/v3/staff/csv", "post">;
type BulkCreateOrUpdateStaffIn = InputOf<"/api/v3/staff/upsert", "post">;
type BulkCreateOrUpdateStaffOut = OutputOf<"/api/v3/staff/upsert", "post">;
/** ---- Client-side settings type (excludes guestProfileId) ----
 * guestProfileId is server-side only and should not be exposed to client components
 */
export type SettingsActiveClient = Omit<
  LayoutContextOut["settings"],
  "guestProfileId"
>;

/** ---- Cached fetch ---- */
export const getLayoutContext = cache(
  async (input: LayoutContextIn): Promise<LayoutContextOut> => {
    // Profile IDs are automatically injected via X-Profile-Id and X-Effective-Profile-Id headers
    // by request-core.ts, so we don't need to pass them in the body anymore.
    // The backend reads them from request.state (set by router-level dependencies).
    // We still accept them in the input for backward compatibility, but they're ignored.

    // Forward cookies from server action context to API request
    // This is needed because server actions run server-side and cookies aren't automatically forwarded
    const cookieStore = await cookies();
    const cookieHeader = [
      cookieStore.get("department-id")?.value &&
        `department-id=${cookieStore.get("department-id")?.value}`,
      cookieStore.get("auth-mode")?.value &&
        `auth-mode=${cookieStore.get("auth-mode")?.value}`,
    ]
      .filter(Boolean)
      .join("; ");

    const result = await api.post(
      "/profile/context",
      input,
      cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined
    );

    return result;
  }
);

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for websocket/attempt pages.
 */
const getAttemptFull = async (
  _attemptId: string,
  input: AttemptFullIn
): Promise<AttemptFullOut> => {
  return api.post("/attempts/simulation", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Export type for client (type-only imports) ---- */
export type LayoutContextResponse = LayoutContextOut;

/** ---- Helper to get validated profile IDs (reusable for API calls) ----
 * Gets both actual and effective profile IDs from validated profile context.
 * Reuses getLayoutContext for consistency and caching.
 *
 * @param session - Optional session to reuse. If not provided, will fetch session.
 * @returns Object with actualProfileId and effectiveProfileId (both can be null)
 */
export async function getValidatedProfileId(session?: Session | null): Promise<{
  actualProfileId: string | null;
  effectiveProfileId: string | null;
}> {
  const resolvedSession = session ?? (await getSession());

  // Extract profile IDs from session (works for both real and pseudo-sessions)
  const effectiveProfileId = resolvedSession?.effectiveProfileId || null;
  const actualProfileId = resolvedSession?.user?.profileId || null;

  // If we have session profile IDs, return them directly
  // No need to call getLayoutContext - headers will be injected automatically by request-core.ts
  if (effectiveProfileId && actualProfileId) {
    return {
      actualProfileId,
      effectiveProfileId,
    };
  }

  // If no session IDs but we have cookies (guest/default-account), resolve from cookies
  try {
    const cookieStore = await cookies();
    const authMode = cookieStore.get("auth-mode")?.value;

    // If we have auth-mode cookie, try to resolve profile from cookies
    if (
      authMode &&
      (authMode === "default-guest" || authMode === "default-account")
    ) {
      // Call profile context endpoint - headers will be null (cookie-based auth)
      // Server will read cookies and resolve profile from department settings
      const initial = await getLayoutContext({
        body: {
          pathname: "/",
        },
      });

      if (initial?.effectiveProfile?.id && initial?.actualProfile?.id) {
        return {
          actualProfileId: initial.actualProfile.id,
          effectiveProfileId: initial.effectiveProfile.id,
        };
      }
    }
  } catch {
    // If profile context fetch fails, return nulls
    return { actualProfileId: null, effectiveProfileId: null };
  }

  return { actualProfileId: null, effectiveProfileId: null };
}

// Export ProfileItem type derived from server response
export type ProfileItem = LayoutContextResponse["actualProfile"];

export type SafeSessionSnapshot = {
  effectiveProfileId: string | null;
  fullEmulation: boolean;
  emulationTTL: number | null;
  isAuthenticated: boolean; // true if user has real NextAuth session (not guest/default account)
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
    effectiveProfileId: resolvedSession?.effectiveProfileId ?? null,
    fullEmulation: !!resolvedSession?.fullEmulation,
    emulationTTL: resolvedSession?.emulationTTL ?? null,
    // Only authenticated users have id_token (from Keycloak)
    // Guest/default account users have pseudo-sessions without id_token
    isAuthenticated: !!resolvedSession?.id_token,
  };

  // Extract profile IDs from session (works for both real and pseudo-sessions)
  // For authenticated users: profile IDs come from session
  // For guest/default-account users: profile IDs are null, will resolve from cookies
  let effectiveProfileId = resolvedSession?.effectiveProfileId || null;
  let actualProfileId = resolvedSession?.user?.profileId || null;
  let initial: LayoutContextOut | null = null;

  // If no session IDs but we have cookies (guest/default-account), resolve from cookies
  // This ensures we always pull from settings (source of truth) rather than storing profile IDs in tokens
  if (!effectiveProfileId || !actualProfileId) {
    try {
      const cookieStore = await cookies();
      const authMode = cookieStore.get("auth-mode")?.value;

      // If we have auth-mode cookie, try to resolve profile from cookies
      if (
        authMode &&
        (authMode === "default-guest" || authMode === "default-account")
      ) {
        // Call profile context endpoint with null profile IDs
        // Server will read cookies and resolve profile from department settings
        try {
          initial = await getLayoutContext({
            body: {
              pathname: "/",
            },
          });
          // eslint-disable-next-line no-console
          console.log("Profile context resolved:", {
            hasInitial: !!initial,
            effectiveProfileId: initial?.effectiveProfile?.id,
            actualProfileId: initial?.actualProfile?.id,
            effectiveProfileRole: initial?.effectiveProfile?.role,
          });
          // Extract resolved profile IDs from context response
          if (initial?.effectiveProfile?.id && initial?.actualProfile?.id) {
            effectiveProfileId = initial.effectiveProfile.id;
            actualProfileId = initial.actualProfile.id;
          } else {
            // Profile context returned but IDs are missing - invalid response
            // eslint-disable-next-line no-console
            console.error(
              "Profile context resolved but missing profile IDs:",
              initial
            );
            initial = null;
          }
        } catch (error) {
          // If profile context fetch fails, cookies might be invalid or settings don't exist
          // Log error for debugging but don't break the flow
          // eslint-disable-next-line no-console
          console.error(
            "Failed to resolve profile from cookies:",
            error instanceof Error ? error.message : String(error)
          );
          initial = null;
        }
      }
    } catch {
      // Ignore cookie access errors
    }
  } else {
    // Authenticated user: fetch profile context with session profile IDs
    try {
      initial = await getLayoutContext({
        body: {
          pathname: "/", // layout-level; pages can still supply their own on demand
        },
      });
      // Verify profile IDs match what we expect
      if (
        initial?.effectiveProfile?.id &&
        initial?.actualProfile?.id &&
        initial.effectiveProfile.id !== effectiveProfileId
      ) {
        // Update effectiveProfileId if it changed (emulation case)
        effectiveProfileId = initial.effectiveProfile.id;
      }
    } catch {
      // If context fetch fails (e.g., 403/404), return null
      // Layout will handle access denied via AccessControl component
      initial = null;
    }
  }

  // Ensure we have profile IDs - use from initial if extraction failed
  // This handles the case where initial exists but IDs weren't extracted earlier
  if (initial) {
    if (!effectiveProfileId && initial.effectiveProfile?.id) {
      effectiveProfileId = initial.effectiveProfile.id;
    }
    if (!actualProfileId && initial.actualProfile?.id) {
      actualProfileId = initial.actualProfile.id;
    }
  }

  // Early return if no valid profile context (user not logged in or invalid session)
  // Only return null if we truly don't have valid profile data
  if (!initial || !initial.effectiveProfile?.id || !initial.actualProfile?.id) {
    // eslint-disable-next-line no-console
    console.log("Returning null initial:", {
      hasInitial: !!initial,
      effectiveProfileId,
      actualProfileId,
      initialEffectiveId: initial?.effectiveProfile?.id,
      initialActualId: initial?.actualProfile?.id,
    });
    return {
      initial: null,
      snapshot,
      attemptData: null,
      activeSettings: null,
    };
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
        body: { attempt_id: attemptId },
      });
    } catch {
      // If attempt fetch fails, just continue without attempt data
      // This can happen if the attempt doesn't exist or user doesn't have access
      attemptData = null;
    }
  }

  // Extract settings from profile context response
  // Extract guestProfileId before passing to client (server-side only)
  const { guestProfileId: _, ...settingsWithoutGuest } = initial.settings || {};
  const activeSettingsClient: SettingsActiveClient | null = initial.settings
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
  return api.post("/profile/emulate", input);
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

/**
 * Server action to set guest session cookies.
 * Sets department-id and auth-mode cookies instead of profile ID.
 * Profile ID will be resolved server-side from department settings.
 */
export async function setGuestSession(
  departmentId: string | null
): Promise<{ ok: boolean; reason?: string }> {
  "use server";
  try {
    const cookieStore = await cookies();

    // Clear default account cookies if set
    cookieStore.delete("department-id");
    cookieStore.delete("auth-mode");

    // Set department-id cookie (null means use default settings)
    if (departmentId) {
      cookieStore.set("department-id", departmentId, {
        httpOnly: false, // Need to read it client-side for redirects
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      });
    }

    // Set auth-mode cookie to "default-guest"
    cookieStore.set("auth-mode", "default-guest", {
      httpOnly: false, // Need to read it client-side for redirects
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return { ok: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: errorMessage };
  }
}

/**
 * Server action to set default account session cookies.
 * Sets department-id and auth-mode cookies instead of profile ID.
 * Profile ID will be resolved server-side from department settings.
 */
export async function setDefaultAccountSession(
  departmentId: string | null
): Promise<{ ok: boolean; reason?: string }> {
  "use server";
  try {
    const cookieStore = await cookies();

    // Clear guest cookies if set
    cookieStore.delete("department-id");
    cookieStore.delete("auth-mode");

    // Set department-id cookie (null means use default settings)
    if (departmentId) {
      cookieStore.set("department-id", departmentId, {
        httpOnly: false, // Need to read it client-side for redirects
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: "/",
      });
    }

    // Set auth-mode cookie to "default-account"
    cookieStore.set("auth-mode", "default-account", {
      httpOnly: false, // Need to read it client-side for redirects
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return { ok: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { ok: false, reason: errorMessage };
  }
}

/**
 * Server action to clear guest/default account session cookies.
 * Called on logout to ensure clean session state.
 */
export async function clearGuestSessionCookies(): Promise<void> {
  "use server";
  try {
    const cookieStore = await cookies();
    cookieStore.delete("department-id");
    cookieStore.delete("auth-mode");
    cookieStore.delete("realm-name");
  } catch {
    // Ignore errors - cookies might not exist
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
  return api.post("/profile/simulatable", input);
}

/** ---- Strongly-typed server actions for Staff (single source of truth) ---- */
export async function searchStaff(
  input: SearchStaffIn
): Promise<SearchStaffOut> {
  "use server";
  return api.post("/staff/search", input);
}

export async function getCreateStaffData(
  input: CreateStaffDataIn
): Promise<CreateStaffDataOut> {
  "use server";
  return api.post("/staff/data/create", input);
}

export async function processCSV(input: ProcessCSVIn): Promise<ProcessCSVOut> {
  "use server";
  return api.post("/staff/csv", input);
}

export async function bulkCreateOrUpdateStaff(
  input: BulkCreateOrUpdateStaffIn
): Promise<BulkCreateOrUpdateStaffOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/staff/upsert", input);
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
  SwitchEffectiveProfileParams,
  SwitchEffectiveProfileResult,
};
