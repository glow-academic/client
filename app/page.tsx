/**
 * app/page.tsx
 * Root page - redirects to Glow OIDC login
 */

"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

export default function RootPage() {
  const hasRedirected = useRef(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    const returnTo = searchParams.get("return_to");

    // If return_to is a valid internal path, go there directly after login.
    // Otherwise, go through /callback for role-based routing.
    signIn("glow", {
      callbackUrl: returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : "/callback",
    });
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Redirecting to login...</p>
      </div>
    </div>
  );
}
