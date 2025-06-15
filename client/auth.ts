import { logError, logInfo } from "@/utils/logger";
import PostgresAdapter from "@auth/pg-adapter";
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { Pool } from "pg";
import { db_url } from "./utils/drizzle/database";
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
  events: {
    async createUser({ user }) {
      try {
        if (!user.email) {
          logError("Missing email for new user:", { userId: user.id });
          return;
        }

        // Get user info from Microsoft profile (available in the session)
        const nameParts = user.name?.split(" ") || [];
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts[nameParts.length - 1] || "User";
        const alias = user.email.split("@")[0];

        logInfo("Creating profile for new user:", {
          userId: user.id,
          email: user.email,
        });

        await createProfile({
          userId: parseInt(user.id!),
          firstName: firstName,
          lastName: lastName,
          alias: alias || "",
          viewedIntro: false,
          role: "ta",
          classIds: [],
        });

        logInfo("Profile created successfully for user:", {
          userId: user.id,
          email: user.email,
        });
      } catch (error) {
        logError("Error creating profile for new user:", error);
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
          const alias = user.email.split("@")[0];

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
              alias: alias || "",
              lastLogin: new Date().toISOString(),
            });

            logInfo("Updated existing user profile:", {
              profileId: userProfile.id,
              userId: user.id,
              email: user.email,
            });
          } else {
            // Profile doesn't exist, create one
            logInfo("Creating profile for existing user without profile:", {
              userId: user.id,
              email: user.email,
            });
            await createProfile({
              userId: parseInt(user.id!),
              firstName: firstName,
              lastName: lastName,
              alias: alias || "",
              viewedIntro: false,
              role: "ta",
              classIds: [],
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
