"use client";

import { useEffect, useState } from "react";

/**
 * Hook to get computed CSS variable value from the DOM.
 * Handles SSR safely and updates when dark mode changes.
 *
 * @param variableName - CSS variable name (e.g., "--success")
 * @param fallback - Fallback value to use during SSR or if variable not found
 * @returns The computed CSS variable value
 */
export function useCSSVariable(
  variableName: string,
  fallback: string = ""
): string {
  const [value, setValue] = useState<string>(fallback);

  useEffect(() => {
    // SSR safety check
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const getComputedValue = () => {
      const root = document.documentElement;
      const computedValue =
        getComputedStyle(root).getPropertyValue(variableName);
      return computedValue.trim() || fallback;
    };

    // Get initial value
    setValue(getComputedValue());

    // Watch for dark mode changes by observing class changes on documentElement
    const observer = new MutationObserver(() => {
      setValue(getComputedValue());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Also listen for storage changes (in case theme is stored)
    const handleStorageChange = () => {
      setValue(getComputedValue());
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [variableName, fallback]);

  return value;
}
