/**
 * Login.tsx
 * Used to create and manage login for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { SettingsActiveClient } from "@/app/(main)/layout-server";
import { GlowIconComponent } from "@/components/common/GlowIconComponent";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyThemeTokens } from "@/lib/theme/apply-theme";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// User Icon Component
const UserIcon = ({
  className = "w-5 h-5 text-white",
}: {
  className?: string;
}) => (
  <svg
    className={className}
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
  is_default?: boolean; // Whether this is a default provider (no department links)
}

interface DepartmentOption {
  id: string;
  title: string;
  description: string;
}

interface LoginProps {
  providers?: ProviderOption[]; // Still fetched for validation/logging, but not displayed
  guest_login_enabled?: boolean; // Whether guest login button should be shown
  departments?: DepartmentOption[]; // List of departments for picker
  initialDepartmentId?: string | undefined; // Initial department ID from query parameter
  activeSettings?: SettingsActiveClient | null; // Active settings for theme application
  defaultDepartmentId?: string | null; // Default department ID from settings_default_department table
  realmName?: string; // Always "master" (organizations replace multi-realm architecture)
  redirectPath?: string; // Redirect path after login
}

export default function Login({
  providers: _providers = [],
  guest_login_enabled = true,
  departments = [],
  initialDepartmentId,
  activeSettings,
  defaultDepartmentId,
  realmName: _realmName = "master", // Realm name from API (settings-based) - always "master"
  redirectPath: redirectPathProp,
}: LoginProps) {
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [loadingDepartmentLogin, setLoadingDepartmentLogin] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<
    string | null
  >(
    initialDepartmentId ||
      (departments.length > 0 ? (departments[0]?.id ?? null) : null)
  );
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get redirectPath from prop or query params (query params take precedence)
  const redirectPath =
    redirectPathProp || searchParams.get("redirectPath") || null;

  // Extract tokens for dependency tracking
  const themeTokens = activeSettings?.["tokens"];

  // Apply theme tokens from activeSettings (client-side only)
  useEffect(() => {
    if (themeTokens) {
      applyThemeTokens(themeTokens);
    }
  }, [themeTokens]);

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

  // Always use master realm (organizations replace multi-realm architecture)
  // Realm name is always "master" - org-scoped IdPs are handled by Keycloak organizations
  // Use client-scoped org routing: department-specific client_id routes to appropriate IdPs

  // Handler for department login (uses client-scoped org routing)
  const handleDepartmentLogin = async () => {
    try {
      setLoadingDepartmentLogin(true);

      // Clear guest mode and simulated profile from localStorage
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedProfileId");
      localStorage.removeItem("defaultAccountMode");
      localStorage.removeItem("defaultAccountProfileId");

      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      // Redirect to redirectPath if provided, otherwise home (home page will handle role-based redirects)
      const redirectTo = redirectPath
        ? `${appPrefix}${redirectPath}`
        : `${appPrefix}/home`;

      // Use NextAuth signIn() and pass department parameter via authorizationParams
      // The authorization callback will preserve the department param in the Keycloak URL
      await signIn(
        "keycloak",
        {
          callbackUrl: redirectTo,
        },
        selectedDepartmentId
          ? {
              department: selectedDepartmentId,
            }
          : undefined
      );

      // Note: signIn redirects immediately on success, so we don't need toast.success here
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (!errorMessage.toLowerCase().includes("load failed")) {
        toast.error("An error occurred during login: " + errorMessage);
      }
      setLoadingDepartmentLogin(false);
    }
  };

  /**
   * @deprecated Guest access is now handled automatically by Keycloak via the custom OIDC IdP.
   * The "Continue as Guest" button in the Keycloak login theme redirects directly to the OIDC flow.
   * This function is kept for backward compatibility but should not be used.
   */
  const handleGuestAccess = async () => {
    try {
      setLoadingGuest(true);
      toast.warning(
        "Guest access should be initiated from the Keycloak login page"
      );

      // Redirect to Keycloak login page where guest access is available
      const keycloakPublicUrl =
        process.env["NEXT_PUBLIC_KEYCLOAK_URL"] ||
        process.env["KEYCLOAK_PUBLIC_URL"] ||
        "http://localhost:8080";
      const keycloakClientId =
        process.env["NEXT_PUBLIC_KEYCLOAK_CLIENT_ID"] ||
        process.env["AUTH_KEYCLOAK_ID"] ||
        "glow-client";
      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      const keycloakAuthUrl = new URL(
        `${keycloakPublicUrl}/realms/master/protocol/openid-connect/auth`
      );
      keycloakAuthUrl.searchParams.set("client_id", keycloakClientId);
      keycloakAuthUrl.searchParams.set(
        "redirect_uri",
        `${window.location.origin}${appPrefix}/api/auth/callback/keycloak`
      );
      keycloakAuthUrl.searchParams.set("response_type", "code");
      keycloakAuthUrl.searchParams.set("scope", "openid profile email");

      if (selectedDepartmentId) {
        keycloakAuthUrl.searchParams.set("department", selectedDepartmentId);
      }

      window.location.href = keycloakAuthUrl.toString();
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
    <div className="relative flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 px-4">
      {/* Animated Yellow Sparkles Background */}
      <AnimatedSparkles />

      {/* Back Button - Top Left */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="fixed top-6 left-6 z-50"
      >
        <Link
          href="/"
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-xl text-white border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-300"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)",
            boxShadow:
              "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2)",
          }}
        >
          {/* Liquid glass shine effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-lg" />
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <ArrowLeft className="w-4 h-4 relative z-10" />
          <span className="text-sm font-medium relative z-10">Back</span>
        </Link>
      </motion.div>

      <motion.div
        initial="initial"
        animate="animate"
        variants={fadeInUp}
        className="relative z-10 w-full max-w-md p-8 space-y-8 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
          boxShadow:
            "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Liquid glass shine effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-2xl" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* Content Container */}
        <div className="relative z-10">
          {/* Header - Stacked Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col items-center space-y-3"
          >
            <Link
              href="/"
              className="cursor-pointer hover:opacity-90 transition-opacity flex flex-col items-center space-y-3"
            >
              {/* Logo Icon - uses centralized GlowIconComponent */}
              <GlowIconComponent size={64} className="shadow-lg" />
              {/* GLOW Text */}
              <h1 className="text-3xl font-bold bg-gradient-to-br from-blue-300 to-blue-400 bg-clip-text text-transparent">
                GLOW
              </h1>
            </Link>
          </motion.div>

          {/* Form */}
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="space-y-6 mt-8"
          >
            {/* Department Picker - only show if departments exist */}
            {departments.length > 0 && (
              <motion.div variants={cardVariants}>
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                    .department-select-trigger svg {
                      color: white !important;
                      opacity: 1 !important;
                    }
                    .department-select-trigger:focus,
                    .department-select-trigger:focus-visible,
                    .department-select-trigger[data-state="open"] {
                      outline: none !important;
                      ring: none !important;
                      --tw-ring-width: 0px !important;
                      --tw-ring-color: transparent !important;
                      border-color: rgba(255, 255, 255, 0.2) !important;
                    }
                    .department-select-item svg {
                      color: white !important;
                    }
                    .department-select-item span svg {
                      color: white !important;
                    }
                    .department-select-content,
                    .department-select-content * {
                      border-color: rgba(255, 255, 255, 0.2) !important;
                    }
                    .department-select-content {
                      outline: none !important;
                      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
                      --tw-ring-width: 0px !important;
                      --tw-ring-color: transparent !important;
                      ring-width: 0px !important;
                      ring-color: transparent !important;
                    }
                    .department-select-content:focus,
                    .department-select-content:focus-visible,
                    .department-select-content[data-state="open"] {
                      outline: none !important;
                      ring: none !important;
                      --tw-ring-width: 0px !important;
                      --tw-ring-color: transparent !important;
                      ring-width: 0px !important;
                      ring-color: transparent !important;
                      border-color: rgba(255, 255, 255, 0.2) !important;
                      box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
                    }
                    .department-select-content [data-slot="select-viewport"],
                    .department-select-content [data-slot="select-scroll-up-button"],
                    .department-select-content [data-slot="select-scroll-down-button"] {
                      border: none !important;
                      outline: none !important;
                    }
                    .department-select-item {
                      outline: none !important;
                      border: none !important;
                    }
                    .department-select-item:focus,
                    .department-select-item:focus-visible,
                    .department-select-item[data-highlighted],
                    .department-select-item[data-state="checked"],
                    .department-select-item[data-state="selected"] {
                      outline: none !important;
                      border: none !important;
                      box-shadow: none !important;
                      ring: none !important;
                    }
                  `,
                  }}
                />
                <div className="relative">
                  <Select
                    {...(selectedDepartmentId
                      ? { value: selectedDepartmentId }
                      : {})}
                    onValueChange={(value) => {
                      setSelectedDepartmentId(value);

                      // Always use master realm (organizations replace multi-realm architecture)

                      // Update URL with department parameter and trigger server-side refetch
                      // If selected department is the default, remove query param to keep URL clean
                      // The server will still use the default department ID for the API call
                      const url = new URL(window.location.href);
                      if (value && value === defaultDepartmentId) {
                        // Remove query param if it's the default department (keeps URL clean)
                        url.searchParams.delete("department");
                      } else if (value) {
                        // Set query param for non-default departments
                        url.searchParams.set("department", value);
                      } else {
                        // Remove query param if no department selected
                        url.searchParams.delete("department");
                      }
                      // Use router.push to trigger server-side refetch (like dashboard filters)
                      router.push(url.pathname + url.search);
                    }}
                  >
                    <SelectTrigger
                      className="department-select-trigger relative w-full h-12 bg-white/10 backdrop-blur-xl text-white font-medium rounded-xl transition-all duration-300 border border-white/20 overflow-hidden hover:bg-white/15 hover:border-white/30 px-4 text-base"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)",
                        boxShadow:
                          "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.15) 100%)";
                        e.currentTarget.style.boxShadow =
                          "0 8px 32px 0 rgba(31, 38, 135, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)";
                        e.currentTarget.style.boxShadow =
                          "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2)";
                      }}
                    >
                      {/* Liquid glass shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-xl" />
                      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                      <SelectValue
                        placeholder="Select department..."
                        className="relative z-10 text-base"
                      />
                    </SelectTrigger>
                    <SelectContent className="department-select-content bg-white/10 backdrop-blur-xl text-white border border-white/20 rounded-xl shadow-2xl">
                      {departments.map((dept) => (
                        <SelectItem
                          key={dept.id}
                          value={dept.id}
                          className="department-select-item text-white hover:bg-white/15 focus:bg-white/15 focus:text-white cursor-pointer text-base"
                        >
                          {dept.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}

            <div className="space-y-4">
              {/* Department Login Button - Always shows */}
              <motion.div variants={cardVariants} whileHover="hover">
                <Button
                  type="button"
                  onClick={handleDepartmentLogin}
                  disabled={loadingDepartmentLogin}
                  data-testid="department-login-button"
                  className="relative w-full h-12 bg-white/10 backdrop-blur-xl text-white font-medium rounded-xl transition-all duration-300 border border-white/20 overflow-hidden hover:bg-white/15 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)",
                    boxShadow:
                      "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.15) 100%)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 32px 0 rgba(31, 38, 135, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2)";
                  }}
                >
                  {/* Liquid glass shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-xl" />
                  <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  <div className="relative flex items-center justify-center space-x-3">
                    {loadingDepartmentLogin ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <UserIcon />
                    )}
                    <span className="text-base">
                      {loadingDepartmentLogin
                        ? "Signing in..."
                        : selectedDepartmentId
                          ? `Continue with ${
                              departments.find(
                                (d) => d.id === selectedDepartmentId
                              )?.title || "Department"
                            }`
                          : "Continue with Default Account"}
                    </span>
                  </div>
                </Button>
              </motion.div>

              {/* Divider - only show if guest login is enabled */}
              {guest_login_enabled && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="relative py-2"
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/30" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase z-10">
                    <span className="bg-blue-400 px-4 py-1 text-white font-medium tracking-wider rounded backdrop-blur-sm">
                      Or
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Guest Access Button - only show if guest_login_enabled is true */}
              {guest_login_enabled && (
                <motion.div variants={cardVariants} whileHover="hover">
                  <Button
                    type="button"
                    onClick={handleGuestAccess}
                    disabled={loadingGuest}
                    data-testid="guest-login-button"
                    className="relative w-full h-12 bg-white/10 backdrop-blur-xl text-white font-medium rounded-xl transition-all duration-300 border border-white/20 overflow-hidden hover:bg-white/15 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)",
                      boxShadow:
                        "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.15) 100%)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 32px 0 rgba(31, 38, 135, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.1) 100%)";
                      e.currentTarget.style.boxShadow =
                        "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 0 1px rgba(255, 255, 255, 0.2)";
                    }}
                  >
                    {/* Liquid glass shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none rounded-xl" />
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                    <div className="relative flex items-center justify-center space-x-3">
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
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
