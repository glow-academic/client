/**
 * Login.tsx
 * Used to create and manage login for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Microsoft Icon Component
const MicrosoftIcon = () => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 23 23"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M1 1h10v10H1z" fill="#f25022" />
    <path d="M12 1h10v10H12z" fill="#00a4ef" />
    <path d="M1 12h10v10H1z" fill="#ffb900" />
    <path d="M12 12h10v10H12z" fill="#7fba00" />
  </svg>
);

// Google Icon Component
const GoogleIcon = () => (
  <svg
    className="w-5 h-5"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// User Icon Component
const UserIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

// Sparkle Icon Component
const SparkleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
  </svg>
);

// Animated Sparkles Background Component
const AnimatedSparkles = () => {
  const [sparkles, setSparkles] = useState<
    Array<{
      id: number;
      size: number;
      left: number;
      top: number;
      animationDelay: number;
      animationDuration: number;
    }>
  >([]);

  const [movingSparkles, setMovingSparkles] = useState<
    Array<{
      id: number;
      left: number;
      top: number;
      animationDelay: number;
      animationDuration: number;
    }>
  >([]);

  const [floatingSparkles, setFloatingSparkles] = useState<
    Array<{
      id: number;
      left: number;
      top: number;
      animationDelay: number;
      animationDuration: number;
    }>
  >([]);

  const [mounted, setMounted] = useState(false);

  // Generate sparkles only on client side after mount
  useEffect(() => {
    setSparkles(
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        size: Math.random() * 3 + 1,
        left: Math.random() * 100,
        top: Math.random() * 100,
        animationDelay: Math.random() * 3,
        animationDuration: Math.random() * 3 + 2,
      }))
    );

    setMovingSparkles(
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        animationDelay: Math.random() * 2,
        animationDuration: Math.random() * 2 + 3,
      }))
    );

    setFloatingSparkles(
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        animationDelay: Math.random() * 4,
        animationDuration: Math.random() * 3 + 4,
      }))
    );

    setMounted(true);
  }, []);

  // Don't render sparkles until mounted on client
  if (!mounted) {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none" />
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          className="absolute text-white/20 animate-pulse"
          style={{
            left: `${sparkle.left}%`,
            top: `${sparkle.top}%`,
            animationDelay: `${sparkle.animationDelay}s`,
            animationDuration: `${sparkle.animationDuration}s`,
          }}
        >
          <SparkleIcon
            className={`w-${Math.floor(sparkle.size)} h-${Math.floor(sparkle.size)}`}
          />
        </div>
      ))}

      {/* Moving sparkles */}
      {movingSparkles.map((sparkle) => (
        <div
          key={`moving-${sparkle.id}`}
          className="absolute text-blue-300/30 animate-bounce"
          style={{
            left: `${sparkle.left}%`,
            top: `${sparkle.top}%`,
            animationDelay: `${sparkle.animationDelay}s`,
            animationDuration: `${sparkle.animationDuration}s`,
          }}
        >
          <SparkleIcon className="w-3 h-3" />
        </div>
      ))}

      {/* Floating sparkles */}
      {floatingSparkles.map((sparkle) => (
        <div
          key={`floating-${sparkle.id}`}
          className="absolute text-purple-300/25 animate-ping"
          style={{
            left: `${sparkle.left}%`,
            top: `${sparkle.top}%`,
            animationDelay: `${sparkle.animationDelay}s`,
            animationDuration: `${sparkle.animationDuration}s`,
          }}
        >
          <SparkleIcon className="w-2 h-2" />
        </div>
      ))}
    </div>
  );
};

interface LoginProps {
  providers?: string[];
}

export default function Login({ providers = [] }: LoginProps) {
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // Check if providers are available (case-sensitive matching with DB names)
  const hasMicrosoft = providers.includes("Microsoft");
  const hasGoogle = providers.includes("Google");

  // Generic handler for ANY SSO provider (Microsoft, Google, etc.)
  const handleSSOLogin = async (providerId: string) => {
    try {
      setLoading({ ...loading, [providerId]: true });

      // Clear guest mode and simulated profile from localStorage
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedProfileId");

      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      // Redirect to home for authenticated users
      const redirectTo = `${appPrefix}/home`;

      // Use NextAuth's signIn with "keycloak" provider (our only provider in auth.ts)
      // Pass kc_idp_hint to force Keycloak to skip login page and redirect to the specified provider
      // The providerId must be lowercase to match Keycloak provider alias (e.g., "microsoft", "google")
      await signIn(
        "keycloak",
        {
          callbackUrl: redirectTo,
        },
        {
          kc_idp_hint: providerId.toLowerCase(),
        }
      );

      // Note: signIn redirects immediately on success, so we don't need toast.success here
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (!errorMessage.toLowerCase().includes("load failed")) {
        toast.error("An error occurred during login: " + errorMessage);
      }
      setLoading({ ...loading, [providerId]: false });
    }
  };

  const handleGuestAccess = async () => {
    try {
      setLoadingGuest(true);

      // Set guest mode in localStorage and redirect to practice
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedProfileId");
      localStorage.setItem("guestMode", "true");

      toast.success("Accessing as guest!");
      router.push("/practice");
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (!errorMessage.toLowerCase().includes("load failed")) {
        toast.error("An error occurred during login: " + errorMessage);
      }
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 px-4 animate-in fade-in duration-1000">
      {/* Animated Sparkles Background */}
      <AnimatedSparkles />

      <div className="relative z-10 w-full max-w-md p-8 space-y-8 bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 animate-in slide-in-from-bottom-4 duration-700 delay-200">
        {/* Header */}
        <Link
          href="/"
          className="text-center space-y-3 animate-in slide-in-from-top-4 duration-700 delay-300 block cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg animate-in zoom-in duration-700 delay-400 relative overflow-hidden">
            {/* Logo sparkles */}
            <div className="absolute inset-0 flex items-center justify-center">
              <SparkleIcon className="w-6 h-6 text-white animate-pulse" />
              <div
                className="absolute top-2 right-2 animate-ping"
                style={{ animationDelay: "0.5s" }}
              >
                <SparkleIcon className="w-3 h-3 text-white/70" />
              </div>
              <div
                className="absolute bottom-2 left-2 animate-pulse"
                style={{ animationDelay: "1s" }}
              >
                <SparkleIcon className="w-2 h-2 text-white/50" />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
            GLOW
          </h1>
          {/* <p className="text-blue-100/80 text-sm">
            Graduate Learning Orientation Workshop
          </p> */}
        </Link>

        {/* Form */}
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 delay-500">
          <div className="space-y-4">
            {/* Microsoft Login Button - only show if Microsoft is in providers */}
            {hasMicrosoft && (
              <>
                <Button
                  type="button"
                  onClick={() => handleSSOLogin("Microsoft")}
                  disabled={loading["Microsoft"]}
                  data-testid="microsoft-login-button"
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border border-blue-500/30"
                >
                  <div className="flex items-center justify-center space-x-3">
                    {loading["Microsoft"] ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <MicrosoftIcon />
                    )}
                    <span className="text-base">
                      {loading["Microsoft"]
                        ? "Signing in..."
                        : "Continue with Microsoft"}
                    </span>
                  </div>
                </Button>
              </>
            )}

            {/* Google Login Button - only show if Google is in providers */}
            {hasGoogle && (
              <>
                <Button
                  type="button"
                  onClick={() => handleSSOLogin("Google")}
                  disabled={loading["Google"]}
                  data-testid="google-login-button"
                  className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border border-gray-300"
                >
                  <div className="flex items-center justify-center space-x-3">
                    {loading["Google"] ? (
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    <span className="text-base">
                      {loading["Google"]
                        ? "Signing in..."
                        : "Continue with Google"}
                    </span>
                  </div>
                </Button>
              </>
            )}

            {/* Divider - only show if there are SSO providers */}
            {(hasMicrosoft || hasGoogle) && (
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900/50 backdrop-blur-sm px-4 text-blue-200/80 font-medium tracking-wider">
                    Or
                  </span>
                </div>
              </div>
            )}

            {/* Guest Access Button */}
            <Button
              type="button"
              onClick={handleGuestAccess}
              disabled={loadingGuest}
              data-testid="guest-login-button"
              className="w-full h-12 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border border-white/30 backdrop-blur-sm"
            >
              <div className="flex items-center justify-center space-x-3">
                {loadingGuest ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <UserIcon />
                )}
                <span className="text-base">
                  {loadingGuest ? "Accessing..." : "Continue as Guest"}
                </span>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
