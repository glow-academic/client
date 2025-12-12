/**
 * SettingsForm.tsx
 * Shared settings form component for Settings and Department pages
 * Card-based design inspired by Scenario.tsx
 */

"use client";

import type {
  KeysListOut,
  SettingsDetailOut,
} from "@/app/(main)/system/settings/page";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { AuthsTable } from "@/components/common/settings/AuthsTable";
import { ProvidersTable } from "@/components/common/settings/ProvidersTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useEffect, useMemo, useState } from "react";

export interface ProfileMappingItem {
  profile_id: string;
  name: string;
  role: string;
  first_name: string;
  last_name: string;
}

export interface SettingsFormProps {
  settingsDetail: SettingsDetailOut | null;
  keysList: KeysListOut;
  profileMapping?: Record<string, ProfileMappingItem>;
  validProfileIds?: string[];
  formData: {
    primary_color: string;
    accent: string;
    background: string;
    surface: string;
    success: string;
    warning: string;
    error: string;
    sidebar_background: string;
    sidebar_primary: string;
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    guest_login_enabled: boolean;
    success_threshold: number;
    warning_threshold: number;
    danger_threshold: number;
    default_admin_profile_id?: string | null;
    default_guest_profile_id?: string | null;
  };
  providerKeyMapping: Record<string, string>;
  authKeyMapping: Record<string, Record<string, string>>;
  onFormDataChange: (field: string, value: unknown) => void;
  onProviderKeyChange: (providerId: string, keyId: string | null) => void;
  onProviderEnabledChange?: (providerId: string, enabled: boolean) => void;
  onAuthEnabledChange?: (authId: string, enabled: boolean) => void;
  onAuthKeyChange: (
    authId: string,
    authItemId: string,
    keyId: string | null
  ) => void;
  onAuthValueChange?: (
    authId: string,
    authItemId: string,
    value: string
  ) => void;
  onDefaultAdminChange?: (profileId: string | null) => void;
  onDefaultGuestChange?: (profileId: string | null) => void;
  isSubmitting?: boolean;
  readonly?: boolean;
}

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

export function SettingsForm({
  settingsDetail,
  keysList,
  profileMapping = {},
  validProfileIds = [],
  formData,
  providerKeyMapping,
  authKeyMapping,
  onFormDataChange,
  onProviderKeyChange,
  onProviderEnabledChange,
  onAuthEnabledChange,
  onAuthKeyChange,
  onAuthValueChange: _onAuthValueChange,
  onDefaultAdminChange,
  onDefaultGuestChange,
  isSubmitting = false,
  readonly = false,
}: SettingsFormProps) {
  const [colorPickerOpenStates, setColorPickerOpenStates] = useState<
    Record<string, boolean>
  >({});

  // Track provider enabled state
  const [providerEnabled, setProviderEnabled] = useState<
    Record<string, boolean>
  >({});

  // Initialize provider enabled state from settings detail
  useEffect(() => {
    if (settingsDetail) {
      const enabled: Record<string, boolean> = {};
      settingsDetail.all_provider_ids.forEach((providerId) => {
        enabled[providerId] = settingsDetail.provider_ids.includes(providerId);
      });
      setProviderEnabled(enabled);
    }
  }, [settingsDetail]);

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

  // Filter profiles by role
  const guestProfiles = useMemo(() => {
    return validProfileIds.filter((id) => {
      const profile = profileMapping[id];
      return profile?.role === "guest";
    });
  }, [validProfileIds, profileMapping]);

  const adminProfiles = useMemo(() => {
    return validProfileIds.filter((id) => {
      const profile = profileMapping[id];
      return profile?.role === "admin" || profile?.role === "superadmin";
    });
  }, [validProfileIds, profileMapping]);

  // Track auth enabled state
  const [authEnabled, setAuthEnabled] = useState<Record<string, boolean>>({});

  // Initialize auth enabled state from settings detail
  useEffect(() => {
    if (settingsDetail) {
      const enabled: Record<string, boolean> = {};
      settingsDetail.all_auth_ids?.forEach((authId) => {
        enabled[authId] = settingsDetail.auth_ids?.includes(authId) ?? false;
      });
      setAuthEnabled(enabled);
    }
  }, [settingsDetail]);

  // Build auth table data - use ALL auths, show ALL items (encrypted and non-encrypted)
  const authTableData = useMemo(() => {
    if (!settingsDetail || !settingsDetail.all_auth_ids) return [];
    const data: Array<{
      auth_id: string;
      auth_name: string;
      auth_description: string;
      auth_slug: string | null;
      auth_item_id: string;
      auth_item_name: string;
      auth_item_description: string;
      selected_key_id: string | null;
      value: string | null;
      encrypted: boolean;
      enabled: boolean;
    }> = [];

    settingsDetail.all_auth_ids.forEach((authId) => {
      const auth =
        settingsDetail.all_auth_mapping?.[authId] ||
        settingsDetail.auth_mapping?.[authId];
      const enabled = authEnabled[authId] ?? false;

      // Get ALL items (encrypted and non-encrypted)
      const authItems = settingsDetail.auth_items_mapping?.[authId] || [];

      // If no items, still show the auth row
      if (authItems.length === 0) {
        const authName = typeof auth?.["name"] === "string" ? auth["name"] : "";
        const authDesc =
          typeof auth?.["description"] === "string" ? auth["description"] : "";
        const authSlug =
          typeof auth?.["slug"] === "string" ? auth["slug"] : null;
        data.push({
          auth_id: authId,
          auth_name: authName,
          auth_description: authDesc,
          auth_slug: authSlug,
          auth_item_id: "",
          auth_item_name: "",
          auth_item_description: "",
          selected_key_id: null,
          value: null,
          encrypted: false,
          enabled,
        });
      } else {
        // Show all items (encrypted and non-encrypted)
        authItems.forEach((item: { [key: string]: unknown }) => {
          const authItemId =
            typeof item["auth_item_id"] === "string"
              ? item["auth_item_id"]
              : "";
          const itemName = typeof item["name"] === "string" ? item["name"] : "";
          const itemDesc =
            typeof item["description"] === "string" ? item["description"] : "";
          const itemEncrypted =
            typeof item["encrypted"] === "boolean" ? item["encrypted"] : false;

          const itemKeyMapping = authKeyMapping[authId] || {};
          const itemValueMapping =
            settingsDetail.auth_value_mapping?.[authId] || {};
          const selectedKeyId = itemEncrypted
            ? itemKeyMapping[authItemId] || null
            : null;
          const value = !itemEncrypted
            ? itemValueMapping[authItemId] || null
            : null;

          const authName =
            typeof auth?.["name"] === "string" ? auth["name"] : "";
          const authDesc =
            typeof auth?.["description"] === "string"
              ? auth["description"]
              : "";
          const authSlug =
            typeof auth?.["slug"] === "string" ? auth["slug"] : null;
          data.push({
            auth_id: authId,
            auth_name: authName,
            auth_description: authDesc,
            auth_slug: authSlug,
            auth_item_id: authItemId,
            auth_item_name: itemName,
            auth_item_description: itemDesc || "",
            selected_key_id: selectedKeyId,
            value: value,
            encrypted: itemEncrypted,
            enabled,
          });
        });
      }
    });

    return data;
  }, [settingsDetail, authKeyMapping, authEnabled]);

  // Build provider table data - use ALL providers, not just linked ones
  const providerTableData = useMemo(() => {
    if (!settingsDetail) return [];
    return settingsDetail.all_provider_ids.map((providerId) => {
      const provider = settingsDetail.all_provider_mapping[providerId];
      const selectedKeyId = providerKeyMapping[providerId] || null;
      const enabled = providerEnabled[providerId] ?? false;
      const providerName =
        typeof provider?.["name"] === "string" ? provider["name"] : "";
      const providerDesc =
        typeof provider?.["description"] === "string"
          ? provider["description"]
          : "";
      const providerValue =
        typeof provider?.["value"] === "string" ? provider["value"] : null;
      return {
        provider_id: providerId,
        provider_name: providerName,
        provider_description: providerDesc,
        provider_value: providerValue,
        selected_key_id: selectedKeyId,
        enabled,
      };
    });
  }, [settingsDetail, providerKeyMapping, providerEnabled]);

  // Handle provider enable/disable
  const handleProviderEnabledChange = (
    providerId: string,
    enabled: boolean
  ) => {
    setProviderEnabled((prev) => ({
      ...prev,
      [providerId]: enabled,
    }));
    // Call parent callback if provided
    if (onProviderEnabledChange) {
      onProviderEnabledChange(providerId, enabled);
    }
  };

  // Handle auth enable/disable
  const handleAuthEnabledChange = (authId: string, enabled: boolean) => {
    setAuthEnabled((prev) => ({
      ...prev,
      [authId]: enabled,
    }));
    // Call parent callback if provided
    if (onAuthEnabledChange) {
      onAuthEnabledChange(authId, enabled);
    }
  };

  // Color picker component
  const ColorPicker = ({
    label,
    fieldName,
    value,
  }: {
    label: string;
    fieldName: string;
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
              disabled={isSubmitting || readonly}
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
                      if (
                        newValue === "" ||
                        /^#?[0-9A-Fa-f]*$/.test(newValue)
                      ) {
                        onFormDataChange(
                          fieldName,
                          newValue.startsWith("#") || newValue === ""
                            ? newValue
                            : `#${newValue}`
                        );
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
                        onFormDataChange(fieldName, color);
                        setOpen(false);
                      }}
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
    <div className="space-y-8">
      {/* Authentication Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Authentication</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="guest_login_enabled" className="text-sm">
              Guest Login
            </Label>
            <Switch
              id="guest_login_enabled"
              checked={formData.guest_login_enabled}
              onCheckedChange={(checked) =>
                onFormDataChange("guest_login_enabled", checked)
              }
              disabled={isSubmitting || readonly}
            />
          </div>
        </div>
        <Separator />
        <div className="space-y-4">
          {/* Default Account Pickers */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {/* Default Guest Account */}
            {onDefaultGuestChange && (
              <div className="space-y-2">
                <Label>Default Guest Account</Label>
                <GenericPicker
                  items={profileMapping}
                  itemIds={guestProfiles}
                  selectedIds={
                    formData.default_guest_profile_id
                      ? [formData.default_guest_profile_id]
                      : []
                  }
                  onSelect={(ids) => onDefaultGuestChange(ids[0] || null)}
                  getId={(item) => {
                    const profile = item as ProfileMappingItem;
                    return profile.profile_id;
                  }}
                  getLabel={(item) => {
                    const profile = item as ProfileMappingItem;
                    return `${profile.first_name} ${profile.last_name} (${profile.role})`;
                  }}
                  getSearchText={(item) => {
                    const profile = item as ProfileMappingItem;
                    return `${profile.name} ${profile.role}`;
                  }}
                  renderButton={(selectedItems) => {
                    if (selectedItems.length === 0) {
                      return "Select guest account...";
                    }
                    const profile = selectedItems[0] as ProfileMappingItem;
                    return `${profile.first_name} ${profile.last_name}`;
                  }}
                  renderItem={(item, _isSelected) => {
                    const profile = item as ProfileMappingItem;
                    return (
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {profile.first_name} {profile.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {profile.role}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                  placeholder="Select guest account..."
                  disabled={isSubmitting || readonly}
                  multiSelect={false}
                  hideSelectedChips={true}
                  buttonClassName="w-full"
                />
              </div>
            )}

            {/* Default Admin Account */}
            {onDefaultAdminChange && (
              <div className="space-y-2">
                <Label>Default Admin Account</Label>
                <GenericPicker
                  items={profileMapping}
                  itemIds={adminProfiles}
                  selectedIds={
                    formData.default_admin_profile_id
                      ? [formData.default_admin_profile_id]
                      : []
                  }
                  onSelect={(ids) => onDefaultAdminChange(ids[0] || null)}
                  getId={(item) => {
                    const profile = item as ProfileMappingItem;
                    return profile.profile_id;
                  }}
                  getLabel={(item) => {
                    const profile = item as ProfileMappingItem;
                    return `${profile.first_name} ${profile.last_name} (${profile.role})`;
                  }}
                  getSearchText={(item) => {
                    const profile = item as ProfileMappingItem;
                    return `${profile.name} ${profile.role}`;
                  }}
                  renderButton={(selectedItems) => {
                    if (selectedItems.length === 0) {
                      return "Select admin account...";
                    }
                    const profile = selectedItems[0] as ProfileMappingItem;
                    return `${profile.first_name} ${profile.last_name}`;
                  }}
                  renderItem={(item, _isSelected) => {
                    const profile = item as ProfileMappingItem;
                    return (
                      <div className="flex items-center gap-3 w-full">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {profile.first_name} {profile.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {profile.role}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                  placeholder="Select admin account..."
                  disabled={isSubmitting || readonly}
                  multiSelect={false}
                  hideSelectedChips={true}
                  buttonClassName="w-full"
                />
              </div>
            )}
          </div>

          {/* Auth Methods Table */}
          {settingsDetail &&
            settingsDetail.all_auth_ids &&
            settingsDetail.all_auth_ids.length > 0 && (
              <div className="space-y-2">
                <Label>Authentication Methods</Label>
                <AuthsTable
                  data={authTableData}
                  keyMapping={keyMapping}
                  validKeyIds={validKeyIds}
                  onKeyChange={onAuthKeyChange}
                  onValueChange={_onAuthValueChange || (() => {})}
                  onEnabledChange={handleAuthEnabledChange}
                  readonly={isSubmitting || readonly}
                />
              </div>
            )}
        </div>
      </div>

      {/* AI Providers Section */}
      {settingsDetail && providerTableData.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">AI Providers</h3>
          <Separator />
          <ProvidersTable
            data={providerTableData}
            keyMapping={keyMapping}
            validKeyIds={validKeyIds}
            onKeyChange={onProviderKeyChange}
            onEnabledChange={handleProviderEnabledChange}
            readonly={isSubmitting || readonly}
          />
        </div>
      )}

      {/* Theme Colors Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Theme Colors</h3>
        <Separator />
        <div className="space-y-6">
          {/* Core Brand Colors */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">
              Core Brand Colors
            </h4>
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
            <h4 className="text-sm font-medium text-muted-foreground">
              Layout Colors
            </h4>
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
            <h4 className="text-sm font-medium text-muted-foreground">
              Status Colors
            </h4>
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
            <h4 className="text-sm font-medium text-muted-foreground">
              Sidebar Colors
            </h4>
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
            <h4 className="text-sm font-medium text-muted-foreground">
              Chart Colors
            </h4>
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
        </div>
      </div>

      {/* Analytics Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Analytics Thresholds</h3>
        <Separator />
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
                onFormDataChange(
                  "success_threshold",
                  Math.min(100, Math.max(0, parseInt(e.target.value) || 85))
                )
              }
              disabled={isSubmitting || readonly}
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
                onFormDataChange(
                  "warning_threshold",
                  Math.min(100, Math.max(0, parseInt(e.target.value) || 80))
                )
              }
              disabled={isSubmitting || readonly}
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
                onFormDataChange(
                  "danger_threshold",
                  Math.min(100, Math.max(0, parseInt(e.target.value) || 70))
                )
              }
              disabled={isSubmitting || readonly}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
