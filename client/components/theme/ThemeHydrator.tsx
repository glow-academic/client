"use client";

import { useEffect } from "react";
import type { SettingsActiveOut } from "@/app/(main)/layout-server";
import { applyThemeTokens } from "@/lib/theme/apply-theme";

/**
 * ThemeHydrator component that applies theme tokens from activeSettings
 * to CSS variables and handles dark/light mode class toggling.
 *
 * This component runs client-side only and applies theme changes when
 * activeSettings changes. It returns null (no UI).
 */
export function ThemeHydrator({
  activeSettings,
}: {
  activeSettings: SettingsActiveOut | null;
}) {
  useEffect(() => {
    if (!activeSettings?.tokens) return;

    // Apply theme tokens to CSS variables
    applyThemeTokens(activeSettings.tokens);

    // Handle dark/light mode by toggling .dark class on document root
    const root = document.documentElement;
    if (activeSettings.mode === "dark") {
      root.classList.add("dark");
    } else if (activeSettings.mode === "light") {
      root.classList.remove("dark");
    }
    // For 'system' mode, we could defer to prefers-color-scheme,
    // but for POC we'll default to light
    else if (activeSettings.mode === "system") {
      // For now, default to light mode
      // Future: could check window.matchMedia("(prefers-color-scheme: dark)")
      root.classList.remove("dark");
    }
  }, [
    activeSettings?.settings_id,
    activeSettings?.mode,
    activeSettings?.tokens,
  ]); // Re-run when active theme changes

  return null; // No UI
}
