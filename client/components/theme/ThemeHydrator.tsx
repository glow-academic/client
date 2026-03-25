"use client";

import { useEffect } from "react";
import { applyThemeTokens } from "@/lib/theme/apply-theme";
import {
  deriveThemeTokens,
  type ThemePrimitives,
} from "@/lib/theme/derive-tokens";

/**
 * ThemeHydrator component that derives CSS tokens from raw color primitives
 * and applies them as CSS variables. Handles dark/light mode class toggling.
 *
 * This component runs client-side only and returns null (no UI).
 */
export function ThemeHydrator({
  primitives,
}: {
  primitives: ThemePrimitives | null;
}) {
  useEffect(() => {
    if (!primitives) return;

    const tokens = deriveThemeTokens(primitives);
    applyThemeTokens(tokens);

    // Default to light mode
    const root = document.documentElement;
    root.classList.remove("dark");
  }, [primitives]);

  return null;
}
