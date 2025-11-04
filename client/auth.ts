// auth.ts
import { api } from "@/lib/api/client";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const appPrefix = process.env["APP_PREFIX"] || "";
const clientId = process.env["AUTH_MICROSOFT_ENTRA_ID_ID"] || "";
const clientSecret = process.env["AUTH_MICROSOFT_ENTRA_ID_SECRET"] || "";
const secret = process.env["AUTH_SECRET"] || "";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        const alias = user.email.split("@")[0];

        // V3 API - fetch profile by alias
        let existingProfile = null;
        try {
          const profileResponse = await api.post("/profile/by-alias", {
            body: { alias: alias || "" },
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
              alias: alias || "",
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
          const alias = user.email.split("@")[0] || "";
          if (!alias) {
            return;
          }

          // V3 API - fetch profile by alias
          let existingProfile = null;
          try {
            const profileResponse = await api.post("/profile/by-alias", {
              body: { alias },
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
      // On initial sign in, attach canonical profileId/role from email → alias lookup
      if (user?.email) {
        const aliasParts = user.email.split("@");
        const alias = aliasParts[0];
        if (alias && alias.length > 0) {
          // V3 API - fetch profile by alias
          try {
            const profileResponse = await api.post("/profile/by-alias", {
              body: { alias },
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
      }

      // On client `useSession().update({ ... })`, accept changes
      if (trigger === "update" && session) {
        if (typeof session.effectiveProfileId === "string") {
          token["effectiveProfileId"] = session.effectiveProfileId;
        }
        if (session.emulationTTL != null) {
          token["emulationTTL"] = session.emulationTTL;
        }
        if (session.fullEmulation != null) {
          token["fullEmulation"] = session.fullEmulation;
        }
      }

      // Optional TTL auto-revert (hardening)
      if (token["emulationTTL"] && Date.now() > Number(token["emulationTTL"])) {
        token["effectiveProfileId"] = token["profileId"];
        token["emulationTTL"] = null;
      }

      return token;
    },

    // 🌐 Expose fields to the client session
    async session({ session, token }) {
      if (session.user) {
        session.user.id = session.user.id ?? (token.sub as string);
        session.user.role = (token["role"] as string) || "guest";
        session.user.profileId = token["profileId"] as string | undefined;
      }
      session.effectiveProfileId =
        (token["effectiveProfileId"] as string) ??
        (token["profileId"] as string);
      session.emulationTTL = (token["emulationTTL"] as number | null) ?? null;
      session.fullEmulation = (token["fullEmulation"] as boolean) ?? false;
      return session;
    },
  },
});
