import { createHmac, timingSafeEqual } from "crypto";
import type { Session } from "next-auth";

import { getSession } from "@/auth";
import { api } from "@/lib/api/client";
import type { OutputOf } from "@/lib/api/types";
import { hasRouteAccess, type ProfileRole } from "@/utils/route-permissions";

type HeaderLike = {
  get(name: string): string | null | undefined;
};

const PROFILE_ID_HEADER = "x-test-profile-id";
const EFFECTIVE_PROFILE_ID_HEADER = "x-test-effective-profile-id";
const SIGNATURE_HEADER = "x-test-signature";

export type TestProfileIds = {
  profileId: string;
  effectiveProfileId: string;
};

type SettingsActiveOut = OutputOf<"/api/v3/settings/active", "post">;

export type ResolvedProfileIds = {
  effectiveProfileId: string;
  actualProfileId: string;
};

export function validateTestHeaders(
  headers: HeaderLike
): TestProfileIds | null {
  const secret =
    process.env["AUTH_SECRET"] || "test_secret_key_for_integration_tests";
  const profileId = headers.get(PROFILE_ID_HEADER)?.trim();
  const effectiveProfileId = headers.get(EFFECTIVE_PROFILE_ID_HEADER)?.trim();
  const signature = headers.get(SIGNATURE_HEADER)?.trim();

  if (!profileId || !effectiveProfileId || !signature) {
    return null;
  }

  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64");
  } catch {
    return null;
  }

  const hmac = createHmac("sha256", secret);
  hmac.update(`${profileId}|${effectiveProfileId}`);
  const expected = hmac.digest();

  if (provided.length !== expected.length) {
    return null;
  }

  if (!timingSafeEqual(provided, expected)) {
    return null;
  }

  return { profileId, effectiveProfileId };
}

export function createTestSession({
  profileId,
  effectiveProfileId,
}: TestProfileIds): Session {
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const baseSession: Session = {
    user: {
      id: profileId,
      name: null,
      email: null,
      image: null,
      profileId,
      role: "guest",
    } as Session["user"] & {
      profileId?: string;
      role?: string;
    },
    expires,
  } as Session;

  return {
    ...baseSession,
    effectiveProfileId,
    emulationTTL: null,
    fullEmulation: false,
  } as Session;
}

/**
 * Resolves profile IDs from session or guest profile
 * Returns null if authentication is required but not available
 *
 * This function handles both authenticated users and guest users:
 * - Authenticated: Returns profile IDs from session
 * - Guest: Fetches guestProfileId from settings and uses it as fallback
 *
 * @param departmentId - Optional department ID for department-specific guest profile lookup
 *
 * Note: guestProfileId is fetched fresh from settings each time (not cached client-side).
 * This ensures we always use the correct guest profile ID configured in settings.
 * When a guest user logs in via SSO, they get their own authenticated session,
 * so there's no need to track guestProfileId client-side for login purposes.
 */
export async function requireAuth(
  departmentId?: string | null
): Promise<ResolvedProfileIds | null> {
  const session = await getSession();

  // If session has profile IDs, use them (authenticated user)
  const effectiveProfileIdRaw = session?.effectiveProfileId || null;
  const actualProfileIdRaw = session?.user?.profileId || null;

  // If both are present, return them
  if (effectiveProfileIdRaw && actualProfileIdRaw) {
    return {
      effectiveProfileId: effectiveProfileIdRaw,
      actualProfileId: actualProfileIdRaw,
    };
  }

  // If session is missing, try to resolve guest or default account profile ID from settings
  // This allows guest users and default account users to access pages
  // The profile IDs are fetched fresh from settings each time to ensure
  // we're using the correct configured profiles (which may change in settings)
  // If departmentId is provided, use it to get department-specific settings
  let guestProfileId: string | null = null;
  let defaultAccountProfileId: string | null = null;
  try {
    const activeSettings = (await api.post(
      "/settings/active",
      {
        body: {
          profileId: null, // null = get default settings (includes guestProfileId and defaultAccountProfileId)
          departmentId: departmentId || null, // Optional department ID for department-specific settings
        },
      },
      {
        cache: "no-store",
        headers: {
          "X-Bypass-Cache": "1",
        },
      }
    )) as SettingsActiveOut;

    guestProfileId = activeSettings?.guestProfileId || null;
    defaultAccountProfileId = activeSettings?.defaultAccountProfileId || null;
  } catch {
    // If settings fetch fails, return null (access denied)
    return null;
  }

  // Check if user is in default account mode (from localStorage, but we can't access it server-side)
  // So we'll prioritize defaultAccountProfileId if available, otherwise use guestProfileId
  // Note: In practice, the client-side code will set the profile ID correctly based on localStorage
  // For server-side, we'll use defaultAccountProfileId as higher priority fallback
  const fallbackProfileId = defaultAccountProfileId || guestProfileId;

  // Use fallback profile ID if available
  const effectiveProfileId = effectiveProfileIdRaw || fallbackProfileId;
  const actualProfileId = actualProfileIdRaw || fallbackProfileId;

  // If we still don't have valid IDs, return null (access denied)
  if (!effectiveProfileId || !actualProfileId) {
    return null;
  }

  return {
    effectiveProfileId,
    actualProfileId,
  };
}

/**
 * Requires authenticated session (no guest fallback)
 * Use this for pages that require authentication (no guest access)
 *
 * Throws an error if user is not authenticated, which should be caught
 * and handled by showing AccessDenied component
 */
export async function requireAuthenticated(): Promise<ResolvedProfileIds> {
  const session = await getSession();

  // Check if user has a valid session (not guest)
  if (!session?.effectiveProfileId || !session?.user?.profileId) {
    throw new Error("Authentication required");
  }

  return {
    effectiveProfileId: session.effectiveProfileId,
    actualProfileId: session.user.profileId,
  };
}

/**
 * Checks route access for a given pathname and session
 * Returns access result without guest profile fallback
 *
 * @param pathname - The pathname to check access for
 * @param session - The session object (can be null)
 * @returns Access check result with allowed status, reason, and role
 */
export async function checkRouteAccess(
  pathname: string,
  session: Session | null
): Promise<{
  allowed: boolean;
  reason?: "not-logged-in" | "route-denied";
  role?: ProfileRole;
}> {
  // If no session, user is not logged in
  if (!session?.effectiveProfileId || !session?.user?.profileId) {
    return {
      allowed: false,
      reason: "not-logged-in",
    };
  }

  // Get role from session
  const role = (session?.user?.role as ProfileRole) || null;

  if (!role) {
    // If we have a session but no role, deny access
    return {
      allowed: false,
      reason: "route-denied",
    };
  }

  // Check route access using route permissions
  const hasAccess = hasRouteAccess(pathname, role);

  if (!hasAccess) {
    return {
      allowed: false,
      reason: "route-denied",
      role,
    };
  }

  return {
    allowed: true,
    role,
  };
}
