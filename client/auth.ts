// auth.ts
import { logError, logInfo } from "@/utils/logger";
import PostgresAdapter from "@auth/pg-adapter";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { Pool } from "pg";
import { getProfileByAlias } from "./utils/auth/get-profile-by-alias";
import { db_url } from "./utils/drizzle/db";
import { createProfile } from "./utils/mutations/profiles/create-profile";
import { updateProfile } from "./utils/mutations/profiles/update-profile";
import { getProfilesByUser } from "./utils/queries/profiles/get-profiles-by-user";

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
          logError("Missing email for new user:", { userId: user.id });
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

          logInfo("Linked existing profile to new user:", {
            profileId: existingProfile.id,
            userId: user.id,
            email: user.email,
            alias: alias,
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
            role: "ta",
            classIds: [],
          });

          logInfo("Created new profile for user:", {
            userId: user.id,
            email: user.email,
            alias: alias,
          });
        }
      } catch (error) {
        logError("Error handling new user:", error);
      }
    },
    async signIn({ user, profile, isNewUser }) {
      try {
        if (!user.email) {
          logError("Missing email during sign in:", { userId: user.id });
          return;
        }

        // If this is not a new user, update their profile with latest info
        if (!isNewUser) {
          const nameParts =
            profile?.name?.split(" ") || user.name?.split(" ") || [];
          const firstName = nameParts[0] || "Unknown";
          const lastName = nameParts[nameParts.length - 1] || "User";

          logInfo("Updating existing user profile:", {
            userId: user.id,
            email: user.email,
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

            logInfo("Updated existing user profile:", {
              profileId: userProfile.id,
              userId: user.id,
              email: user.email,
            });
          }
        }
      } catch (error) {
        logError("Error in signIn event:", error);
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
