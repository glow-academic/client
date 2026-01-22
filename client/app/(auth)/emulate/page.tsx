"use client";

import { signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Emulation redirect page.
 *
 * This page handles the logout-then-login flow for profile emulation.
 * It's needed because:
 * 1. Keycloak won't allow switching users mid-session
 * 2. We need to fully logout from Keycloak (not just NextAuth) before switching users
 *
 * Flow:
 * 1. User clicks "Emulate" in the modal -> creates grant -> redirects here
 * 2. If user has a session, redirect to Keycloak logout with this page as callback
 * 3. After Keycloak logout, this page is loaded again (no session)
 * 4. With no session, call signIn() which starts fresh OAuth flow with proper PKCE
 * 5. User is redirected back to their original page (via returnUrl)
 */
export default function EmulatePage() {
  const searchParams = useSearchParams();
  const grantId = searchParams.get("grant");
  const returnUrl = searchParams.get("returnUrl");
  const loggedOut = searchParams.get("loggedOut");
  const { data: session, status } = useSession();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!grantId || status === "loading") return;
    if (hasStarted.current) return;

    // If we have a session and haven't logged out yet, do Keycloak logout first
    if (session && !loggedOut) {
      hasStarted.current = true;

      // Build the return URL for after Keycloak logout (back to this page with loggedOut flag)
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("loggedOut", "true");

      // Build Keycloak logout URL
      const keycloakPublicUrl = process.env["NEXT_PUBLIC_KEYCLOAK_URL"] || "http://localhost:8080";
      const keycloakClientId = process.env["NEXT_PUBLIC_KEYCLOAK_CLIENT_ID"] || "glow-client";

      const logoutUrl = new URL(`${keycloakPublicUrl}/realms/master/protocol/openid-connect/logout`);
      logoutUrl.searchParams.set("client_id", keycloakClientId);
      logoutUrl.searchParams.set("post_logout_redirect_uri", currentUrl.toString());

      // Include id_token_hint if available (helps Keycloak identify which session to end)
      const idToken = (session as { id_token?: string }).id_token;
      if (idToken) {
        logoutUrl.searchParams.set("id_token_hint", idToken);
      }

      // Redirect to Keycloak logout
      window.location.href = logoutUrl.toString();
      return;
    }

    // No session (or already logged out) - proceed with emulation sign in
    if (!session || loggedOut) {
      hasStarted.current = true;

      const callbackUrl = returnUrl || "/";
      signIn(
        "keycloak",
        { callbackUrl },
        {
          kc_idp_hint: "default-idp",
          login_hint: grantId,
          prompt: "login",
        }
      );
    }
  }, [grantId, returnUrl, loggedOut, session, status]);

  if (!grantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-red-600">Missing grant ID</h1>
          <p className="mt-2 text-muted-foreground">
            This page requires an emulation grant to proceed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">
          Switching profile...
        </p>
      </div>
    </div>
  );
}
