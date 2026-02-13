"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * LogoutGuard component that prevents showing UnifiedAccessDenied
 * during logout to avoid flash of access denied screen.
 * Shows a minimal loading state instead.
 *
 * Only shows loading if logout is actually in progress (session being cleared).
 * If already logged out (no session), clears flag and shows normal access denied.
 */
export function LogoutGuard({ children }: { children: React.ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();

  useEffect(() => {
    // Clear logout flag if we're on the home page (where logout redirects to)
    if (pathname === "/" || pathname === "") {
      sessionStorage.removeItem("logout-in-progress");
      setIsLoggingOut(false);
      return;
    }

    // Track when logout flag was set to add timeout safety
    const logoutStartTime = sessionStorage.getItem("logout-start-time");
    const LOGOUT_GRACE_PERIOD_MS = 2000; // 2 seconds - show "Logging out..." even if cookies cleared
    const LOGOUT_TIMEOUT_MS = 5000; // 5 seconds max - then assume logout complete

    // Check if logout is in progress
    const checkLogout = () => {
      const logoutFlag = sessionStorage.getItem("logout-in-progress");

      if (logoutFlag !== "true") {
        setIsLoggingOut(false);
        return;
      }

      // If flag is set, check timing
      if (logoutStartTime) {
        const elapsed = Date.now() - parseInt(logoutStartTime, 10);

        // During grace period (first 2 seconds), always show "Logging out..."
        // This covers the time when cookies are being cleared but redirect hasn't happened yet
        if (elapsed < LOGOUT_GRACE_PERIOD_MS) {
          setIsLoggingOut(true);
          return;
        }

        // After grace period but before timeout, check if we still have session/cookies
        // If we do, we're still logging out. If not, logout might be complete.
        if (elapsed < LOGOUT_TIMEOUT_MS) {
          const hasSession =
            session !== null &&
            (status === "authenticated" || status === "loading");
          const hasCookies =
            document.cookie.includes("next-auth.session-token");

          // If we still have session/cookies, show loading
          // Otherwise, logout is likely complete, clear flag
          if (hasSession || hasCookies) {
            setIsLoggingOut(true);
          } else {
            // No session/cookies after grace period - logout likely complete
            sessionStorage.removeItem("logout-in-progress");
            sessionStorage.removeItem("logout-start-time");
            setIsLoggingOut(false);
          }
          return;
        }

        // After timeout, clear flag (logout should be complete by now)
        sessionStorage.removeItem("logout-in-progress");
        sessionStorage.removeItem("logout-start-time");
        setIsLoggingOut(false);
      } else {
        // Flag set but no timestamp - show loading for now
        setIsLoggingOut(true);
      }
    };

    checkLogout();

    // Check periodically in case logout starts after component mounts
    const interval = setInterval(checkLogout, 100);

    // Clean up logout flag when navigating away (e.g., to home page)
    const handleBeforeUnload = () => {
      sessionStorage.removeItem("logout-in-progress");
      sessionStorage.removeItem("logout-start-time");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [pathname, session, status]);

  // If logout is in progress, show minimal loading state instead of access denied
  if (isLoggingOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Logging out...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
