// auth.ts
import { log } from "@/utils/server-logger";
import PostgresAdapter from "@auth/pg-adapter";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { Pool } from "pg";
import { getProfileByAlias } from "./utils/auth/get-profile-by-alias";
import { db_url } from "./utils/drizzle/db";
import { createProfile } from "./utils/mutations/profiles/create-profile";
import { updateProfile } from "./utils/mutations/profiles/update-profile";
import { getProfilesByUser } from "./utils/queries/profiles/get-profiles-by-user";

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
      clientId: clientId,
      clientSecret: clientSecret,
    }),
  ],
  secret: secret,
  trustHost: true,
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

        // Extract alias from email
        const alias = user.email.split("@")[0];

        // Check if a profile already exists with this alias (pre-seeded profile)
        const existingProfile = await getProfileByAlias(alias || "");

        if (existingProfile && !existingProfile.userId) {
          // Link the existing profile to this new user
          await updateProfile(existingProfile.id, {
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
          // Create a new profile for this user
          const nameParts = user.name?.split(" ") || [];
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts[nameParts.length - 1] || "User";

          await createProfile({
            userId: parseInt(user.id!),
            firstName: firstName,
            lastName: lastName,
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

        // If this is not a new user, update their profile with latest info
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

          // Get the user's profile to update it
          const userProfiles = await getProfilesByUser(parseInt(user.id!));
          const userProfile = userProfiles[0];

          if (userProfile) {
            await updateProfile(userProfile.id, {
              firstName: firstName,
              lastName: lastName,
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
    async session({ session, user }) {
      // Add user ID to session for easier access
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
