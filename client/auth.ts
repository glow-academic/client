import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { createProfile } from "./utils/mutations/profiles/create-profile"
import { createUser } from "./utils/mutations/users/create-user";
import { updateProfile } from "./utils/mutations/profiles/update-profile";
import { getUserByEmail } from "./utils/user/get-user-by-email";
import { getProfilesByUser } from "./utils/queries/profiles/get-profiles-by-user";

const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID || "";
const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET || "";
const secret = process.env.AUTH_SECRET || "";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID({
    clientId: clientId,
    clientSecret: clientSecret,
  })],
  secret: secret,
  callbacks: {
    async signIn({ user, profile }) {
      try {

        if (!user.id || !user.email) {
          console.error('Missing required user data:', { id: user.id, email: user.email });
          return false;
        }

        // split the name into first, middle and last, and just take the first and last
        const nameParts = profile?.name?.split(' ');
        const firstName = nameParts?.[0] || 'Unknown';
        const lastName = nameParts?.[nameParts.length - 1] || 'User';

        // remove @onwards from the email
        const alias = user.email.split('@')[0];

        const userId = user.id;

        const databaseUser = await getUserByEmail(user.email);

        if (!databaseUser) {
          console.log('Creating user:', { id: userId, email: user.email });
          await createUser({
            id: userId,
            email: user.email,
          });

          await createProfile({
            userId: userId,
            firstName: firstName,
            lastName: lastName,
            alias: alias || "",
            viewedIntro: false,
            role: 'ta',
            classIds: []
          });
        } else {
          console.log('User exists, updating profile:', { 
            existingUserId: databaseUser.id, 
            microsoftId: userId, 
            email: user.email 
          });
          
          // Get the user's profile to update it
          const userProfiles = await getProfilesByUser(databaseUser.id);
          const userProfile = userProfiles[0];
          
          if (userProfile) {
            // Update the profile with the latest information from Microsoft
            await updateProfile(userProfile.id, {
              firstName: firstName,
              lastName: lastName,
              alias: alias || "",
              lastLogin: new Date().toISOString(),
            });
            
            console.log('Updated existing user profile:', {
              profileId: userProfile.id,
              userId: databaseUser.id,
              email: user.email
            });
          } else {
            // Profile doesn't exist, create one
            console.log('Creating profile for existing user:', databaseUser.id);
            await createProfile({
              userId: databaseUser.id,
              firstName: firstName,
              lastName: lastName,
              alias: alias || "",
              viewedIntro: false,
              role: 'ta',
              classIds: []
            });
          }
        }

        return true;

      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
  },
});