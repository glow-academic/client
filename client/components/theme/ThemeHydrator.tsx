"use client";

import { useEffect } from "react";
import { applyThemeTokens } from "@/lib/theme/apply-theme";
import { SettingsActiveClient } from "@/app/(main)/layout-server";

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
  activeSettings: SettingsActiveClient | null;
}) {
  useEffect(() => {
    if (!activeSettings?.tokens) return;

    // Apply theme tokens to CSS variables
    applyThemeTokens(activeSettings.tokens);

    // Handle dark/light mode by toggling .dark class on document root
    // Note: mode is not currently in SettingsActiveClient type, so we skip mode handling for now
    // If mode support is needed, it should be added to SettingsFields in layout-server.tsx
    const root = document.documentElement;
    // Default to light mode if mode is not available
    root.classList.remove("dark");
  }, [
    activeSettings?.id,
    activeSettings?.tokens,
  ]); // Re-run when active theme changes

  return null; // No UI
}
