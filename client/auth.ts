// auth.ts
import { profileRepo } from "@/lib/repos/profileRepo";
import { log } from "@/utils/server-logger";
import PostgresAdapter from "@auth/pg-adapter";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { Pool } from "pg";
import { getProfileByAlias } from "./utils/auth/get-profile-by-alias";
import { db_url } from "./utils/drizzle/db";

const appPrefix = process.env["APP_PREFIX"] || "";
const clientId = process.env["AUTH_MICROSOFT_ENTRA_ID_ID"] || "";
const clientSecret = process.env["AUTH_MICROSOFT_ENTRA_ID_SECRET"] || "";
const secret = process.env["AUTH_SECRET"] || "";

const pool = new Pool({
  connectionString: db_url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: `${appPrefix}/api/auth`,
  adapter: PostgresAdapter(pool),
  providers: [
    MicrosoftEntraID({
      clientId,
      clientSecret,
    }),
  ],
  secret,
  trustHost: true,
  // ✨ Use JWT strategy so we can store effectiveProfileId in the token
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
        const existingProfile = await getProfileByAlias(alias || "");

        if (existingProfile && !existingProfile.userId) {
          await profileRepo.update(existingProfile.id, {
            userId: parseInt(user.id!),
            lastLogin: new Date().toISOString(),
          });
          await log.info("auth.profile.linked", {
            subject: { entityType: "profile", entityId: existingProfile.id },
            actor: { profileId: existingProfile.id },
            context: { file: "client/auth.ts", function: "events.createUser" },
            message: "Linked existing profile to new user",
          });
        } else {
          const nameParts = user.name?.split(" ") || [];
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts[nameParts.length - 1] || "User";

          await profileRepo.create({
            userId: parseInt(user.id!),
            firstName,
            lastName,
            alias: alias || "",
            viewedIntro: false,
            role: "guest",
          });

          await log.info("auth.profile.created", {
            subject: { entityType: "profile" },
            context: {
              file: "client/auth.ts",
              function: "events.createUser",
              userId: user.id,
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

          await log.info("auth.profile.update.start", {
            subject: { entityType: "user", entityId: user.id ?? "" },
            context: {
              file: "client/auth.ts",
              function: "events.signIn",
              email: user.email,
            },
            message: "Updating existing user profile",
          });

          const userProfiles = await profileRepo.listByUser(parseInt(user.id!));
          const userProfile = userProfiles[0];
          if (userProfile) {
            await profileRepo.update(userProfile.id, {
              firstName,
              lastName,
              lastLogin: new Date().toISOString(),
            });
            await log.info("auth.profile.updated", {
              subject: { entityType: "profile", entityId: userProfile.id },
              context: {
                file: "client/auth.ts",
                function: "events.signIn",
                userId: user.id,
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
      // On initial sign in, attach canonical profileId/role
      if (user?.id) {
        // your DB lookup to map user.id -> default profile
        const profiles = await profileRepo.listByUser(parseInt(user.id));
        const primary = profiles?.[0];
        if (primary) {
          token["profileId"] = primary.id;
          token["role"] = primary.role;
          // initialize effectiveProfileId to self
          token["effectiveProfileId"] =
            token["effectiveProfileId"] ?? primary.id;
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
