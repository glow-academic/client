/**
 * Settings.tsx
 * Used to view and update application settings
 * Uses shared SettingsForm component
 */

"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettingsForm, type ProfileMappingItem } from "../common/settings/SettingsForm";

// Type-only import from server pages
import type {
  KeysListOut,
  SettingsDetailOut,
  UpdateSettingsIn,
  UpdateSettingsOut,
  StaffListOut,
} from "@/app/(main)/system/settings/page";

export interface SettingsProps {
  settingsList: SettingsDetailOut[];
  settingsDetail: SettingsDetailOut | null;
  selectedSettingsId: string | null;
  profileId: string;
  keysList: KeysListOut;
  staffList: StaffListOut;
  getSettingsDetailAction: (
    settingsId: string,
    profileId: string
  ) => Promise<SettingsDetailOut>;
  getKeysListAction: (profileId: string) => Promise<KeysListOut>;
  getStaffListAction?: (profileId: string) => Promise<StaffListOut>;
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
  staffList: initialStaffList,
  getSettingsDetailAction,
  getKeysListAction,
  getStaffListAction,
  updateSettingsAction,
}: SettingsProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSettingsId, setSelectedSettingsId] = useState<string | null>(
    initialSelectedSettingsId
  );
  const [settingsDetail, setSettingsDetail] =
    useState<SettingsDetailOut | null>(initialSettingsDetail);
  const [keysList, setKeysList] = useState<KeysListOut>(initialKeysList);
  const [staffList, setStaffList] = useState<StaffListOut>(initialStaffList);

  // Key mappings state
  const [providerKeyMapping, setProviderKeyMapping] = useState<
    Record<string, string>
  >({});
  const [authKeyMapping, setAuthKeyMapping] = useState<
    Record<string, Record<string, string>>
  >({});
  // Provider enabled state
  const [providerEnabled, setProviderEnabled] = useState<
    Record<string, boolean>
  >({});
  // Auth enabled state
  const [authEnabled, setAuthEnabled] = useState<
    Record<string, boolean>
  >({});
  // Auth value mapping (for non-encrypted items)
  const [authValueMapping, setAuthValueMapping] = useState<
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

  // Build profile mapping from staff list
  const profileMapping = useMemo(() => {
    const mapping: Record<string, ProfileMappingItem> = {};
    staffList.staff.forEach((staff) => {
      mapping[staff.profile_id] = {
        profile_id: staff.profile_id,
        name: staff.name,
        role: staff.role,
        first_name: staff.first_name,
        last_name: staff.last_name,
      };
    });
    return mapping;
  }, [staffList]);

  const validProfileIds = useMemo(() => {
    return staffList.staff.map((staff) => staff.profile_id);
  }, [staffList]);

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
    default_admin_profile_id: null as string | null,
    default_guest_profile_id: null as string | null,
  });

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
        default_admin_profile_id: settingsDetail.default_admin_profile_id ?? null,
        default_guest_profile_id: settingsDetail.default_guest_profile_id ?? null,
      });

      // Initialize key mappings from settings detail
      setProviderKeyMapping(settingsDetail.provider_key_mapping || {});
      setAuthKeyMapping(settingsDetail.auth_key_mapping || {});
      
      // Initialize provider enabled state
      const enabled: Record<string, boolean> = {};
      settingsDetail.all_provider_ids.forEach((providerId) => {
        enabled[providerId] = settingsDetail.provider_ids.includes(providerId);
      });
      setProviderEnabled(enabled);
      
      // Initialize auth enabled state
      const authEnabledState: Record<string, boolean> = {};
      settingsDetail.all_auth_ids?.forEach((authId) => {
        authEnabledState[authId] = settingsDetail.auth_ids?.includes(authId) ?? false;
      });
      setAuthEnabled(authEnabledState);
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
      // Refresh keys list and staff list
      const freshKeysList = await getKeysListAction(profileId);
      setKeysList(freshKeysList);
      if (getStaffListAction) {
        const freshStaffList = await getStaffListAction(profileId);
        setStaffList(freshStaffList);
      }
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
              : null,
          provider_enabled:
            Object.keys(providerEnabled).length > 0
              ? providerEnabled
              : null,
          auth_enabled:
            Object.keys(authEnabled).length > 0
              ? authEnabled
              : null,
          auth_value_mapping:
            Object.keys(authValueMapping).length > 0
              ? authValueMapping
              : null,
          auth_key_mapping:
            Object.keys(authKeyMapping).length > 0 ? authKeyMapping : null,
          default_admin_profile_id: formData.default_admin_profile_id || null,
          default_guest_profile_id: formData.default_guest_profile_id || null,
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
              if (!setting) return "Select settings version...";
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
            renderItem={(item) => {
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

        {/* Settings Form */}
        {settingsDetail && (
          <SettingsForm
            settingsDetail={settingsDetail}
            keysList={keysList}
            profileMapping={profileMapping}
            validProfileIds={validProfileIds}
            formData={formData}
            providerKeyMapping={providerKeyMapping}
            authKeyMapping={authKeyMapping}
            onFormDataChange={(field, value) => {
              setFormData((prev) => ({ ...prev, [field]: value }));
            }}
            onProviderKeyChange={(providerId, keyId) => {
              setProviderKeyMapping((prev) => ({
                ...prev,
                [providerId]: keyId ?? "",
              }));
            }}
            onProviderEnabledChange={(providerId, enabled) => {
              setProviderEnabled((prev) => ({
                ...prev,
                [providerId]: enabled,
              }));
            }}
            onAuthEnabledChange={(authId, enabled) => {
              setAuthEnabled((prev) => ({
                ...prev,
                [authId]: enabled,
              }));
            }}
            onAuthKeyChange={(authId, authItemId, keyId) => {
              setAuthKeyMapping((prev) => ({
                ...prev,
                [authId]: {
                  ...(prev[authId] || {}),
                  [authItemId]: keyId ?? "",
                },
              }));
            }}
            onAuthValueChange={(authId, authItemId, value) => {
              setAuthValueMapping((prev) => ({
                ...prev,
                [authId]: {
                  ...(prev[authId] || {}),
                  [authItemId]: value,
                },
              }));
            }}
            onDefaultAdminChange={(profileId) => {
              setFormData((prev) => ({
                ...prev,
                default_admin_profile_id: profileId,
              }));
            }}
            onDefaultGuestChange={(profileId) => {
              setFormData((prev) => ({
                ...prev,
                default_guest_profile_id: profileId,
              }));
            }}
            isSubmitting={isSubmitting}
          />
        )}

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
