// auth.ts
import { api } from "@/lib/api/client";
import { createTestSession, validateTestHeaders } from "@/lib/auth-helpers";
import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { headers } from "next/headers";

const appPrefix = process.env["APP_PREFIX"] || "";
const secret = process.env["AUTH_SECRET"] || "";

// Keycloak configuration - read from environment (pre-shared secret strategy)
// Use localhost (Node.js will resolve to IPv4 via NODE_OPTIONS in Makefile)
const keycloakPublicUrl =
  process.env["KEYCLOAK_PUBLIC_URL"] || "http://localhost:8080";
const keycloakRealm = process.env["KEYCLOAK_REALM"] || "glow";
const keycloakClientId = process.env["AUTH_KEYCLOAK_ID"] || "glow-client";
const keycloakClientSecret = process.env["AUTH_KEYCLOAK_SECRET"] || "";
const issuer = `${keycloakPublicUrl}/realms/${keycloakRealm}`;

// Helper function to parse name into firstName and lastName
function parseName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const nameParts = name?.split(" ") || [];
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts[nameParts.length - 1] || "User";
  return { firstName, lastName };
}

// Helper function to create a profile with guest role
async function createGuestProfile(
  email: string,
  name: string | null | undefined
): Promise<void> {
  const { firstName, lastName } = parseName(name);
  try {
    await api.post("/profile/staff/create", {
      body: {
        firstName,
        lastName,
        emails: [email],
        role: "guest",
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
    Keycloak({
      clientId: keycloakClientId,
      clientSecret: keycloakClientSecret,
      issuer: issuer,
      allowDangerousEmailAccountLinking: true, // Allow merging Google/MS accounts with same email
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
          const profileResponse = await api.post("/profile/by-email", {
            body: { email: user.email || "" },
          });
          existingProfile = profileResponse.profile;
        } catch {
          // Profile not found, will create new one
          existingProfile = null;
        }

        if (existingProfile) {
          // V3 API - update existing profile lastLogin
          try {
            await api.post("/profile/update", {
              body: {
                profileId: existingProfile.id,
                lastLogin: new Date().toISOString(),
              },
            });
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to update lastLogin for profile ${existingProfile.id}:`,
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

          const { firstName, lastName } = parseName(profile?.name || user.name);

          // V3 API - fetch profile by email
          let existingProfile = null;
          try {
            const profileResponse = await api.post("/profile/by-email", {
              body: { email: user.email },
            });
            existingProfile = profileResponse.profile;
          } catch {
            // Profile not found
            existingProfile = null;
          }

          if (existingProfile) {
            // V3 API - update profile
            try {
              await api.post("/profile/update", {
                body: {
                  profileId: existingProfile.id,
                  firstName,
                  lastName,
                  lastLogin: new Date().toISOString(),
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
    async jwt({ token, user, trigger, session }) {
      // On initial sign in, attach canonical profileId/role from email lookup
      if (user?.email) {
        // V3 API - fetch profile by email
        let profile = null;
        try {
          const profileResponse = await api.post("/profile/by-email", {
            body: { email: user.email },
          });
          profile = profileResponse.profile;
        } catch {
          // Profile not found - create it synchronously as fallback
          // This handles race conditions where createUser event hasn't completed yet
          try {
            await createGuestProfile(user.email, user.name);
            // Retry fetching the profile after creation
            try {
              const profileResponse = await api.post("/profile/by-email", {
                body: { email: user.email },
              });
              profile = profileResponse.profile;
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
      if (session.user) {
        session.user.id = session.user.id ?? (token.sub as string);
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

      return session;
    },
  },
});

export async function getSession() {
  try {
    const headerList = await headers();
    const override = validateTestHeaders(headerList);
    if (override) {
      return createTestSession(override);
    }
  } catch {
    // Ignore header access errors and fall back to real auth.
  }

  return auth();
}
