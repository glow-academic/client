"use client";

import type { AuthSettingsResponse } from "@/app/(main)/layout-server";
import React, { createContext, useContext, useMemo } from "react";

interface SettingsContextType {
  settingsId: string | null;
  successThreshold: number | null;
  warningThreshold: number | null;
  dangerThreshold: number | null;
  tokens: AuthSettingsResponse["tokens"];
  agents: AuthSettingsResponse["agents"];
  tools: AuthSettingsResponse["tools"];
  artifactHasGenerate: Record<string, boolean>;
  artifactHasInsights: Record<string, boolean>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProviderClient");
  }
  return context;
}

interface SettingsProviderClientProps {
  children: React.ReactNode;
  settings: AuthSettingsResponse | null;
}

export function SettingsProviderClient({
  children,
  settings,
}: SettingsProviderClientProps) {
  const value = useMemo<SettingsContextType>(
    () => ({
      settingsId: settings?.settings_id ?? null,
      successThreshold: settings?.success_threshold ?? null,
      warningThreshold: settings?.warning_threshold ?? null,
      dangerThreshold: settings?.danger_threshold ?? null,
      tokens: settings?.tokens ?? null,
      agents: settings?.agents ?? null,
      tools: settings?.tools ?? null,
      artifactHasGenerate: settings?.artifact_has_generate ?? {},
      artifactHasInsights: settings?.artifact_has_insights ?? {},
    }),
    [settings]
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}
