/**
 * Login.tsx
 * Used to create and manage login for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Provider icon component - renders icon from URL or fallback
const ProviderIcon = ({
  icon,
  name,
}: {
  icon: string | null | undefined;
  name: string;
}) => {
  if (icon) {
    return (
      <Image
        src={icon}
        alt={name}
        width={20}
        height={20}
        className="w-5 h-5"
        unoptimized={true} // External URLs, no optimization needed for small icons
      />
    );
  }
  // Fallback: simple circle icon if no icon URL provided
  return (
    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
      <span className="text-xs text-white font-bold">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
};

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

// Define the shape of data coming from API
interface ProviderOption {
  id: string; // The slug (microsoft, google, purdue)
  name: string; // The display name
  icon: string | null; // The URL to the icon (can be null)
}

interface LoginProps {
  providers?: ProviderOption[]; // Updated to accept ProviderOption array
}

export default function Login({ providers = [] }: LoginProps) {
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // Generic handler for ANY SSO provider (data-agnostic)
  const handleSSOLogin = async (provider: ProviderOption) => {
    try {
      setLoading({ ...loading, [provider.id]: true });

      // Clear guest mode and simulated profile from localStorage
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedProfileId");

      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      // Redirect to home for authenticated users
      const redirectTo = `${appPrefix}/home`;

      // Use NextAuth's signIn with "keycloak" provider (our only provider in auth.ts)
      // Pass kc_idp_hint to force Keycloak to skip login page and redirect to the specified provider
      // The provider.id is the slug (already lowercase from database)
      await signIn(
        "keycloak",
        {
          callbackUrl: redirectTo,
        },
        {
          kc_idp_hint: provider.id,
        }
      );

      // Note: signIn redirects immediately on success, so we don't need toast.success here
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (!errorMessage.toLowerCase().includes("load failed")) {
        toast.error("An error occurred during login: " + errorMessage);
      }
      setLoading({ ...loading, [provider.id]: false });
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
            {/* 🚀 DYNAMIC PROVIDER LIST - Renders buttons for all providers from API */}
            {providers.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                onClick={() => handleSSOLogin(provider)}
                disabled={loading[provider.id]}
                data-testid={`${provider.id}-login-button`}
                className="w-full h-12 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border border-white/30 backdrop-blur-sm"
              >
                <div className="flex items-center justify-center space-x-3">
                  {loading[provider.id] ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ProviderIcon icon={provider.icon} name={provider.name} />
                  )}
                  <span className="text-base">
                    {loading[provider.id]
                      ? "Signing in..."
                      : `Continue with ${provider.name}`}
                  </span>
                </div>
              </Button>
            ))}

            {/* Divider - only show if there are SSO providers */}
            {providers.length > 0 && (
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
