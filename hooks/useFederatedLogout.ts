import { signOut, useSession } from "next-auth/react";

/**
 * Hook for standard OIDC federated logout.
 *
 * 1. Clears the local NextAuth session
 * 2. Redirects to the OIDC provider's end_session_endpoint
 *
 * Works with any OIDC provider — the issuer URL comes from the session,
 * which is populated server-side from AUTH_ISSUER.
 */
export function useFederatedLogout() {
  const { data: session } = useSession();

  return async () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("logout-in-progress", "true");
        sessionStorage.setItem("logout-start-time", Date.now().toString());
      }

      // 1. Clear local session
      await signOut({ redirect: false });

      // 2. Clear session cookies (handled by signOut)

      // 3. Standard OIDC logout redirect
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      const returnTo = encodeURIComponent(
        `${window.location.origin}${appPrefix}/`
      );

      let logoutUrl = `${session?.issuer}/logout?post_logout_redirect_uri=${returnTo}&client_id=glow-client`;
      if (session?.id_token) {
        logoutUrl += `&id_token_hint=${session.id_token}`;
      }

      window.location.href = logoutUrl;
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
