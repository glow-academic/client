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

/** Read the `exp` (epoch seconds) from a JWT without verifying it. */
function decodeJwtExp(idToken: string | undefined): number | undefined {
  if (!idToken) return undefined;
  const payload = idToken.split(".")[1];
  if (!payload) return undefined;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: number };
    return typeof claims.exp === "number" ? claims.exp : undefined;
  } catch {
    return undefined;
  }
}

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
    // Store id_token in JWT — server resolves identity from it on every
    // request — and keep it fresh. The id_token expires at ~1h but the
    // session cookie lives much longer; without refresh, API calls would
    // start 401'ing an hour after login. On initial sign-in we persist the
    // refresh_token + expiry; on later calls we renew before expiry.
    async jwt({ token, account }) {
      // Initial sign-in: persist id/refresh tokens + expiry from the provider.
      if (account) {
        token["id_token"] = account.id_token;
        token["refresh_token"] = account.refresh_token as string | undefined;
        token["expires_at"] =
          (account.expires_at as number | undefined) ??
          decodeJwtExp(account.id_token) ??
          Math.floor(Date.now() / 1000) + 3600;
        delete token["error"];
        return token;
      }

      // Still valid (more than 60s of headroom)? Use as-is.
      const expiresAt = token["expires_at"];
      if (expiresAt && Date.now() < expiresAt * 1000 - 60_000) {
        return token;
      }

      // Expired/near-expiry: rotate via the refresh_token grant.
      const refreshToken = token["refresh_token"];
      if (!refreshToken) {
        token["error"] = "RefreshTokenMissing";
        return token;
      }
      try {
        const res = await fetch(`${issuerInternal}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });
        if (!res.ok) {
          throw new Error(`token refresh failed: HTTP ${res.status}`);
        }
        const refreshed = (await res.json()) as {
          id_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        if (refreshed.id_token) token["id_token"] = refreshed.id_token;
        // The API rotates refresh tokens, so adopt the new one (fall back to
        // the old if the response omitted it).
        token["refresh_token"] = refreshed.refresh_token ?? refreshToken;
        token["expires_at"] =
          Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600);
        delete token["error"];
      } catch {
        // Keep the (expired) token but flag the failure so the session
        // surfaces it; the next request can force a fresh sign-in.
        token["error"] = "RefreshAccessTokenError";
      }
      return token;
    },

    // Shape the client-visible session. SECURITY: the raw API bearer
    // (`id_token`) is deliberately NOT copied onto the session here, so it
    // never reaches `/api/auth/session` or client props where JS/XSS could
    // read it. The bearer stays in the encrypted, httpOnly JWT above;
    // server-side consumers read it via `getServerIdToken()` (getToken).
    // The client gets only a boolean auth flag + the public issuer; it
    // fetches the bearer on demand from the cookie-authed `/api/ws-ticket`
    // route for the two legitimate client-side credential needs (the WS
    // handshake and the OIDC logout `id_token_hint`).
    async session({ session, token }) {
      if (session.user) {
        session.user.id = session.user.id ?? (token.sub as string);
      }

      // Non-sensitive presence flag so the layout / snapshot can tell
      // "logged in?" without shipping the bearer to the browser.
      session.authenticated = !!token["id_token"];

      // Surface a refresh failure so the UI can force re-login.
      if (token["error"]) {
        session.error = token["error"] as string;
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
