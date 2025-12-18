import { createHmac, timingSafeEqual } from "crypto";
import type { Session } from "next-auth";
import { cookies } from "next/headers";

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

export type ResolvedProfileIds = {
  effectiveProfileId: string;
  actualProfileId: string;
};

export function validateTestHeaders(
  headers: HeaderLike,
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
 * Checks route access for a given pathname and session
 * Returns access result without guest profile fallback
 *
 * @param pathname - The pathname to check access for
 * @param session - The session object (can be null)
 * @returns Access check result with allowed status, reason, and role
 */
export async function checkRouteAccess(
  pathname: string,
  session: Session | null,
): Promise<{
  allowed: boolean;
  reason?: "not-logged-in" | "route-denied";
  role?: ProfileRole;
}> {
  // Check if we have session profile IDs (authenticated user)
  const hasSessionProfileIds =
    session?.effectiveProfileId && session?.user?.profileId;

  // If no session profile IDs, check for guest/default-account cookies
  if (!hasSessionProfileIds) {
    try {
      const cookieStore = await cookies();
      const authMode = cookieStore.get("auth-mode")?.value;

      // If we have auth-mode cookie (guest/default-account), resolve profile to check role
      if (
        authMode &&
        (authMode === "default-guest" || authMode === "default-account")
      ) {
        // Resolve profile from cookies to get role for permission check
        // We need to do this here to properly deny access to unauthorized routes
        try {
          const { api } = await import("@/lib/api/client");
          const cookieHeader = [
            cookieStore.get("department-id")?.value &&
              `department-id=${cookieStore.get("department-id")?.value}`,
            cookieStore.get("auth-mode")?.value &&
              `auth-mode=${cookieStore.get("auth-mode")?.value}`,
          ]
            .filter(Boolean)
            .join("; ");

          const profileContext = await api.post(
            "/profile/context",
            {
              body: {
                actualProfileId: null as unknown as string,
                effectiveProfileId: null as unknown as string,
                pathname: "/",
              },
            },
            cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
          );

          const role =
            (profileContext.effectiveProfile?.role as ProfileRole) || null;

          if (!role) {
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
        } catch {
          // If profile resolution fails, deny access
          return {
            allowed: false,
            reason: "not-logged-in",
          };
        }
      }
    } catch {
      // Ignore cookie access errors
    }

    // No session IDs and no cookies - user is not logged in
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
