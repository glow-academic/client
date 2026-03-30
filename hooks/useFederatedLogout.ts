import { signOut, useSession } from "next-auth/react";

/**
 * Hook for federated logout that clears both NextAuth and Glow API sessions.
 *
 * Uses the OIDC provider's end_session_endpoint (Glow API /logout).
 * The Glow API handles Keycloak session cleanup internally — the client
 * never needs to know about Keycloak.
 *
 * @returns An async function that performs federated logout
 */
export function useFederatedLogout() {
  const { data: session } = useSession();

  return async () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("logout-in-progress", "true");
        sessionStorage.setItem("logout-start-time", Date.now().toString());
      }

      // 1. Clear local NextAuth session
      await signOut({ redirect: false });

      // 2. Clear session cookies
      try {
        const { clearSessionCookies } = await import(
          "@/app/(main)/layout-server"
        );
        await clearSessionCookies();
      } catch {
        // Ignore errors - cookies might not exist
      }

      // 3. Redirect to Glow API logout (OIDC end_session_endpoint)
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      const issuer =
        process.env["NEXT_PUBLIC_API_URL"] ||
        `${window.location.origin}${appPrefix}`;
      const clientId =
        process.env["NEXT_PUBLIC_AUTH_CLIENT_ID"] || "glow-client";

      const returnTo = encodeURIComponent(
        `${window.location.origin}${appPrefix}/`
      );

      let logoutUrl = `${issuer}/logout?post_logout_redirect_uri=${returnTo}&client_id=${clientId}`;

      if (session?.id_token) {
        logoutUrl += `&id_token_hint=${session.id_token}`;
      }

      if (typeof window !== "undefined") {
        window.location.href = logoutUrl;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Logout failed:", error);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("logout-in-progress");
        sessionStorage.removeItem("logout-start-time");
      }
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      window.location.href = `${appPrefix}/`;
    }
  };
}
