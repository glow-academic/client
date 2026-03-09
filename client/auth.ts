// auth.ts
//
// Profile creation and resolution are handled entirely server-side by
// resolve_identity() in the API middleware. The client just stores the
// Keycloak id_token and passes it as Bearer token on every request.
// The server auto-creates guest profiles on first login.

import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { cache } from "react";

const appPrefix = process.env["APP_PREFIX"] || "";
const secret = process.env["AUTH_SECRET"] || "";

// Keycloak configuration - read from environment (pre-shared secret strategy)
// Use localhost (Node.js will resolve to IPv4 via NODE_OPTIONS in Makefile)
const keycloakPublicUrl =
  process.env["KEYCLOAK_PUBLIC_URL"] || "http://localhost:8080";
const keycloakClientId = process.env["AUTH_KEYCLOAK_ID"] || "glow-client";
const keycloakClientSecret = process.env["AUTH_KEYCLOAK_SECRET"] || "";

// Default issuer (master realm) - used as fallback
const defaultIssuer = `${keycloakPublicUrl}/realms/master`;

// NOTE: also export `unstable_update` as `update` for server-side session mutation
export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: update,
} = NextAuth({
  basePath: `${appPrefix}/api/auth`,
  providers: [
    // Single Keycloak provider - frontend controls which identity provider via kc_idp_hint
    // Always use master realm (organizations replace multi-realm architecture)
    Keycloak({
      clientId: keycloakClientId,
      clientSecret: keycloakClientSecret,
      issuer: defaultIssuer, // Always use master realm
      allowDangerousEmailAccountLinking: true, // Allow merging Google/MS accounts with same email
      authorization: async ({
        params,
      }: {
        params: Record<string, string | undefined>;
      }) => {
        // Always use master realm (organizations replace multi-realm architecture)
        const realmIssuer = `${keycloakPublicUrl}/realms/master`;
        const authorizationUrl = new URL(
          `${realmIssuer}/protocol/openid-connect/auth`
        );

        // Always use single glow-client for all OAuth flows
        // Department filtering is handled by Keycloak theme via ?department URL parameter
        authorizationUrl.searchParams.set("client_id", keycloakClientId);

        const redirectUri = params["redirect_uri"];
        if (redirectUri) {
          authorizationUrl.searchParams.set("redirect_uri", redirectUri);
        }
        authorizationUrl.searchParams.set("response_type", "code");
        authorizationUrl.searchParams.set(
          "scope",
          params["scope"] || "openid profile email"
        );
        const state = params["state"];
        if (state) {
          authorizationUrl.searchParams.set("state", state);
        }
        const codeChallenge = params["code_challenge"];
        if (codeChallenge) {
          authorizationUrl.searchParams.set("code_challenge", codeChallenge);
          authorizationUrl.searchParams.set("code_challenge_method", "S256");
        }

        // Preserve department parameter if present (passed from frontend redirect)
        const department = params["department"];
        if (department) {
          authorizationUrl.searchParams.set("department", department);
        }

        const idpHint = params["kc_idp_hint"];
        if (idpHint) {
          authorizationUrl.searchParams.set("kc_idp_hint", idpHint);
        }
        const loginHint = params["login_hint"];
        if (loginHint) {
          authorizationUrl.searchParams.set("login_hint", loginHint);
          // Force re-authentication when emulating (login_hint indicates emulation grant)
          // Without this, Keycloak reuses existing session and skips IdP flow
          authorizationUrl.searchParams.set("prompt", "login");
        }

        return authorizationUrl.toString();
      },
    }),
  ],
  secret,
  trustHost: true,
  // Use JWT strategy - no database adapter needed
  session: { strategy: "jwt" },
  callbacks: {
    // Store id_token in JWT — server resolves identity from it on every request
    async jwt({ token, account }) {
      if (account?.id_token) {
        token["id_token"] = account.id_token;
      }
      return token;
    },

    // Expose id_token to client session (needed for API auth + federated logout)
    async session({ session, token }) {
      if (session.user) {
        session.user.id = session.user.id ?? (token.sub as string);
      }

      if (token["id_token"]) {
        session.id_token = token["id_token"] as string;
      }

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
