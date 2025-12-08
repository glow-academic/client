/**
 * Settings.tsx
 * Used to view and update application settings
 * Minimal design with left-aligned fields
 */

"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

// Type-only import from server pages
import type {
  KeysListOut,
  SettingsDetailOut,
  UpdateSettingsIn,
  UpdateSettingsOut,
} from "@/app/(main)/system/settings/page";
import { AuthsTable } from "../common/settings/AuthsTable";

export interface SettingsProps {
  settingsList: SettingsDetailOut[];
  settingsDetail: SettingsDetailOut | null;
  selectedSettingsId: string | null;
  profileId: string;
  keysList: KeysListOut;
  getSettingsDetailAction: (
    settingsId: string,
    profileId: string
  ) => Promise<SettingsDetailOut>;
  getKeysListAction: (profileId: string) => Promise<KeysListOut>;
  updateSettingsAction?: (
    input: UpdateSettingsIn
  ) => Promise<UpdateSettingsOut>;
}

export default function Settings({
  settingsList,
  settingsDetail: initialSettingsDetail,
  selectedSettingsId: initialSelectedSettingsId,
  profileId,
  keysList: initialKeysList,
  getSettingsDetailAction,
  getKeysListAction,
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
  const [keysList, setKeysList] = useState<KeysListOut>(initialKeysList);

  // Key mappings state
  const [providerKeyMapping, setProviderKeyMapping] = useState<
    Record<string, string>
  >({});
  const [authKeyMapping, setAuthKeyMapping] = useState<
    Record<string, Record<string, string>>
  >({});

  // Build settings mapping for picker
  const settingsMapping = useMemo(() => {
    const mapping: Record<string, SettingsDetailOut> = {};
    settingsList.forEach((setting) => {
      mapping[setting.settings_id] = setting;
    });
    return mapping;
  }, [settingsList]);

  // Form data state with all ThemePrimitives and new settings
  const [formData, setFormData] = useState({
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
    guest_login_enabled: true,
    success_threshold: 85,
    warning_threshold: 80,
    danger_threshold: 70,
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

  // Build key mapping for KeyPicker
  const keyMapping = useMemo(() => {
    const mapping: Record<
      string,
      {
        name: string;
        description: string;
        key_masked: string;
        active: boolean;
        department_ids: string[] | null;
      }
    > = {};
    keysList.keys.forEach((key) => {
      mapping[key.key_id] = {
        name: key.name,
        description: key.description || "",
        key_masked: key.key_masked,
        active: key.active,
        department_ids: key.department_ids || null,
      };
    });
    return mapping;
  }, [keysList]);

  const validKeyIds = useMemo(() => {
    return keysList.keys.map((key) => key.key_id);
  }, [keysList]);

  // Update form data and key mappings when settings detail changes
  useEffect(() => {
    if (settingsDetail) {
      setFormData({
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
        guest_login_enabled: settingsDetail.guest_login_enabled ?? true,
        success_threshold: settingsDetail.success_threshold ?? 85,
        warning_threshold: settingsDetail.warning_threshold ?? 80,
        danger_threshold: settingsDetail.danger_threshold ?? 70,
      });

      // Initialize key mappings from settings detail
      setProviderKeyMapping(settingsDetail.provider_key_mapping || {});
      setAuthKeyMapping(settingsDetail.auth_key_mapping || {});
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
      // Refresh keys list
      const freshKeysList = await getKeysListAction(profileId);
      setKeysList(freshKeysList);
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
          guest_login_enabled: formData.guest_login_enabled,
          success_threshold: formData.success_threshold,
          warning_threshold: formData.warning_threshold,
          danger_threshold: formData.danger_threshold,
          profileId,
          provider_key_mapping:
            Object.keys(providerKeyMapping).length > 0
              ? providerKeyMapping
              : undefined,
          auth_key_mapping:
            Object.keys(authKeyMapping).length > 0 ? authKeyMapping : undefined,
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
          <GenericPicker
            items={settingsMapping}
            itemIds={Object.keys(settingsMapping)}
            selectedIds={selectedSettingsId ? [selectedSettingsId] : []}
            onSelect={(ids) => handleSelectSettings(ids[0] || null)}
            getId={(item) => (item as unknown as { id: string }).id}
            getLabel={(item) => {
              const date = new Date(item.created_at);
              return `Settings (${date.toLocaleDateString()})`;
            }}
            getSearchText={(item) => {
              const date = new Date(item.created_at);
              return `Settings ${date.toLocaleDateString()} ${item.active ? "Active" : "Inactive"}`;
            }}
            renderButton={(selectedItems) => {
              if (selectedItems.length === 0) {
                return "Select settings version...";
              }
              const setting = selectedItems[0];
              const date = new Date(setting.created_at);
              const isDefault =
                !setting.department_ids || setting.department_ids.length === 0;
              return (
                <div className="flex items-center gap-2 truncate">
                  {isDefault && (
                    <Badge
                      variant="secondary"
                      className="text-xs h-5 px-1.5 flex-shrink-0"
                    >
                      Default
                    </Badge>
                  )}
                  <span className="truncate">
                    Settings ({date.toLocaleDateString()})
                  </span>
                </div>
              );
            }}
            renderItem={(item, isSelected) => {
              const date = new Date(item.created_at);
              const isDefault =
                !item.department_ids || item.department_ids.length === 0;
              return (
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isDefault && (
                        <Badge
                          variant="secondary"
                          className="text-xs h-5 px-1.5"
                        >
                          Default
                        </Badge>
                      )}
                      <div className="font-medium truncate">
                        Settings ({date.toLocaleDateString()})
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                      {item.active ? "Active" : "Inactive"}
                    </div>
                    {item.department_ids && item.department_ids.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.department_ids.length} department
                        {item.department_ids.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </div>
              );
            }}
            placeholder="Select settings version..."
            multiSelect={false}
            hideSelectedChips={true}
            buttonClassName="w-full"
            groupHeading="Settings"
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

        {/* Linked Auths & Providers */}
        {settingsDetail && (
          <div className="space-y-6">
            {/* Authentication Methods Table */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Authentication Methods</h3>
              <AuthsTable
                data={authTableData}
                keyMapping={keyMapping}
                validKeyIds={validKeyIds}
                onKeyChange={(authId, authItemId, keyId) => {
                  setAuthKeyMapping((prev) => ({
                    ...prev,
                    [authId]: {
                      ...(prev[authId] || {}),
                      [authItemId]: keyId ?? "",
                    },
                  }));
                }}
                readonly={isSubmitting}
              />
            </div>

            {/* AI Providers Table */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">AI Providers</h3>
              <ProvidersTable
                data={providerTableData}
                keyMapping={keyMapping}
                validKeyIds={validKeyIds}
                onKeyChange={(providerId, keyId) => {
                  setProviderKeyMapping((prev) => ({
                    ...prev,
                    [providerId]: keyId ?? "",
                  }));
                }}
                readonly={isSubmitting}
              />
            </div>
          </div>
        )}

        {/* Authentication & Analytics */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Authentication & Analytics</h3>

          {/* Guest Login Enabled */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="guest_login_enabled">Enable Guest Login</Label>
              <Switch
                id="guest_login_enabled"
                checked={formData.guest_login_enabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    guest_login_enabled: checked,
                  }))
                }
                disabled={isSubmitting}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              When enabled, users can access the application as a guest without
              signing in.
            </p>
          </div>

          {/* Analytics Thresholds */}
          <div className="space-y-4">
            <h4 className="text-md font-medium">Analytics Thresholds</h4>
            <p className="text-sm text-muted-foreground">
              Configure thresholds for dashboard metrics (0-100). These values
              determine when metrics are displayed as success, warning, or
              danger.
            </p>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="success_threshold">Success Threshold</Label>
                <Input
                  id="success_threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.success_threshold}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      success_threshold: Math.min(
                        100,
                        Math.max(0, parseInt(e.target.value) || 85)
                      ),
                    }))
                  }
                  disabled={isSubmitting}
                  className="max-w-md"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warning_threshold">Warning Threshold</Label>
                <Input
                  id="warning_threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.warning_threshold}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      warning_threshold: Math.min(
                        100,
                        Math.max(0, parseInt(e.target.value) || 80)
                      ),
                    }))
                  }
                  disabled={isSubmitting}
                  className="max-w-md"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="danger_threshold">Danger Threshold</Label>
                <Input
                  id="danger_threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.danger_threshold}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      danger_threshold: Math.min(
                        100,
                        Math.max(0, parseInt(e.target.value) || 70)
                      ),
                    }))
                  }
                  disabled={isSubmitting}
                  className="max-w-md"
                />
              </div>
            </div>
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
