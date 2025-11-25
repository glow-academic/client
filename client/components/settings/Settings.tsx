/**
 * Settings.tsx
 * Used to view and update application settings
 * Minimal design with left-aligned fields
 */

"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SettingsPicker } from "@/components/common/forms/SettingsPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Type-only import from server pages
import type {
  SettingsDetailOut,
  UpdateSettingsIn,
  UpdateSettingsOut,
} from "@/app/(main)/system/settings/page";

export interface SettingsProps {
  settingsList: SettingsDetailOut[];
  settingsDetail: SettingsDetailOut | null;
  selectedSettingsId: string | null;
  profileId: string;
  getSettingsDetailAction: (
    settingsId: string,
    profileId: string
  ) => Promise<SettingsDetailOut>;
  updateSettingsAction?: (
    input: UpdateSettingsIn
  ) => Promise<UpdateSettingsOut>;
}

export default function Settings({
  settingsList,
  settingsDetail: initialSettingsDetail,
  selectedSettingsId: initialSelectedSettingsId,
  profileId,
  getSettingsDetailAction,
  updateSettingsAction,
}: SettingsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colorPickerOpenStates, setColorPickerOpenStates] = useState<
    Record<string, boolean>
  >({});
  const [selectedSettingsId, setSelectedSettingsId] = useState<string | null>(
    initialSelectedSettingsId
  );
  const [settingsDetail, setSettingsDetail] =
    useState<SettingsDetailOut | null>(initialSettingsDetail);

  // Build settings mapping for picker
  const settingsMapping = useMemo(() => {
    const mapping: Record<string, SettingsDetailOut> = {};
    settingsList.forEach((setting) => {
      mapping[setting.settings_id] = setting;
    });
    return mapping;
  }, [settingsList]);

  // Form data state with all ThemePrimitives
  const [formData, setFormData] = useState({
    organization_name: "",
    primary_color: "#171717",
    accent: "#f5f5f5",
    background: "#ffffff",
    surface: "#ffffff",
    success: "#009e34",
    warning: "#ea8100",
    error: "#e7000b",
    sidebar_background: "#fafafa",
    sidebar_primary: "#171717",
    chart1: "#f54900",
    chart2: "#009689",
    chart3: "#104e64",
    chart4: "#ffb900",
    chart5: "#fe9a00",
  });

  // Preset colors (same as persona colors)
  const presetColors = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#eab308",
    "#84cc16",
    "#22c55e",
    "#10b981",
    "#14b8a6",
    "#06b6d4",
    "#0ea5e9",
    "#3b82f6",
    "#6366f1",
    "#8b5cf6",
    "#a855f7",
    "#d946ef",
    "#ec4899",
    "#f43f5e",
  ];

  // Update form data when settings detail changes
  useEffect(() => {
    if (settingsDetail) {
      setFormData({
        organization_name: settingsDetail.organization_name || "",
        primary_color: settingsDetail.primary_color || "#171717",
        accent: settingsDetail.accent || "#f5f5f5",
        background: settingsDetail.background || "#ffffff",
        surface: settingsDetail.surface || "#ffffff",
        success: settingsDetail.success || "#009e34",
        warning: settingsDetail.warning || "#ea8100",
        error: settingsDetail.error || "#e7000b",
        sidebar_background: settingsDetail.sidebar_background || "#fafafa",
        sidebar_primary: settingsDetail.sidebar_primary || "#171717",
        chart1: settingsDetail.chart1 || "#f54900",
        chart2: settingsDetail.chart2 || "#009689",
        chart3: settingsDetail.chart3 || "#104e64",
        chart4: settingsDetail.chart4 || "#ffb900",
        chart5: settingsDetail.chart5 || "#fe9a00",
      });
    }
  }, [settingsDetail]);

  // Handle settings selection change
  const handleSelectSettings = async (settingsId: string | null) => {
    if (!settingsId) {
      setSelectedSettingsId(null);
      setSettingsDetail(null);
      return;
    }

    setSelectedSettingsId(settingsId);
    try {
      const detailResult = await getSettingsDetailAction(settingsId, profileId);
      setSettingsDetail(detailResult);
    } catch {
      toast.error("Failed to load settings detail");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!updateSettingsAction) {
      toast.error("Update action not available");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateSettingsAction({
        body: {
          organization_name: formData.organization_name,
          primary_color: formData.primary_color,
          accent: formData.accent,
          background: formData.background,
          surface: formData.surface,
          success: formData.success,
          warning: formData.warning,
          error: formData.error,
          sidebar_background: formData.sidebar_background,
          sidebar_primary: formData.sidebar_primary,
          chart1: formData.chart1,
          chart2: formData.chart2,
          chart3: formData.chart3,
          chart4: formData.chart4,
          chart5: formData.chart5,
          profileId,
        },
      });

      if (result.success) {
        toast.success(result.message || "Settings updated successfully");
        // Refresh the page to get updated settings list
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update settings");
      }
    } catch (error) {
      toast.error(
        `Failed to update settings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to create a color picker
  const ColorPicker = ({
    label,
    fieldName,
    value,
  }: {
    label: string;
    fieldName: keyof typeof formData;
    value: string;
  }) => {
    const isOpen = colorPickerOpenStates[fieldName] || false;
    const setOpen = (open: boolean) => {
      setColorPickerOpenStates((prev) => ({ ...prev, [fieldName]: open }));
    };

    return (
      <div className="space-y-2">
        <Label htmlFor={fieldName}>{label}</Label>
        <Popover open={isOpen} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              disabled={isSubmitting}
              type="button"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: value }}
                />
                <span>{value}</span>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${fieldName}Input`}>Hex Color</Label>
                <div className="flex gap-2">
                  <Input
                    id={`${fieldName}Input`}
                    value={value}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      // Allow any hex value (with or without #, any length)
                      if (
                        newValue === "" ||
                        /^#?[0-9A-Fa-f]*$/.test(newValue)
                      ) {
                        setFormData((prev) => ({
                          ...prev,
                          [fieldName]:
                            newValue.startsWith("#") || newValue === ""
                              ? newValue
                              : `#${newValue}`,
                        }));
                      }
                    }}
                    placeholder="#000000"
                    className="flex-1"
                  />
                  <div
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: value }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Preset Colors</Label>
                <div className="grid grid-cols-8 gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-8 h-8 rounded border-2 border-gray-200 hover:border-gray-400 transition-colors"
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          [fieldName]: color,
                        }));
                        setOpen(false);
                      }}
                      data-testid={`preset-color-${fieldName}`}
                      data-color={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Settings Picker */}
        <div className="space-y-2">
          <Label htmlFor="settings-picker">Settings Version</Label>
          <SettingsPicker
            settingsMapping={settingsMapping}
            selectedSettingsId={selectedSettingsId}
            onSelect={handleSelectSettings}
            placeholder="Select settings version..."
          />
        </div>

        {/* Organization Name */}
        <div className="space-y-2">
          <Label htmlFor="organization_name">Organization Name</Label>
          <Input
            id="organization_name"
            type="text"
            value={formData.organization_name}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                organization_name: e.target.value,
              }))
            }
            placeholder="e.g. Purdue University"
            disabled={isSubmitting}
            className="max-w-md"
          />
        </div>

        {/* Core Brand Colors */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Core Brand Colors</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <ColorPicker
              label="Primary Color"
              fieldName="primary_color"
              value={formData.primary_color}
            />
            <ColorPicker
              label="Accent"
              fieldName="accent"
              value={formData.accent}
            />
          </div>
        </div>

        {/* Layout Colors */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Layout Colors</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <ColorPicker
              label="Background"
              fieldName="background"
              value={formData.background}
            />
            <ColorPicker
              label="Surface"
              fieldName="surface"
              value={formData.surface}
            />
          </div>
        </div>

        {/* Status Colors */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Status Colors</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <ColorPicker
              label="Success"
              fieldName="success"
              value={formData.success}
            />
            <ColorPicker
              label="Warning"
              fieldName="warning"
              value={formData.warning}
            />
            <ColorPicker
              label="Error"
              fieldName="error"
              value={formData.error}
            />
          </div>
        </div>

        {/* Sidebar Colors */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Sidebar Colors</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <ColorPicker
              label="Sidebar Background"
              fieldName="sidebar_background"
              value={formData.sidebar_background}
            />
            <ColorPicker
              label="Sidebar Primary"
              fieldName="sidebar_primary"
              value={formData.sidebar_primary}
            />
          </div>
        </div>

        {/* Chart Colors */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Chart Colors</h3>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <ColorPicker
              label="Chart 1"
              fieldName="chart1"
              value={formData.chart1}
            />
            <ColorPicker
              label="Chart 2"
              fieldName="chart2"
              value={formData.chart2}
            />
            <ColorPicker
              label="Chart 3"
              fieldName="chart3"
              value={formData.chart3}
            />
            <ColorPicker
              label="Chart 4"
              fieldName="chart4"
              value={formData.chart4}
            />
            <ColorPicker
              label="Chart 5"
              fieldName="chart5"
              value={formData.chart5}
            />
          </div>
        </div>

        {/* Update Button - Bottom Right */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            data-testid="btn-update-settings"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Updating...
              </>
            ) : (
              "Update Settings"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
