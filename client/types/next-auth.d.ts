import "next-auth";
import { type DefaultSession } from "next-auth";

// ---- Type augmentation (Session & JWT) ----
declare module "next-auth" {
  interface Session {
    effectiveProfileId?: string | null;
    fullEmulation?: boolean;
    emulationTTL?: number | null;
    user: DefaultSession["user"] & {
      profileId?: string;
      role?: string;
    };
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
    effectiveProfileId?: string | null;
    fullEmulation?: boolean;
    emulationTTL?: number | null;
  }
}
