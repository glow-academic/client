import { signOut, useSession } from "next-auth/react";

/**
 * Hook for federated logout.
 *
 * Clears the local NextAuth session, then redirects to the Glow API's
 * OIDC logout endpoint via a server-side route that knows the API URL.
 * The client never needs to know the API URL directly.
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

      // 3. Redirect to server-side logout route (it knows the OIDC issuer)
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      const params = new URLSearchParams();
      if (session?.id_token) {
        params.set("id_token_hint", session.id_token);
      }

      window.location.href = `${appPrefix}/api/auth/federated-logout?${params}`;
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
