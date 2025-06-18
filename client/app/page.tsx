/**
 * app/page.tsx
 * This is the login page.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
"use client";
import { Button } from "@/components/ui/button";
import { logError, logInfo } from "@/utils/logger";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useQuery } from "@tanstack/react-query";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const sparkles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    size: Math.random() * 3 + 1,
    left: Math.random() * 100,
    top: Math.random() * 100,
    animationDelay: Math.random() * 3,
    animationDuration: Math.random() * 3 + 2,
  }));

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
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={`moving-${i}`}
          className="absolute text-blue-300/30 animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${Math.random() * 2 + 3}s`,
          }}
        >
          <SparkleIcon className="w-3 h-3" />
        </div>
      ))}

      {/* Floating sparkles */}
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={`floating-${i}`}
          className="absolute text-purple-300/25 animate-ping"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${Math.random() * 3 + 4}s`,
          }}
        >
          <SparkleIcon className="w-2 h-2" />
        </div>
      ))}
    </div>
  );
};

export default function Home() {
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [loadingMicrosoft, setLoadingMicrosoft] = useState(false);
  const router = useRouter();
  const userId = useSession().data?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  const handleMicrosoftLogin = async () => {
    try {
      setLoadingMicrosoft(true);

      // Log the login attempt start
      await logInfo("Microsoft login attempt started");

      // Clear guest mode and simulated role from localStorage
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedRole");

      let redirectTo = "/home";
      if (profile?.role !== "ta") {
        redirectTo = "/analytics";
      }

      await signIn("microsoft-entra-id", { redirectTo: redirectTo });

      // Log successful login attempt
      await logInfo("Microsoft login attempt successful", {
        redirectTo: profile?.role !== "ta" ? "/analytics" : "/home",
      });

      toast.success("Signing in with Microsoft...");
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Log the error to database
      await logError("Microsoft login attempt failed", error as Error);

      toast.error("An error occurred during login: " + errorMessage);
    } finally {
      setLoadingMicrosoft(false);
    }
  };

  const handleGuestAccess = async () => {
    try {
      setLoadingGuest(true);

      // Log guest access attempt
      await logInfo("Guest access attempt started", {
        redirectTo: "/home",
      });

      // Set guest mode in localStorage and redirect
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedRole");
      localStorage.setItem("guestMode", "true");
      localStorage.setItem("simulatedRole", "guest");

      // Log successful guest access
      await logInfo("Guest access attempt successful", {
        redirectTo: "/home",
      });

      toast.success("Accessing as guest!");
      router.push("/home");
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Log the error to database
      await logError("Guest access attempt failed", error as Error);

      // Log failed guest access
      await logError("Guest access attempt failed", error as Error);

      toast.error("An error occurred during login: " + errorMessage);
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
        <div className="text-center space-y-3 animate-in slide-in-from-top-4 duration-700 delay-300">
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
            Glow
          </h1>
          <p className="text-blue-100/80 text-sm">
            Graduate Learning Orientation Workshop
          </p>
        </div>

        {/* Form */}
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700 delay-500">
          <div className="space-y-4">
            {/* Microsoft Login Button */}
            <Button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={loadingMicrosoft}
              data-testid="microsoft-login-button"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none border border-blue-500/30"
            >
              <div className="flex items-center justify-center space-x-3">
                {loadingMicrosoft ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <MicrosoftIcon />
                )}
                <span className="text-base">
                  {loadingMicrosoft
                    ? "Signing in..."
                    : "Continue with Microsoft"}
                </span>
              </div>
            </Button>

            {/* Divider */}
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
