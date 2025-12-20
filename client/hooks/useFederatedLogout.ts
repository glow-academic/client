import { signOut, useSession } from "next-auth/react";

/**
 * Hook for federated logout that clears both NextAuth and Keycloak sessions.
 *
 * This hook performs a two-step logout:
 * 1. Clears the local NextAuth session cookie
 * 2. Clears guest/default account cookies (if any)
 * 3. Redirects to Keycloak logout endpoint to clear the server-side session
 *
 * @returns An async function that performs federated logout
 */
export function useFederatedLogout() {
  // Get the session to access the id_token
  const { data: session } = useSession();

  return async () => {
    try {
      // Mark logout in progress to prevent showing access denied flash
      // Also store timestamp for timeout safety
      if (typeof window !== "undefined") {
        sessionStorage.setItem("logout-in-progress", "true");
        sessionStorage.setItem("logout-start-time", Date.now().toString());
      }

      // 1. Log out of NextAuth (Clears the local 'next-auth.session-token')
      // redirect: false prevents NextAuth from reloading the page immediately
      await signOut({ redirect: false });

      // 2. Clear guest/default account cookies
      try {
        const { clearGuestSessionCookies } = await import(
          "@/app/(main)/layout-server"
        );
        await clearGuestSessionCookies();
      } catch {
        // Ignore errors - cookies might not exist
      }

      // 3. Construct Keycloak Logout URL
      // Match the pattern used in auth.ts: include /auth path prefix when accessing Keycloak directly
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      const keycloakUrl =
        process.env["NEXT_PUBLIC_KEYCLOAK_URL"] ||
        `http://localhost:8080${appPrefix}/auth`;
      const clientId =
        process.env["NEXT_PUBLIC_AUTH_KEYCLOAK_ID"] || "glow-client";

      // Get realm name from cookie (set during login) or default to master
      // Read realm-name cookie to determine which realm to logout from
      const realmNameCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("realm-name="))
        ?.split("=")[1];
      const realm = realmNameCookie || "master";

      // Where to go after Keycloak is done (back to your login page)
      const returnTo = encodeURIComponent(
        `${window.location.origin}${appPrefix}/login`,
      );

      // 4. Construct the logout URL with dynamic realm
      let logoutUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/logout?post_logout_redirect_uri=${returnTo}&client_id=${clientId}`;

      // 5. Append id_token_hint if available
      // This tells Keycloak: "I am this user, and I really want to logout. Don't ask me."
      if (session?.id_token) {
        logoutUrl += `&id_token_hint=${session.id_token}`;
      }

      // Redirect to Keycloak logout (flag will be cleared by LogoutGuard when reaching login page)
      if (typeof window !== "undefined") {
        window.location.href = logoutUrl;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Logout failed:", error);
      // Clear logout flag on error
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("logout-in-progress");
        sessionStorage.removeItem("logout-start-time");
      }
      // Fallback: just reload to login if something breaks
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      window.location.href = `${appPrefix}/login`;
    }
  };
}
