// auth.ts
import { log } from "@/lib/api/v2/server/logs";
import {
  createProfile,
  fetchProfileByAlias,
  updateProfileSimple,
} from "@/lib/api/v2/server/profile";
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
          log.error("auth.create_user.precheck.failed", {
            message: "Missing email for new user",
            context: { file: "client/auth.ts", function: "events.createUser" },
          });
          return;
        }
        const alias = user.email.split("@")[0];
        const existingProfile = await fetchProfileByAlias(alias || "");

        if (existingProfile) {
          // Update existing profile lastLogin
          await updateProfileSimple(existingProfile.id, {
            lastLogin: new Date().toISOString(),
          });

          await log.info("auth.profile.found", {
            subject: { entityType: "profile", entityId: existingProfile.id },
            actor: { profileId: existingProfile.id },
            context: {
              file: "client/auth.ts",
              function: "events.createUser",
            },
            message: "Found existing profile for user",
          });
        } else {
          const nameParts = user.name?.split(" ") || [];
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts[nameParts.length - 1] || "User";

          // Create new profile via server API
          await createProfile({
            firstName,
            lastName,
            alias: alias || "",
            role: "guest",
          });

          await log.info("auth.profile.created", {
            subject: { entityType: "profile" },
            context: {
              file: "client/auth.ts",
              function: "events.createUser",
              email: user.email,
              alias,
            },
            message: "Created new profile for user",
          });
        }
      } catch (error) {
        await log.error("auth.create_user.failed", {
          message: "Error handling new user",
          context: { file: "client/auth.ts", function: "events.createUser" },
          error,
        });
      }
    },
    async signIn({ user, profile, isNewUser }) {
      try {
        if (!user.email) {
          await log.error("auth.sign_in.precheck.failed", {
            message: "Missing email during sign in",
            context: { file: "client/auth.ts", function: "events.signIn" },
          });
          return;
        }

        if (!isNewUser) {
          const nameParts =
            profile?.name?.split(" ") || user.name?.split(" ") || [];
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts[nameParts.length - 1] || "User";
          const alias = user.email.split("@")[0] || "";
          if (!alias) {
            await log.error("auth.sign_in.alias.failed", {
              message: "Failed to extract alias from email",
              context: { file: "client/auth.ts", function: "events.signIn" },
            });
            return;
          }

          await log.info("auth.profile.update.start", {
            subject: { entityType: "profile" },
            context: {
              file: "client/auth.ts",
              function: "events.signIn",
              email: user.email,
              alias,
            },
            message: "Updating existing user profile",
          });

          const existingProfile = await fetchProfileByAlias(alias);
          if (existingProfile) {
            await updateProfileSimple(existingProfile.id, {
              firstName,
              lastName,
              lastLogin: new Date().toISOString(),
            });
            await log.info("auth.profile.updated", {
              subject: {
                entityType: "profile",
                entityId: existingProfile.id,
              },
              context: {
                file: "client/auth.ts",
                function: "events.signIn",
                email: user.email,
              },
              message: "Updated existing user profile",
            });
          }
        }
      } catch (error) {
        await log.error("auth.sign_in.failed", {
          message: "Error in signIn event",
          context: { file: "client/auth.ts", function: "events.signIn" },
          error,
        });
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
          const profile = await fetchProfileByAlias(alias);

          if (profile) {
            token["profileId"] = profile.id;
            token["role"] = profile.role;
            // initialize effectiveProfileId to self
            token["effectiveProfileId"] =
              token["effectiveProfileId"] ?? profile.id;
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
