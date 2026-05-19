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
const issuer = process.env["AUTH_ISSUER"] || "http://localhost:8000";
// Container-reachable URL for OIDC endpoints the *Next.js server* calls
// directly (token, userinfo, jwks). Defaults to `issuer` — in production
// with real DNS those are the same. In a single-host local deploy the
// container can't reach a `localhost:<port>` issuer, so the CLI sets this
// to the api's shared-net alias (e.g. http://glow-X-api-nginx:80). The
// iss claim on the token still equals `issuer` (browser-visible URL).
const issuerInternal = process.env["AUTH_ISSUER_INTERNAL"] || issuer;
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
      type: "oidc",
      issuer,
      // Explicitly pin each endpoint so NextAuth skips `.well-known` discovery
      // (which would otherwise have to be fetched from the container against
      // a possibly-unreachable public issuer URL). Browser-facing endpoints
      // use the public issuer; backend-facing ones use the internal URL.
      authorization: { url: `${issuer}/authorize` },
      token: { url: `${issuerInternal}/token` },
      userinfo: { url: `${issuerInternal}/userinfo` },
      jwks_endpoint: `${issuerInternal}/jwks`,
      clientId,
      clientSecret,
      allowDangerousEmailAccountLinking: true,
    },
  ],
  secret,
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
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
