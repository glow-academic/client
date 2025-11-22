// auth.ts
import { api } from "@/lib/api/client";
import { createTestSession, validateTestHeaders } from "@/lib/auth-helpers";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { headers } from "next/headers";

const appPrefix = process.env["APP_PREFIX"] || "";
const clientId = process.env["AUTH_MICROSOFT_ENTRA_ID_ID"] || "";
const clientSecret = process.env["AUTH_MICROSOFT_ENTRA_ID_SECRET"] || "";
const secret = process.env["AUTH_SECRET"] || "";

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
    MicrosoftEntraID({
      clientId,
      clientSecret,
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
          await api.post("/profile/update", {
            body: {
              profileId: existingProfile.id,
              lastLogin: new Date().toISOString(),
            },
          });
        } else {
          const nameParts = user.name?.split(" ") || [];
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts[nameParts.length - 1] || "User";

          // V3 API - create new profile via staff endpoint
          await api.post("/profile/staff/create", {
            body: {
              firstName,
              lastName,
              email: user.email || "",
              role: "guest",
            },
          });
        }
      } catch {
        // Server handles logging - no client-side logging needed
      }
    },
    async signIn({ user, profile, isNewUser }) {
      try {
        if (!user.email) {
          return;
        }

        if (!isNewUser) {
          const nameParts =
            profile?.name?.split(" ") || user.name?.split(" ") || [];
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts[nameParts.length - 1] || "User";
          if (!user.email) {
            return;
          }

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
            await api.post("/profile/update", {
              body: {
                profileId: existingProfile.id,
                firstName,
                lastName,
                lastLogin: new Date().toISOString(),
              },
            });
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
        try {
          const profileResponse = await api.post("/profile/by-email", {
            body: { email: user.email },
          });
          const profile = profileResponse.profile;

          if (profile) {
            token["profileId"] = profile.id;
            token["role"] = profile.role;
            // initialize effectiveProfileId to self
            token["effectiveProfileId"] =
              token["effectiveProfileId"] ?? profile.id;
          }
        } catch {
          // Profile not found - will be created in createUser event
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
