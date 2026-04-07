// auth.ts
//
// Standard OIDC authentication via Glow API.
// The Glow API is the OIDC provider — it handles Keycloak, Google,
// Microsoft, and profile-based login internally. The client just
// uses standard OIDC and never needs to know what's behind it.

import NextAuth from "next-auth";
import { cache } from "react";

const appPrefix = process.env["APP_PREFIX"] || "";
const secret = process.env["AUTH_SECRET"] || "";

// OIDC configuration — Glow API is the identity provider
// issuer = public URL (must match the API's OIDC discovery "issuer" field)
// internalBase = Docker network URL for server-side fetches (when API is airgapped)
const issuer = process.env["AUTH_ISSUER"] || process.env["INTERNAL_API_BASE"] || "http://localhost:8000";
const internalBase = process.env["INTERNAL_API_BASE"] || issuer;
const clientId = process.env["AUTH_CLIENT_ID"] || "glow-client";
const clientSecret = process.env["AUTH_CLIENT_SECRET"] || secret;

export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: update,
} = NextAuth({
  basePath: `${appPrefix}/api/auth`,
  providers: [
    {
      id: "glow",
      name: "Glow",
      type: "oauth",
      // Manual endpoints — avoids OIDC auto-discovery fetch to unreachable public URL
      issuer,
      authorization: { url: `${issuer}/authorize`, params: { scope: "openid profile email" } },
      token: `${internalBase}/token`,
      userinfo: `${internalBase}/userinfo`,
      jwks_endpoint: `${internalBase}/jwks`,
      clientId,
      clientSecret,
      allowDangerousEmailAccountLinking: true,
      checks: ["state"],
      idToken: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
        };
      },
    },
  ],
  secret,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  callbacks: {
    // Auto-redirect to OIDC provider when not authenticated (skip sign-in page)
    authorized({ auth: session }) {
      return !!session?.user;
    },
    // Store id_token in JWT — server resolves identity from it on every request
    async jwt({ token, account }) {
      if (account?.id_token) {
        token["id_token"] = account.id_token;
      }
      return token;
    },

    // Expose id_token + issuer to client session (needed for API auth + OIDC logout)
    async session({ session, token }) {
      if (session.user) {
        session.user.id = session.user.id ?? (token.sub as string);
      }

      if (token["id_token"]) {
        session.id_token = token["id_token"] as string;
      }

      // Expose issuer so client-side can construct standard OIDC logout URL
      session.issuer = issuer;

      return session;
    },
  },
});

/**
 * Unified session getter — returns the NextAuth session.
 * Profile resolution happens server-side in resolve_identity middleware.
 * Wrapped with React cache() to deduplicate calls within the same request.
 */
export const getSession = cache(async () => {
  return await auth();
});
