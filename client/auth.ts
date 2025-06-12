import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { createProfile } from "./utils/mutations/profiles/create-profile"
import { createUser } from "./utils/mutations/users/create-user";
import { getUser } from "./utils/queries/users/get-user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID({
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
  })],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user, profile }) {
      const databaseUser = await getUser(user.id!);
      const userId = user.id!;
      if (!databaseUser) {
        await createUser({
          id: user.id!,
          email: user.email!,
        });
      }
      await createProfile({
        userId: userId,
        firstName: profile?.given_name || user.name?.split(' ')[0] || 'Unknown',
        lastName: profile?.family_name || user.name?.split(' ').slice(1).join(' ') || 'User',
        email: user.email!,
        viewedIntro: false,
        role: 'admin',
        classIds: []
      });
      return true;
    },
  },
});