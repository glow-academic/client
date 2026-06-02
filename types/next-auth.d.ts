import "next-auth";

// ---- Type augmentation (Session & JWT) ----
declare module "next-auth" {
  interface Session {
    id_token?: string | undefined;
    issuer?: string | undefined;
    // Set when a background token refresh failed — the client can watch for
    // this and force a re-login instead of silently making 401'd API calls.
    error?: string | undefined;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id_token?: string | undefined;
    // OIDC refresh token + the access/id token expiry (epoch seconds), used by
    // the jwt callback to renew the id_token before it dies at ~1h.
    refresh_token?: string | undefined;
    expires_at?: number | undefined;
    error?: string | undefined;
  }
}
