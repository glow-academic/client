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
import { motion } from "framer-motion";

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
    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
      <span className="text-xs text-gray-700 font-bold">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
};

// User Icon Component
const UserIcon = () => (
  <svg
    className="w-5 h-5 text-gray-700"
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
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        size: Math.random() * 3 + 1,
        left: Math.random() * 100,
        top: Math.random() * 100,
        animationDelay: Math.random() * 3,
        animationDuration: Math.random() * 3 + 2,
      }))
    );

    setMovingSparkles(
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        animationDelay: Math.random() * 2,
        animationDuration: Math.random() * 2 + 3,
      }))
    );

    setFloatingSparkles(
      Array.from({ length: 10 }, (_, i) => ({
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
          className="absolute text-yellow-300/40 animate-pulse"
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
          className="absolute text-yellow-400/35 animate-bounce"
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
          className="absolute text-yellow-400/30 animate-ping"
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

  // Animation variants matching Info.tsx
  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: [0.6, -0.05, 0.01, 0.99] },
  };

  const staggerContainer = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    initial: { opacity: 0, y: 40, scale: 0.95 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut" as const,
      },
    },
    hover: {
      y: -4,
      scale: 1.02,
      transition: { duration: 0.3 },
    },
  };

  // Generic handler for ANY SSO provider (data-agnostic)
  const handleSSOLogin = async (provider: ProviderOption) => {
    try {
      setLoading({ ...loading, [provider.id]: true });

      // Clear guest mode and simulated profile from localStorage
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedProfileId");

      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      // Redirect to home after login - home page will handle role-based redirects
      // (guests will be redirected to /practice by the home page)
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

      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      // ✨ DIRECT REDIRECT: Send guests straight to practice
      const guestRedirect = `${appPrefix}/practice`;

      toast.success("Accessing as guest!");
      router.push(guestRedirect);
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
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 via-white to-yellow-50 px-4">
      {/* Animated Sparkles Background */}
      <AnimatedSparkles />

      <motion.div
        initial="initial"
        animate="animate"
        variants={fadeInUp}
        className="relative z-10 w-full max-w-md p-8 space-y-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl shadow-xl border border-blue-500/30"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link
            href="/"
            className="text-center space-y-3 block cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden">
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
              GLOW
            </h1>
          </Link>
        </motion.div>

        {/* Form */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="space-y-6"
        >
          <div className="space-y-4">
            {/* 🚀 DYNAMIC PROVIDER LIST - Renders buttons for all providers from API */}
            {providers.map((provider) => (
              <motion.div
                key={provider.id}
                variants={cardVariants}
                whileHover="hover"
              >
                <Button
                  type="button"
                  onClick={() => handleSSOLogin(provider)}
                  disabled={loading[provider.id]}
                  data-testid={`${provider.id}-login-button`}
                  className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-center space-x-3">
                    {loading[provider.id] ? (
                      <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
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
              </motion.div>
            ))}

            {/* Divider - only show if there are SSO providers */}
            {providers.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="relative py-2"
              >
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/30" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-blue-500 px-4 text-white/90 font-medium tracking-wider">
                    Or
                  </span>
                </div>
              </motion.div>
            )}

            {/* Guest Access Button */}
            <motion.div
              variants={cardVariants}
              whileHover="hover"
            >
              <Button
                type="button"
                onClick={handleGuestAccess}
                disabled={loadingGuest}
                data-testid="guest-login-button"
                className="w-full h-12 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center space-x-3">
                  {loadingGuest ? (
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                  ) : (
                    <UserIcon />
                  )}
                  <span className="text-base">
                    {loadingGuest ? "Accessing..." : "Continue as Guest"}
                  </span>
                </div>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
