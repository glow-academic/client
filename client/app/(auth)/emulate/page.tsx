"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Emulation redirect page.
 *
 * This page handles the post-logout signin for profile emulation.
 * The server constructs the logout URL which redirects here after Keycloak logout.
 *
 * Flow:
 * 1. User clicks "Emulate" in the modal -> creates grant -> server returns logout URL
 * 2. Modal redirects to Keycloak logout URL (with post_logout_redirect_uri = this page)
 * 3. Keycloak logs out and redirects here (user has no session at this point)
 * 4. This page calls signIn() with the grant ID to complete emulation
 * 5. User is redirected to returnUrl after successful signin
 */
export default function EmulatePage() {
  const searchParams = useSearchParams();
  const grantId = searchParams.get("grant");
  const returnUrl = searchParams.get("returnUrl");
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!grantId) return;
    if (hasStarted.current) return;

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
  }, [grantId, returnUrl]);

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
