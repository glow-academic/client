import "next-auth";

// ---- Type augmentation (Session & JWT) ----
declare module "next-auth" {
  interface Session {
    id_token?: string | undefined;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id_token?: string;
  }
}
