"use client";

import { useEffect } from "react";
import { applyThemeTokens } from "@/lib/theme/apply-theme";
import type { ThemeTokens } from "@/lib/theme/types";

/**
 * ThemeHydrator component that applies theme tokens
 * to CSS variables and handles dark/light mode class toggling.
 *
 * This component runs client-side only and applies theme changes when
 * tokens change. It returns null (no UI).
 */
export function ThemeHydrator({
  tokens,
}: {
  tokens: ThemeTokens | null;
}) {
  useEffect(() => {
    if (!tokens) return;

    // Apply theme tokens to CSS variables
    applyThemeTokens(tokens);

    // Default to light mode
    const root = document.documentElement;
    root.classList.remove("dark");
  }, [tokens]);

  return null; // No UI
}
