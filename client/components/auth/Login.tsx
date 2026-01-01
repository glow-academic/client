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
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
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
      <div className="w-7 h-7 rounded bg-white/90 p-1 shadow-sm flex items-center justify-center">
        <Image
          src={icon}
          alt={name}
          width={20}
          height={20}
          className="w-full h-full object-contain"
          unoptimized={true} // External URLs, no optimization needed for small icons
        />
      </div>
    );
  }
  // Fallback: simple circle icon if no icon URL provided
  return (
    <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
      <span className="text-xs text-gray-700 font-bold">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
};

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
  providers?: ProviderOption[]; // Updated to accept ProviderOption array
  guest_login_enabled?: boolean; // Whether guest login button should be shown
  show_default_account?: boolean; // Whether to show "continue as default account" button
  departments?: DepartmentOption[]; // List of departments for picker
  initialDepartmentId?: string | undefined; // Initial department ID from query parameter
  activeSettings?: SettingsActiveClient | null; // Active settings for theme application
  defaultDepartmentId?: string | null; // Default department ID from settings_default_department table
  realmName?: string; // Realm name for the selected department (master for default, department_id otherwise)
  redirectPath?: string; // Redirect path after login
}

export default function Login({
  providers = [],
  guest_login_enabled = true,
  show_default_account: _show_default_account = false,
  departments = [],
  initialDepartmentId,
  activeSettings,
  defaultDepartmentId,
  realmName = "master", // Realm name from API (settings-based)
  redirectPath: redirectPathProp,
}: LoginProps) {
  const [loadingGuest, setLoadingGuest] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
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

  // Use realm_name from API response (settings-based, not department-based)
  // Realm name is calculated server-side based on which settings has keys for providers
  // If department-specific settings has keys → realm = settings_id
  // If not → realm = "master" (default settings)
  const currentRealmName = React.useMemo(() => {
    // Use realm_name from API if available, otherwise fallback to master
    return realmName || "master";
  }, [realmName]);

  // Set realm-name cookie when realm changes
  useEffect(() => {
    document.cookie = `realm-name=${currentRealmName}; path=/; max-age=3600; SameSite=Lax`;
  }, [currentRealmName]);

  // Generic handler for ANY SSO provider (data-agnostic)
  const handleSSOLogin = async (provider: ProviderOption) => {
    try {
      setLoading({ ...loading, [provider.id]: true });

      // Clear guest mode and simulated profile from localStorage
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedProfileId");

      // Realm-name cookie is already set by useEffect when department changes
      // This allows dynamic realm selection based on department

      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      // Redirect to redirectPath if provided, otherwise home (home page will handle role-based redirects)
      // (guests will be redirected to /practice by the home page)
      const redirectTo = redirectPath
        ? `${appPrefix}${redirectPath}`
        : `${appPrefix}/home`;

      // Use NextAuth's signIn with "keycloak" provider (our only provider in auth.ts)
      // Pass kc_idp_hint to force Keycloak to skip login page and redirect to the specified provider
      // The provider.id is the slug (already lowercase from database)
      // Realm selection is handled via realm-name cookie read in auth.ts authorization callback
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

      // Import server action dynamically to avoid SSR issues
      const { setGuestSession } = await import("@/app/(main)/layout-server");

      // Set guest session cookies server-side (department-id + auth-mode)
      // Pass selectedDepartmentId (can be null for default settings)
      const result = await setGuestSession(selectedDepartmentId);

      if (!result.ok) {
        toast.error(result.reason || "Failed to set guest session");
        return;
      }

      // Clear localStorage - cookies are now the source of truth
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedProfileId");
      localStorage.removeItem("defaultAccountMode");
      localStorage.removeItem("defaultAccountProfileId");

      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      // Redirect to redirectPath if provided, otherwise practice
      const guestRedirect = redirectPath
        ? `${appPrefix}${redirectPath}`
        : `${appPrefix}/practice`;

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

  const handleDefaultAccountLogin = async () => {
    try {
      if (!activeSettings?.["default_account_profile_id"]) {
        toast.error("Default account not configured");
        return;
      }

      setLoading({ ...loading, defaultAccount: true });

      // Import server action dynamically to avoid SSR issues
      const { setDefaultAccountSession } = await import(
        "@/app/(main)/layout-server"
      );

      // Set default account session cookies server-side (department-id + auth-mode)
      // Pass selectedDepartmentId (can be null for default settings)
      const result = await setDefaultAccountSession(selectedDepartmentId);

      if (!result.ok) {
        toast.error(result.reason || "Failed to set default account session");
        return;
      }

      // Clear localStorage - cookies are now the source of truth
      localStorage.removeItem("guestMode");
      localStorage.removeItem("simulatedProfileId");
      localStorage.removeItem("defaultAccountMode");
      localStorage.removeItem("defaultAccountProfileId");

      const appPrefix = process.env["NEXT_PUBLIC_APP_PREFIX"] || "";

      // Redirect to home after login - home page will handle role-based redirects
      const redirectTo = `${appPrefix}/home`;

      toast.success("Accessing as default account!");
      router.push(redirectTo);
    } catch (error) {
      const errorMessage = (error as Error).message;
      if (!errorMessage.toLowerCase().includes("load failed")) {
        toast.error("An error occurred during login: " + errorMessage);
      }
    } finally {
      setLoading({ ...loading, defaultAccount: false });
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

                      // Calculate and set realm-name cookie for dynamic realm selection
                      // All departments (including default) use their department_id as realm name
                      // Realm name will be updated via API call when department changes
                      // The API response includes the correct realm_name based on settings
                      // Cookie will be set by the useEffect hook when realmName prop updates

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
                      {loading[provider.id] ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <ProviderIcon
                          icon={provider.icon}
                          name={provider.name}
                        />
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

              {/* Default Account Button - only show if show_default_account is true and default_account_profile_id exists */}
              {_show_default_account &&
                activeSettings?.["default_account_profile_id"] && (
                  <motion.div variants={cardVariants} whileHover="hover">
                    <Button
                      type="button"
                      onClick={handleDefaultAccountLogin}
                      disabled={loading["defaultAccount"]}
                      data-testid="default-account-login-button"
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
                        {loading["defaultAccount"] ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <UserIcon />
                        )}
                        <span className="text-base">
                          {loading["defaultAccount"]
                            ? "Signing in..."
                            : "Continue as Default Account"}
                        </span>
                      </div>
                    </Button>
                  </motion.div>
                )}

              {/* Divider - only show if there are SSO providers AND there's something below (guest login OR default account button) */}
              {providers.length > 0 &&
                (guest_login_enabled ||
                  (_show_default_account &&
                    activeSettings?.["default_account_profile_id"])) && (
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
