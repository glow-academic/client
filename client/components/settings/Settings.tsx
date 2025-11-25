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
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
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

  // Form data state
  const [formData, setFormData] = useState({
    organization_name: "",
    color: "#3B82F6",
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
        color: settingsDetail.color || "#3B82F6",
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
          color: formData.color,
          organization_name: formData.organization_name,
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

        {/* Color Picker */}
        <div className="space-y-2">
          <Label htmlFor="color">Theme Color</Label>
          <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full max-w-md justify-start text-left font-normal"
                disabled={isSubmitting}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: formData.color }}
                  />
                  <span>{formData.color}</span>
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="colorInput">Hex Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="colorInput"
                      value={formData.color}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Allow any hex value (with or without #, any length)
                        if (value === "" || /^#?[0-9A-Fa-f]*$/.test(value)) {
                          setFormData((prev) => ({
                            ...prev,
                            color: value.startsWith("#") ? value : `#${value}`,
                          }));
                        }
                      }}
                      placeholder="#000000"
                      className="flex-1"
                    />
                    <div
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: formData.color }}
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
                          setFormData((prev) => ({ ...prev, color }));
                          setColorPickerOpen(false);
                        }}
                        data-testid="preset-color"
                        data-color={color}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
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
