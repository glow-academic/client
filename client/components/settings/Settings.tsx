/**
 * Settings.tsx
 * Used to view and update application settings
 * Inlined form component following DHH principles
 */

"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { AuthsTable } from "@/components/common/settings/AuthsTable";
import { ProvidersTable } from "@/components/common/settings/ProvidersTable";
import { Badge } from "@/components/ui/badge";
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
import { useProfile } from "@/contexts/profile-context";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";

// Type-only import from server pages
import type {
  DepartmentsListOut,
  KeysListOut,
  SettingsDetailOut,
  StaffListOut,
  UpdateSettingsIn,
  UpdateSettingsOut,
} from "@/app/(main)/settings/page";

export interface ProfileMappingItem {
  profile_id: string;
  name: string;
  role: string;
  first_name: string;
  last_name: string;
}

export interface SettingsProps {
  settingsList: SettingsDetailOut[];
  settingsDetail: SettingsDetailOut | null;
  selectedSettingsId: string | null;
  profileId: string;
  keysList: KeysListOut;
  staffList: StaffListOut;
  departmentsList: DepartmentsListOut;
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

export default function Settings({
  settingsList,
  settingsDetail: initialSettingsDetail,
  selectedSettingsId: initialSelectedSettingsId,
  profileId,
  keysList: initialKeysList,
  staffList: initialStaffList,
  departmentsList,
  getSettingsDetailAction,
  getKeysListAction,
  getStaffListAction,
  updateSettingsAction,
}: SettingsProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSettingsId, setSelectedSettingsId] = useState<string | null>(
    initialSelectedSettingsId
  );
  const [settingsDetail, setSettingsDetail] =
    useState<SettingsDetailOut | null>(initialSettingsDetail);
  const [keysList, setKeysList] = useState<KeysListOut>(initialKeysList);
  const [staffList, setStaffList] = useState<StaffListOut>(initialStaffList);

  // Department filter state (for filtering settings list)
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );
  const [selectedDepartmentIds, setSelectedDepartmentIds] =
    useState<string[]>(defaultDepartmentIds);

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
  const [authEnabled, setAuthEnabled] = useState<Record<string, boolean>>({});
  // Auth value mapping (for non-encrypted items)
  const [authValueMapping, setAuthValueMapping] = useState<
    Record<string, Record<string, string>>
  >({});
  // Department IDs state
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  // Color picker open states
  const [colorPickerOpenStates, setColorPickerOpenStates] = useState<
    Record<string, boolean>
  >({});

  // Filter settings list based on selected departments
  const filteredSettingsList = useMemo(() => {
    if (selectedDepartmentIds.length === 0) {
      // Show all settings (default + all department-specific)
      return settingsList;
    }
    // Show default settings + settings for selected departments
    return settingsList.filter((setting) => {
      // Default settings (no department links)
      if (!setting.department_ids || setting.department_ids.length === 0) {
        return true;
      }
      // Department-specific settings that match selected departments
      return setting.department_ids.some((deptId: string) =>
        selectedDepartmentIds.includes(deptId)
      );
    });
  }, [settingsList, selectedDepartmentIds]);

  // Build settings mapping for picker (using filtered list)
  const settingsMapping = useMemo(() => {
    const mapping: Record<string, SettingsDetailOut> = {};
    filteredSettingsList.forEach((setting) => {
      mapping[setting.settings_id] = setting;
    });
    return mapping;
  }, [filteredSettingsList]);

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

  // Build department mapping from departments list
  const departmentMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    departmentsList.departments.forEach((dept) => {
      mapping[dept.department_id] = {
        name: dept.title,
        description: dept.description || "",
      };
    });
    return mapping;
  }, [departmentsList]);

  const validDepartmentIds = useMemo(() => {
    return departmentsList.departments.map((dept) => dept.department_id);
  }, [departmentsList]);

  // Form data state with all ThemePrimitives and new settings
  const [formData, setFormData] = useState({
    name: "",
    description: "",
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
        name: settingsDetail.name || "",
        description: settingsDetail.description || "",
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
        default_admin_profile_id:
          settingsDetail.default_admin_profile_id ?? null,
        default_guest_profile_id:
          settingsDetail.default_guest_profile_id ?? null,
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
        authEnabledState[authId] =
          settingsDetail.auth_ids?.includes(authId) ?? false;
      });
      setAuthEnabled(authEnabledState);

      // Initialize department IDs
      setDepartmentIds(settingsDetail.department_ids || []);
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
  };

  // Handle auth enable/disable
  const handleAuthEnabledChange = (authId: string, enabled: boolean) => {
    setAuthEnabled((prev) => ({
      ...prev,
      [authId]: enabled,
    }));
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

  // Auto-select active settings for selected departments
  useEffect(() => {
    if (!filteredSettingsList.length || selectedSettingsId) return;

    // Find active settings for selected departments
    let activeSettings = null;

    if (selectedDepartmentIds.length === 0) {
      // All departments: find default settings
      activeSettings = filteredSettingsList.find(
        (s) => !s.department_ids || s.department_ids.length === 0
      );
    } else {
      // Specific departments: find matching settings
      activeSettings =
        filteredSettingsList.find((s) => {
          if (!s.department_ids || s.department_ids.length === 0) {
            return false; // Skip default, prefer department-specific
          }
          return s.department_ids.some((id: string) =>
            selectedDepartmentIds.includes(id)
          );
        }) ||
        filteredSettingsList.find(
          (s) => !s.department_ids || s.department_ids.length === 0
        ); // Fallback to default
    }

    if (activeSettings) {
      handleSelectSettings(activeSettings.settings_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSettingsList, selectedDepartmentIds, selectedSettingsId]);

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
          name: formData.name,
          description: formData.description,
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
            Object.keys(providerEnabled).length > 0 ? providerEnabled : null,
          auth_enabled:
            Object.keys(authEnabled).length > 0 ? authEnabled : null,
          auth_value_mapping:
            Object.keys(authValueMapping).length > 0 ? authValueMapping : null,
          auth_key_mapping:
            Object.keys(authKeyMapping).length > 0 ? authKeyMapping : null,
          default_admin_profile_id: formData.default_admin_profile_id || null,
          default_guest_profile_id: formData.default_guest_profile_id || null,
          department_ids: departmentIds.length > 0 ? departmentIds : null,
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
        {/* Department Picker - Filter for settings list */}
        {validDepartmentIds.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="department-filter">Department</Label>
            <GenericPicker
              items={departmentMapping}
              itemIds={validDepartmentIds}
              selectedIds={selectedDepartmentIds}
              onSelect={(ids) => setSelectedDepartmentIds(ids)}
              getId={(dept) => {
                const entry = Object.entries(departmentMapping).find(
                  ([, v]) => v === dept
                );
                return entry ? entry[0] : "";
              }}
              getLabel={(dept) => (dept as { name: string }).name || ""}
              getSearchText={(dept) =>
                `${(dept as { name: string }).name} ${(dept as { description?: string }).description || ""}`
              }
              placeholder="All Departments"
              disabled={isSubmitting}
              multiSelect={true}
              hideSelectedChips={true}
              buttonClassName="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Filter settings by department. Leave empty to see all settings.
            </p>
          </div>
        )}

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
              return item.name || `Settings (${new Date(item.created_at).toLocaleDateString()})`;
            }}
            getSearchText={(item) => {
              const date = new Date(item.created_at);
              return `${item.name || "Settings"} ${item.description || ""} ${date.toLocaleDateString()} ${item.active ? "Active" : "Inactive"}`;
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
                    {setting.name || `Settings (${date.toLocaleDateString()})`}
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
                        {item.name || `Settings (${date.toLocaleDateString()})`}
                      </div>
                    </div>
                    {item.description && (
                      <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                        {item.description}
                      </div>
                    )}
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
          <div className="space-y-8">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <Separator />
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Settings name"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Settings description"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

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
                      setFormData((prev) => ({
                        ...prev,
                        guest_login_enabled: checked,
                      }))
                    }
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                {/* Default Account Pickers */}
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {/* Default Guest Account */}
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
                      onSelect={(ids) =>
                        setFormData((prev) => ({
                          ...prev,
                          default_guest_profile_id: ids[0] || null,
                        }))
                      }
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
                      disabled={isSubmitting}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                  </div>

                  {/* Default Admin Account */}
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
                      onSelect={(ids) =>
                        setFormData((prev) => ({
                          ...prev,
                          default_admin_profile_id: ids[0] || null,
                        }))
                      }
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
                      disabled={isSubmitting}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                  </div>
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
                        onKeyChange={(authId, authItemId, keyId) => {
                          setAuthKeyMapping((prev) => ({
                            ...prev,
                            [authId]: {
                              ...(prev[authId] || {}),
                              [authItemId]: keyId ?? "",
                            },
                          }));
                        }}
                        onValueChange={(authId, authItemId, value) => {
                          setAuthValueMapping((prev) => ({
                            ...prev,
                            [authId]: {
                              ...(prev[authId] || {}),
                              [authItemId]: value,
                            },
                          }));
                        }}
                        onEnabledChange={handleAuthEnabledChange}
                        readonly={isSubmitting}
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
                  onKeyChange={(providerId, keyId) => {
                    setProviderKeyMapping((prev) => ({
                      ...prev,
                      [providerId]: keyId ?? "",
                    }));
                  }}
                  onEnabledChange={handleProviderEnabledChange}
                  readonly={isSubmitting}
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
                      setFormData((prev) => ({
                        ...prev,
                        success_threshold: Math.min(
                          100,
                          Math.max(0, parseInt(e.target.value) || 85)
                        ),
                      }))
                    }
                    disabled={isSubmitting}
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
                  />
                </div>
              </div>
            </div>
          </div>
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
