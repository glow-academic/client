import { signOut, useSession } from "next-auth/react";

/**
 * Hook for federated logout that clears both NextAuth and Keycloak sessions.
 *
 * This hook performs a two-step logout:
 * 1. Clears the local NextAuth session cookie
 * 2. Redirects to Keycloak logout endpoint to clear the server-side session
 *
 * @returns An async function that performs federated logout
 */
export function useFederatedLogout() {
  // Get the session to access the id_token
  const { data: session } = useSession();

  return async () => {
    try {
      // 1. Log out of NextAuth (Clears the local 'next-auth.session-token')
      // redirect: false prevents NextAuth from reloading the page immediately
      await signOut({ redirect: false });

      // 2. Construct Keycloak Logout URL
      // Match the pattern used in auth.ts: include /auth path prefix when accessing Keycloak directly
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      const keycloakUrl =
        process.env["NEXT_PUBLIC_KEYCLOAK_URL"] ||
        `http://localhost:8080${appPrefix}/auth`;
      const realm = process.env["NEXT_PUBLIC_KEYCLOAK_REALM"] || "glow";
      const clientId =
        process.env["NEXT_PUBLIC_AUTH_KEYCLOAK_ID"] || "glow-client";

      // Where to go after Keycloak is done (back to your login page)
      const returnTo = encodeURIComponent(
        `${window.location.origin}${appPrefix}/login`
      );

      // 3. Construct the logout URL
      let logoutUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout?post_logout_redirect_uri=${returnTo}&client_id=${clientId}`;

      // 4. Append id_token_hint if available
      // This tells Keycloak: "I am this user, and I really want to logout. Don't ask me."
      if (session?.id_token) {
        logoutUrl += `&id_token_hint=${session.id_token}`;
      }

      window.location.href = logoutUrl;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Logout failed:", error);
      // Fallback: just reload to login if something breaks
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      window.location.href = `${appPrefix}/login`;
    }
  };
}
