import "next-auth";

declare module "next-auth" {
  interface Session {
    effectiveProfileId?: string;
    emulationTTL?: number | null;
    fullEmulation?: boolean;
    user: {
      id: string;
      role?: string;
      profileId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    profileId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    profileId?: string;
    role?: string;
    effectiveProfileId?: string;
    emulationTTL?: number | null;
    fullEmulation?: boolean;
  }
}
