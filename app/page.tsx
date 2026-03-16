/**
 * app/page.tsx
 * Root page - redirects to Keycloak login
 */

"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef } from "react";

export default function RootPage() {
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    // Redirect to Keycloak login
    signIn("keycloak", {
      callbackUrl: "/callback",
    });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Redirecting to login...</p>
      </div>
    </div>
  );
}
