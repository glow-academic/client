/**
 * SettingsThemePresetPicker.tsx
 * Preset theme picker for Settings page
 * Allows selection of predefined university themes (12 universities with maximum color spread)
 */
"use client";

import React, { useMemo } from "react";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { UNIVERSITY_THEMES, type ThemePreset } from "./universityThemes";

// Re-export ThemePreset for backward compatibility
export type { ThemePreset };

export interface SettingsThemePresetPickerProps {
  onThemeSelect: (theme: ThemePreset) => void;
  disabled?: boolean;
  className?: string;
}

export function SettingsThemePresetPicker({
  onThemeSelect,
  disabled = false,
  className,
}: SettingsThemePresetPickerProps) {
  // Build mapping for GenericPicker
  const themeMapping = useMemo(() => {
    const mapping: Record<string, ThemePreset> = {};
    UNIVERSITY_THEMES.forEach((theme) => {
      mapping[theme.id] = theme;
    });
    return mapping;
  }, []);

  const validThemeIds = useMemo(() => {
    return UNIVERSITY_THEMES.map((theme) => theme.id);
  }, []);

  const handleSelect = (ids: string[]) => {
    const themeId = ids[0];
    if (themeId) {
      const theme = themeMapping[themeId];
      if (theme) {
        onThemeSelect(theme);
      }
    }
  };

  return (
    <div className={className || "ml-4 shrink-0"}>
      <GenericPicker
        items={themeMapping}
        itemIds={validThemeIds}
        selectedIds={[]}
        onSelect={handleSelect}
        getId={(item) => (item as ThemePreset).id}
        getLabel={(item) => (item as ThemePreset).name}
        getSearchText={(item) => (item as ThemePreset).name}
        placeholder="Select theme..."
        searchPlaceholder="Search themes..."
        emptyMessage="No themes found."
        groupHeading="Preset Themes"
        buttonClassName="w-64"
        disabled={disabled}
      />
    </div>
  );
}
