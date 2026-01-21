import "next-auth";
import { type DefaultSession } from "next-auth";

// ---- Type augmentation (Session & JWT) ----
declare module "next-auth" {
  interface Session {
    id_token?: string | undefined;
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
    id_token?: string;
  }
}
