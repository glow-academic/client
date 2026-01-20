// auth.ts
import { api } from "@/lib/api/client";
import { createTestSession, validateTestHeaders } from "@/lib/auth-helpers";
import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { headers } from "next/headers";
import { cache } from "react";

const appPrefix = process.env["APP_PREFIX"] || "";
const secret = process.env["AUTH_SECRET"] || "";

// Keycloak configuration - read from environment (pre-shared secret strategy)
// Use localhost (Node.js will resolve to IPv4 via NODE_OPTIONS in Makefile)
const keycloakPublicUrl =
  process.env["KEYCLOAK_PUBLIC_URL"] || "http://localhost:8080";
const keycloakClientId = process.env["AUTH_KEYCLOAK_ID"] || "glow-client";
const keycloakClientSecret = process.env["AUTH_KEYCLOAK_SECRET"] || "";

// Default issuer (master realm) - used as fallback
const defaultIssuer = `${keycloakPublicUrl}/realms/master`;

// Helper function to create a profile with guest role
async function createGuestProfile(
  email: string,
  name: string | null | undefined
): Promise<void> {
  const profileName = (name ?? "").trim() || "Unknown User";
  try {
    // Use auth/upsert endpoint to create or update profile
    // profile_id_new is optional - SQL generates it server-side if not provided
    await api.post("/auth/upsert", {
      body: {
        name: profileName,
        emails: [email],
        role: "guest",
        primary_email_index: 0,
        active: true,
        cohort_ids: [],
        department_ids: [],
      },
    });
  } catch (error) {
    // Log error but don't throw - profile creation might fail if email already exists
    // (race condition with createUser event), which is acceptable
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Only log if it's not an "already exists" error (which is expected in race conditions)
    if (!errorMessage.toLowerCase().includes("already exists")) {
      // eslint-disable-next-line no-console
      console.error(
        `Failed to create guest profile for ${email}:`,
        errorMessage
      );
    }
  }
}

// NOTE: also export `unstable_update` as `update` for server-side session mutation
export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: update,
} = NextAuth({
  basePath: `${appPrefix}/api/auth`,
  providers: [
    // Single Keycloak provider - frontend controls which identity provider via kc_idp_hint
    // Realm selection: Dynamic based on realm-name cookie set by Login component
    // Each department gets its own realm (master for default, department_id for others)
    Keycloak({
      clientId: keycloakClientId,
      clientSecret: keycloakClientSecret,
      issuer: defaultIssuer, // Always use master realm
      allowDangerousEmailAccountLinking: true, // Allow merging Google/MS accounts with same email
      authorization: async ({
        params,
      }: {
        params: Record<string, string | undefined>;
      }) => {
        // Always use master realm (organizations replace multi-realm architecture)
        const realmIssuer = `${keycloakPublicUrl}/realms/master`;
        const authorizationUrl = new URL(
          `${realmIssuer}/protocol/openid-connect/auth`
        );

        // Always use single glow-client for all OAuth flows
        // Department filtering is handled by Keycloak theme via ?department URL parameter
        authorizationUrl.searchParams.set("client_id", keycloakClientId);

        const redirectUri = params["redirect_uri"];
        if (redirectUri) {
          authorizationUrl.searchParams.set("redirect_uri", redirectUri);
        }
        authorizationUrl.searchParams.set("response_type", "code");
        authorizationUrl.searchParams.set(
          "scope",
          params["scope"] || "openid profile email"
        );
        const state = params["state"];
        if (state) {
          authorizationUrl.searchParams.set("state", state);
        }
        const codeChallenge = params["code_challenge"];
        if (codeChallenge) {
          authorizationUrl.searchParams.set("code_challenge", codeChallenge);
          authorizationUrl.searchParams.set("code_challenge_method", "S256");
        }

        // Preserve department parameter if present (passed from frontend redirect)
        const department = params["department"];
        if (department) {
          authorizationUrl.searchParams.set("department", department);
        }

        const idpHint = params["kc_idp_hint"];
        if (idpHint) {
          authorizationUrl.searchParams.set("kc_idp_hint", idpHint);
        }
        const loginHint = params["login_hint"];
        if (loginHint) {
          authorizationUrl.searchParams.set("login_hint", loginHint);
        }

        return authorizationUrl.toString();
      },
    }),
  ],
  secret,
  trustHost: true,
  // ✨ Use JWT strategy - no database adapter needed
  session: { strategy: "jwt" },
  events: {
    async createUser({ user }) {
      try {
        if (!user.email) {
          return;
        }
        // V3 API - fetch profile by email
        let existingProfile = null;
        try {
          const profileResponse = await api.post("/auth/email", {
            body: { email: user.email || "" },
          });
          // API response has profile_id directly, not nested in profile object
          existingProfile = profileResponse.profile_id
            ? {
                id: profileResponse.profile_id,
                role: profileResponse.role || "guest",
              }
            : null;
        } catch {
          // Profile not found, will create new one
          existingProfile = null;
        }

        if (existingProfile) {
          // Use auth/upsert endpoint to update existing profile
          // Note: last_login and last_active are not supported by upsert endpoint
          // These may need to be handled separately or the endpoint extended
          const profileName = (user.name ?? "").trim() || "Unknown User";
          try {
            // Use auth/upsert endpoint to update existing profile
            // profile_id_new is optional - SQL finds existing profile by email and uses that ID
            await api.post("/auth/upsert", {
              body: {
                name: profileName,
                emails: [user.email || ""],
                role: existingProfile.role || "guest",
                primary_email_index: 0,
                active: true,
                cohort_ids: [],
                department_ids: [],
              },
            });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to update profile ${existingProfile.id}:`,
              error instanceof Error ? error.message : String(error)
            );
          }
        } else {
          // Create new profile with guest role
          await createGuestProfile(user.email, user.name);
        }
      } catch (error) {
        // Log critical errors but don't break auth flow
        // eslint-disable-next-line no-console
        console.error(
          `Error in createUser event for ${user.email}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    },
    async signIn({ user, profile, isNewUser }) {
      try {
        if (!user.email) {
          return;
        }

        if (!isNewUser) {
          if (!user.email) {
            return;
          }

          const profileName =
            (profile?.name || user.name || "").trim() || "Unknown User";

          // V3 API - fetch profile by email
          let existingProfile = null;
          try {
            const profileResponse = await api.post("/auth/email", {
              body: { email: user.email },
            });
            // API response has profile_id directly, not nested in profile object
            existingProfile = profileResponse.profile_id
              ? {
                  id: profileResponse.profile_id,
                  role: profileResponse.role || "guest",
                }
              : null;
          } catch {
            // Profile not found
            existingProfile = null;
          }

          if (existingProfile) {
            // Use auth/upsert endpoint to update profile
            // Note: last_login and last_active are not supported by upsert endpoint
            // These may need to be handled separately or the endpoint extended
            // profile_id_new is optional - SQL finds existing profile by email and uses that ID
            try {
              await api.post("/auth/upsert", {
                body: {
                  name: profileName,
                  emails: [user.email],
                  role: existingProfile.role || "guest",
                  primary_email_index: 0,
                  active: true,
                  cohort_ids: [],
                  department_ids: [],
                },
              });
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(
                `Failed to update profile ${existingProfile.id}:`,
                error instanceof Error ? error.message : String(error)
              );
            }
          }
        }
      } catch {
        // Server handles logging - no client-side logging needed
      }
    },
  },
  callbacks: {
    // 🔑 Put identity & emulation into the JWT
    async jwt({ token, user, account, trigger, session }) {
      // Save the ID Token to the JWT on initial sign-in
      if (account && account["id_token"]) {
        token["id_token"] = account["id_token"];
      }

      // On initial sign in, attach canonical profileId/role from email lookup
      if (user?.email) {
        // V3 API - fetch profile by email
        let profile = null;
        try {
          const profileResponse = await api.post("/auth/email", {
            body: { email: user.email },
          });
          // API response has profile_id directly, not nested in profile object
          profile = profileResponse.profile_id
            ? {
                id: profileResponse.profile_id,
                role: profileResponse.role || "guest",
              }
            : null;
        } catch {
          // Profile not found - create it synchronously as fallback
          // This handles race conditions where createUser event hasn't completed yet
          try {
            await createGuestProfile(user.email, user.name);
            // Retry fetching the profile after creation
            try {
              const profileResponse = await api.post("/auth/email", {
                body: { email: user.email },
              });
              // API response has profile_id directly, not nested in profile object
              profile = profileResponse.profile_id
                ? {
                    id: profileResponse.profile_id,
                    role: profileResponse.role || "guest",
                  }
                : null;
            } catch (retryError) {
              // eslint-disable-next-line no-console
              console.error(
                `Failed to fetch profile after creation for ${user.email}:`,
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError)
              );
            }
          } catch (createError) {
            // Log error but don't block authentication
            // createGuestProfile already logs errors internally
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create profile in jwt callback for ${user.email}:`,
              createError instanceof Error
                ? createError.message
                : String(createError)
            );
          }
        }

        if (profile) {
          token["profileId"] = profile.id;
          token["role"] = profile.role || "guest"; // Ensure role defaults to guest
          // initialize effectiveProfileId to self
          token["effectiveProfileId"] =
            token["effectiveProfileId"] ?? profile.id;
        } else {
          // If profile still doesn't exist after creation attempt, set default role
          // This ensures the user can still authenticate even if profile creation failed
          token["role"] = token["role"] || "guest";
        }
      }

      // Accept client/server updates (trigger: "update")
      if (trigger === "update" && session) {
        if (typeof session.effectiveProfileId === "string") {
          token["effectiveProfileId"] = session.effectiveProfileId;
        }
        if ("emulationTTL" in session) {
          token["emulationTTL"] =
            (session.emulationTTL as number | null) ?? null;
        }
        if ("fullEmulation" in session) {
          token["fullEmulation"] = !!session.fullEmulation;
        }
      }

      // TTL auto-revert (hardening)
      if (token["emulationTTL"] && Date.now() > Number(token["emulationTTL"])) {
        token["effectiveProfileId"] = token["profileId"] ?? null;
        token["fullEmulation"] = false; // also clear fullEmulation
        token["emulationTTL"] = null;
      }

      return token;
    },

    // 🌐 Expose to client session
    async session({ session, token }) {
      // Ensure user object exists (for unauthenticated sessions resolved server-side)
      if (!session.user && token["profileId"]) {
        session.user = {
          id: token["profileId"] as string,
          name: null,
          email: null,
          image: null,
        } as typeof session.user;
      }

      if (session.user) {
        session.user.id =
          session.user.id ??
          (token.sub as string) ??
          (token["profileId"] as string);
        session.user.role = (token["role"] as string) || "guest";
        const profileId = token["profileId"] as string | undefined;
        if (profileId) {
          session.user.profileId = profileId;
        }
      }

      session.effectiveProfileId =
        (token["effectiveProfileId"] as string) ??
        (token["profileId"] as string) ??
        null;
      session.emulationTTL = (token["emulationTTL"] as number | null) ?? null;
      session.fullEmulation = !!(token["fullEmulation"] as boolean);

      // Pass the ID Token to the client for silent logout
      if (token["id_token"]) {
        session.id_token = token["id_token"] as string;
      }

      return session;
    },
  },
});

/**
 * Unified session getter
 *
 * Auth flow:
 * 1. Check for test headers (for E2E testing)
 * 2. Get NextAuth session (handles authenticated users via JWT callback)
 *
 * Returns:
 * - Session: NextAuth session (with id_token for authenticated users)
 * - null: No session available
 *
 * Note: Profile resolution happens in the JWT callback.
 *
 * Wrapped with React cache() to deduplicate calls within the same request.
 */
export const getSession = cache(async () => {
  // Step 1: Check for test headers (E2E testing override)
  try {
    const headerList = await headers();
    const override = validateTestHeaders(headerList);
    if (override) {
      return createTestSession(override);
    }
  } catch {
    // Ignore header access errors and fall back to real auth.
  }

  // Step 2: Get NextAuth session (JWT callback handles profile resolution)
  return await auth();
});
