import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./utils/drizzle/database"
import { createProfile } from "./utils/mutations/profiles/create-profile"
import { accounts, sessions, users, verificationToken } from "./drizzle/schema"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    verificationTokensTable: verificationToken,
    sessionsTable: sessions,
  }),
  providers: [MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  })],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account && account.isNewUser) {
        // If it's a new user, create a profile in your database
        await createProfile({
          userId: user.id!,
          firstName: profile?.given_name || user.name?.split(' ')[0] || 'Unknown',
          lastName: profile?.family_name || user.name?.split(' ').slice(1).join(' ') || 'User',
          email: user.email!,
          viewedIntro: false,
          role: 'ta',
          classIds: []
        });
      }
      return true;
    },
  },
});