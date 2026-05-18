/**
 * Thresholds context — score cutoffs resolved from the active setting.
 *
 * The server pre-buckets KPI metrics into `success | warning | danger | neutral`
 * already, so most components don't need the raw numbers. Use this only when
 * you need the threshold values themselves: chart reference lines, tooltips,
 * client-side bucketing.
 *
 * Hydrated by FullPageLayout from `profileData.theme.thresholds`.
 * Calling `useThresholds()` outside a provider returns canonical defaults
 * (85 / 80 / 70) so analytics components can safely depend on it without
 * caring whether the surrounding page is layout-wrapped.
 */
"use client";

import type { components } from "@/lib/api/schema";
import React, { createContext, useContext } from "react";

export type Thresholds = components["schemas"]["Thresholds"];

const DEFAULTS: Thresholds = { success: 85, warning: 80, danger: 70 };

const ThresholdsContext = createContext<Thresholds | null>(null);

export function useThresholds(): Thresholds {
  return useContext(ThresholdsContext) ?? DEFAULTS;
}

export function ThresholdsProvider({
  value,
  children,
}: {
  value: Thresholds | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <ThresholdsContext.Provider value={value ?? null}>
      {children}
    </ThresholdsContext.Provider>
  );
}
