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

      // 1. Fetch the OIDC `id_token_hint` from the cookie-authed BFF route
      //    BEFORE clearing the session (after signOut the cookie is gone).
      //    The bearer is no longer held in the client session, so we
      //    retrieve it on demand here — see `app/api/ws-ticket/route.ts`.
      let idTokenHint: string | null = null;
      try {
        const res = await fetch(
          new URL("/api/ws-ticket", window.location.origin).toString(),
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = (await res.json()) as { token?: string };
          idTokenHint = data.token ?? null;
        }
      } catch {
        // No hint → logout still proceeds; the provider falls back to its
        // own session cookie / may prompt.
      }

      // 2. Clear local session (also clears session cookies)
      await signOut({ redirect: false });

      // 3. Standard OIDC logout redirect
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";
      const returnTo = encodeURIComponent(
        `${window.location.origin}${appPrefix}/`
      );

      let logoutUrl = `${session?.issuer}/logout?post_logout_redirect_uri=${returnTo}&client_id=glow-client`;
      if (idTokenHint) {
        logoutUrl += `&id_token_hint=${idTokenHint}`;
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
