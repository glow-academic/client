/**
 * Settings.tsx
 * Used to view and update application settings
 * Section-based layout following Scenario.tsx pattern
 */

"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { SettingsAIProviderConfigSection } from "@/components/settings/SettingsAIProviderConfigSection";
import { SettingsAIProvidersSection } from "@/components/settings/SettingsAIProvidersSection";
import { SettingsAuthMethodConfigSection } from "@/components/settings/SettingsAuthMethodConfigSection";
import { SettingsAuthMethodsSection } from "@/components/settings/SettingsAuthMethodsSection";
import { SettingsBasicInfoSection } from "@/components/settings/SettingsBasicInfoSection";
import { BrandColorCard } from "@/components/settings/SettingsBrandColorsSection";
import { ChartColorCard } from "@/components/settings/SettingsChartColorsSection";
import { SettingsDefaultAccountSection } from "@/components/settings/SettingsDefaultAccountSection";
import { LayoutColorCard } from "@/components/settings/SettingsLayoutColorsSection";
import { SidebarColorCard } from "@/components/settings/SettingsSidebarColorsSection";
import { StatusColorCard } from "@/components/settings/SettingsStatusColorsSection";
import { SettingsThemePresetPicker } from "@/components/settings/SettingsThemePresetPicker";
import { ThemePreview } from "@/components/settings/ThemePreview";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
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

type StepStatus = "pending" | "active" | "completed";

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

  // Refs for smooth scrolling to color cards
  const primaryColorRef = useRef<HTMLDivElement>(null);
  const accentRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const warningRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const sidebarBackgroundRef = useRef<HTMLDivElement>(null);
  const sidebarPrimaryRef = useRef<HTMLDivElement>(null);
  const chart1Ref = useRef<HTMLDivElement>(null);
  const chart2Ref = useRef<HTMLDivElement>(null);
  const chart3Ref = useRef<HTMLDivElement>(null);
  const chart4Ref = useRef<HTMLDivElement>(null);
  const chart5Ref = useRef<HTMLDivElement>(null);

  // Accordion state
  const [openAccordionItem, setOpenAccordionItem] = useState<string | null>(
    null
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingSection, setSubmittingSection] = useState<string | null>(
    null
  );
  const [selectedSettingsId, setSelectedSettingsId] = useState<string | null>(
    initialSelectedSettingsId
  );
  const [settingsDetail, setSettingsDetail] =
    useState<SettingsDetailOut | null>(initialSettingsDetail);
  const [keysList, setKeysList] = useState<KeysListOut>(initialKeysList);
  const [staffList, setStaffList] = useState<StaffListOut>(initialStaffList);

  // Original settings state for change tracking
  const [originalSelectedSettingsId, setOriginalSelectedSettingsId] = useState<
    string | null
  >(initialSelectedSettingsId);
  const [originalFormData, setOriginalFormData] = useState<
    typeof formData | null
  >(null);
  const [originalProviderKeyMapping, setOriginalProviderKeyMapping] = useState<
    Record<string, string>
  >({});
  const [originalAuthKeyMapping, setOriginalAuthKeyMapping] = useState<
    Record<string, Record<string, string>>
  >({});
  const [originalProviderEnabled, setOriginalProviderEnabled] = useState<
    Record<string, boolean>
  >({});
  const [originalAuthEnabled, setOriginalAuthEnabled] = useState<
    Record<string, boolean>
  >({});
  const [originalAuthValueMapping, setOriginalAuthValueMapping] = useState<
    Record<string, Record<string, string>>
  >({});
  const [originalDepartmentIds, setOriginalDepartmentIds] = useState<string[]>(
    []
  );

  // Track which auth methods and providers are selected/expanded
  const [selectedAuthMethodIds, setSelectedAuthMethodIds] = useState<
    Set<string>
  >(new Set());
  const [selectedProviderIds, setSelectedProviderIds] = useState<Set<string>>(
    new Set()
  );

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

  // Filter settings list based on selected departments
  const filteredSettingsList = useMemo(() => {
    if (selectedDepartmentIds.length === 0) {
      return settingsList;
    }
    return settingsList.filter((setting) => {
      if (!setting.department_ids || setting.department_ids.length === 0) {
        return true;
      }
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

  // Form data state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    active: true,
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
      const newFormData = {
        name: settingsDetail.name || "",
        description: settingsDetail.description || "",
        active: settingsDetail.active ?? true,
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
      };
      setFormData(newFormData);
      // Store original form data for change tracking (only if not already set, or if this is initial load)
      if (
        !originalFormData ||
        originalSelectedSettingsId === selectedSettingsId
      ) {
        setOriginalFormData(newFormData);
      }
      // Always sync originalSelectedSettingsId with selectedSettingsId when settingsDetail changes
      // This prevents false positives in change detection and ensures they stay in sync
      setOriginalSelectedSettingsId(selectedSettingsId);

      // Initialize key mappings from settings detail
      const providerKeyMap = settingsDetail.provider_key_mapping || {};
      const authKeyMap = settingsDetail.auth_key_mapping || {};
      setProviderKeyMapping(providerKeyMap);
      setAuthKeyMapping(authKeyMap);
      // Store original mappings
      setOriginalProviderKeyMapping(JSON.parse(JSON.stringify(providerKeyMap)));
      setOriginalAuthKeyMapping(JSON.parse(JSON.stringify(authKeyMap)));

      // Initialize provider enabled state
      const enabled: Record<string, boolean> = {};
      settingsDetail.all_provider_ids.forEach((providerId) => {
        enabled[providerId] = settingsDetail.provider_ids.includes(providerId);
      });
      setProviderEnabled(enabled);
      // Store original provider enabled state
      setOriginalProviderEnabled(JSON.parse(JSON.stringify(enabled)));

      // Initialize auth enabled state
      const authEnabledState: Record<string, boolean> = {};
      settingsDetail.all_auth_ids?.forEach((authId) => {
        authEnabledState[authId] =
          settingsDetail.auth_ids?.includes(authId) ?? false;
      });
      setAuthEnabled(authEnabledState);
      // Store original auth enabled state
      setOriginalAuthEnabled(JSON.parse(JSON.stringify(authEnabledState)));

      // Initialize auth value mapping
      const authValueMap = settingsDetail.auth_value_mapping || {};
      setAuthValueMapping(authValueMap);
      // Store original auth value mapping
      setOriginalAuthValueMapping(JSON.parse(JSON.stringify(authValueMap)));

      // Initialize department IDs
      const deptIds = settingsDetail.department_ids || [];
      setDepartmentIds(deptIds);
      // Store original department IDs
      setOriginalDepartmentIds([...deptIds]);

      // Auto-select enabled auth methods and providers
      const enabledAuthIds = new Set(
        settingsDetail.all_auth_ids?.filter(
          (authId) => authEnabledState[authId]
        ) || []
      );
      setSelectedAuthMethodIds(enabledAuthIds);

      const enabledProviderIds = new Set(
        settingsDetail.all_provider_ids.filter(
          (providerId) => enabled[providerId]
        )
      );
      setSelectedProviderIds(enabledProviderIds);
    }
  }, [settingsDetail]);

  // Sync originalSelectedSettingsId when selectedSettingsId changes from null to a value
  // This handles the case where auto-select sets selectedSettingsId after settingsDetail loads
  useEffect(() => {
    if (
      selectedSettingsId !== null &&
      originalFormData !== null &&
      originalSelectedSettingsId === null
    ) {
      setOriginalSelectedSettingsId(selectedSettingsId);
    }
  }, [selectedSettingsId, originalFormData, originalSelectedSettingsId]);

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

  // Build auth methods list for searchable section
  const authMethodsList = useMemo(() => {
    if (!settingsDetail || !settingsDetail.all_auth_ids) return [];
    return settingsDetail.all_auth_ids.map((authId) => {
      const auth =
        settingsDetail.all_auth_mapping?.[authId] ||
        settingsDetail.auth_mapping?.[authId];
      const enabled = authEnabled[authId] ?? false;
      const authName = typeof auth?.["name"] === "string" ? auth["name"] : "";
      const authDesc =
        typeof auth?.["description"] === "string" ? auth["description"] : "";
      const authSlug = typeof auth?.["slug"] === "string" ? auth["slug"] : null;
      return {
        auth_id: authId,
        auth_name: authName,
        auth_description: authDesc,
        auth_slug: authSlug,
        enabled,
      };
    });
  }, [settingsDetail, authEnabled]);

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

      const authItems = settingsDetail.auth_items_mapping?.[authId] || [];

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

  // Build provider table data
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
    // Auto-select provider when enabled
    if (enabled) {
      setSelectedProviderIds((prev) => new Set(prev).add(providerId));
    }
  };

  // Handle auth enable/disable
  const handleAuthEnabledChange = (authId: string, enabled: boolean) => {
    setAuthEnabled((prev) => ({
      ...prev,
      [authId]: enabled,
    }));
    // Auto-select auth method when enabled
    if (enabled) {
      setSelectedAuthMethodIds((prev) => new Set(prev).add(authId));
    }
  };

  // Handle auth method click - enable and expand config section
  const handleAuthMethodClick = (authId: string) => {
    // Enable the auth method
    setAuthEnabled((prev) => ({
      ...prev,
      [authId]: true,
    }));
    // Add to selected to expand config section
    setSelectedAuthMethodIds((prev) => new Set(prev).add(authId));
  };

  // Handle provider click - enable and expand config section
  const handleProviderClick = (providerId: string) => {
    // Enable the provider
    setProviderEnabled((prev) => ({
      ...prev,
      [providerId]: true,
    }));
    // Add to selected to expand config section
    setSelectedProviderIds((prev) => new Set(prev).add(providerId));
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

    let activeSettings = null;

    if (selectedDepartmentIds.length === 0) {
      activeSettings = filteredSettingsList.find(
        (s) => !s.department_ids || s.department_ids.length === 0
      );
    } else {
      activeSettings =
        filteredSettingsList.find((s) => {
          if (!s.department_ids || s.department_ids.length === 0) {
            return false;
          }
          return s.department_ids.some((id: string) =>
            selectedDepartmentIds.includes(id)
          );
        }) ||
        filteredSettingsList.find(
          (s) => !s.department_ids || s.department_ids.length === 0
        );
    }

    if (activeSettings) {
      handleSelectSettings(activeSettings.settings_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSettingsList, selectedDepartmentIds, selectedSettingsId]);

  // Change detection helpers
  const hasGeneralChanges = useMemo(() => {
    if (!originalFormData) return false;
    const deptIdsSorted = [...departmentIds].sort();
    const originalDeptIdsSorted = [...originalDepartmentIds].sort();
    const deptIdsMatch =
      JSON.stringify(deptIdsSorted) === JSON.stringify(originalDeptIdsSorted);
    return (
      selectedSettingsId !== originalSelectedSettingsId ||
      formData.name !== originalFormData.name ||
      formData.description !== originalFormData.description ||
      formData.active !== originalFormData.active ||
      formData.guest_login_enabled !== originalFormData.guest_login_enabled ||
      formData.default_admin_profile_id !==
        originalFormData.default_admin_profile_id ||
      formData.default_guest_profile_id !==
        originalFormData.default_guest_profile_id ||
      !deptIdsMatch
    );
  }, [
    selectedSettingsId,
    originalSelectedSettingsId,
    formData,
    originalFormData,
    departmentIds,
    originalDepartmentIds,
  ]);

  const hasAuthChanges = useMemo(() => {
    if (!originalFormData) return false;
    return (
      JSON.stringify(authEnabled) !== JSON.stringify(originalAuthEnabled) ||
      JSON.stringify(authKeyMapping) !==
        JSON.stringify(originalAuthKeyMapping) ||
      JSON.stringify(authValueMapping) !==
        JSON.stringify(originalAuthValueMapping)
    );
  }, [
    authEnabled,
    originalAuthEnabled,
    authKeyMapping,
    originalAuthKeyMapping,
    authValueMapping,
    originalAuthValueMapping,
  ]);

  const hasProviderChanges = useMemo(() => {
    if (!originalFormData) return false;
    return (
      JSON.stringify(providerEnabled) !==
        JSON.stringify(originalProviderEnabled) ||
      JSON.stringify(providerKeyMapping) !==
        JSON.stringify(originalProviderKeyMapping)
    );
  }, [
    providerEnabled,
    originalProviderEnabled,
    providerKeyMapping,
    originalProviderKeyMapping,
  ]);

  const hasThemeChanges = useMemo(() => {
    if (!originalFormData) return false;
    return (
      formData.primary_color !== originalFormData.primary_color ||
      formData.accent !== originalFormData.accent ||
      formData.background !== originalFormData.background ||
      formData.surface !== originalFormData.surface ||
      formData.success !== originalFormData.success ||
      formData.warning !== originalFormData.warning ||
      formData.error !== originalFormData.error ||
      formData.sidebar_background !== originalFormData.sidebar_background ||
      formData.sidebar_primary !== originalFormData.sidebar_primary ||
      formData.chart1 !== originalFormData.chart1 ||
      formData.chart2 !== originalFormData.chart2 ||
      formData.chart3 !== originalFormData.chart3 ||
      formData.chart4 !== originalFormData.chart4 ||
      formData.chart5 !== originalFormData.chart5 ||
      formData.success_threshold !== originalFormData.success_threshold ||
      formData.warning_threshold !== originalFormData.warning_threshold ||
      formData.danger_threshold !== originalFormData.danger_threshold
    );
  }, [formData, originalFormData]);

  // Per-section update handlers
  const handleUpdateGeneral = async () => {
    if (!updateSettingsAction || !originalFormData) {
      toast.error("Update action not available");
      return;
    }

    setSubmittingSection("general");
    setIsSubmitting(true);

    try {
      const result = await updateSettingsAction({
        body: {
          name: formData.name,
          description: formData.description,
          primary_color: originalFormData.primary_color,
          accent: originalFormData.accent,
          background: originalFormData.background,
          surface: originalFormData.surface,
          success: originalFormData.success,
          warning: originalFormData.warning,
          error: originalFormData.error,
          sidebar_background: originalFormData.sidebar_background,
          sidebar_primary: originalFormData.sidebar_primary,
          chart1: originalFormData.chart1,
          chart2: originalFormData.chart2,
          chart3: originalFormData.chart3,
          chart4: originalFormData.chart4,
          chart5: originalFormData.chart5,
          guest_login_enabled: formData.guest_login_enabled,
          success_threshold: originalFormData.success_threshold,
          warning_threshold: originalFormData.warning_threshold,
          danger_threshold: originalFormData.danger_threshold,
          profileId,
          provider_key_mapping:
            Object.keys(originalProviderKeyMapping).length > 0
              ? originalProviderKeyMapping
              : null,
          provider_enabled:
            Object.keys(originalProviderEnabled).length > 0
              ? originalProviderEnabled
              : null,
          auth_enabled:
            Object.keys(originalAuthEnabled).length > 0
              ? originalAuthEnabled
              : null,
          auth_value_mapping:
            Object.keys(originalAuthValueMapping).length > 0
              ? originalAuthValueMapping
              : null,
          auth_key_mapping:
            Object.keys(originalAuthKeyMapping).length > 0
              ? originalAuthKeyMapping
              : null,
          default_admin_profile_id: formData.default_admin_profile_id || null,
          default_guest_profile_id: formData.default_guest_profile_id || null,
          department_ids: departmentIds.length > 0 ? departmentIds : null,
        },
      });

      if (result.success) {
        toast.success("General settings updated successfully");
        // Update original state
        setOriginalFormData({
          ...formData,
          active: formData.active,
        });
        setOriginalDepartmentIds([...departmentIds]);
        setOriginalSelectedSettingsId(selectedSettingsId);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update general settings");
      }
    } catch (error) {
      toast.error(
        `Failed to update general settings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
      setSubmittingSection(null);
    }
  };

  const handleUpdateAuth = async () => {
    if (!updateSettingsAction || !originalFormData) {
      toast.error("Update action not available");
      return;
    }

    setSubmittingSection("auth");
    setIsSubmitting(true);

    try {
      const result = await updateSettingsAction({
        body: {
          name: originalFormData.name,
          description: originalFormData.description,
          primary_color: originalFormData.primary_color,
          accent: originalFormData.accent,
          background: originalFormData.background,
          surface: originalFormData.surface,
          success: originalFormData.success,
          warning: originalFormData.warning,
          error: originalFormData.error,
          sidebar_background: originalFormData.sidebar_background,
          sidebar_primary: originalFormData.sidebar_primary,
          chart1: originalFormData.chart1,
          chart2: originalFormData.chart2,
          chart3: originalFormData.chart3,
          chart4: originalFormData.chart4,
          chart5: originalFormData.chart5,
          guest_login_enabled: originalFormData.guest_login_enabled,
          success_threshold: originalFormData.success_threshold,
          warning_threshold: originalFormData.warning_threshold,
          danger_threshold: originalFormData.danger_threshold,
          profileId,
          provider_key_mapping:
            Object.keys(originalProviderKeyMapping).length > 0
              ? originalProviderKeyMapping
              : null,
          provider_enabled:
            Object.keys(originalProviderEnabled).length > 0
              ? originalProviderEnabled
              : null,
          auth_enabled:
            Object.keys(authEnabled).length > 0 ? authEnabled : null,
          auth_value_mapping:
            Object.keys(authValueMapping).length > 0 ? authValueMapping : null,
          auth_key_mapping:
            Object.keys(authKeyMapping).length > 0 ? authKeyMapping : null,
          default_admin_profile_id:
            originalFormData.default_admin_profile_id || null,
          default_guest_profile_id:
            originalFormData.default_guest_profile_id || null,
          department_ids:
            originalDepartmentIds.length > 0 ? originalDepartmentIds : null,
        },
      });

      if (result.success) {
        toast.success("Auth settings updated successfully");
        // Update original state
        setOriginalAuthEnabled(JSON.parse(JSON.stringify(authEnabled)));
        setOriginalAuthKeyMapping(JSON.parse(JSON.stringify(authKeyMapping)));
        setOriginalAuthValueMapping(
          JSON.parse(JSON.stringify(authValueMapping))
        );
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update auth settings");
      }
    } catch (error) {
      toast.error(
        `Failed to update auth settings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
      setSubmittingSection(null);
    }
  };

  const handleUpdateProviders = async () => {
    if (!updateSettingsAction || !originalFormData) {
      toast.error("Update action not available");
      return;
    }

    setSubmittingSection("providers");
    setIsSubmitting(true);

    try {
      const result = await updateSettingsAction({
        body: {
          name: originalFormData.name,
          description: originalFormData.description,
          primary_color: originalFormData.primary_color,
          accent: originalFormData.accent,
          background: originalFormData.background,
          surface: originalFormData.surface,
          success: originalFormData.success,
          warning: originalFormData.warning,
          error: originalFormData.error,
          sidebar_background: originalFormData.sidebar_background,
          sidebar_primary: originalFormData.sidebar_primary,
          chart1: originalFormData.chart1,
          chart2: originalFormData.chart2,
          chart3: originalFormData.chart3,
          chart4: originalFormData.chart4,
          chart5: originalFormData.chart5,
          guest_login_enabled: originalFormData.guest_login_enabled,
          success_threshold: originalFormData.success_threshold,
          warning_threshold: originalFormData.warning_threshold,
          danger_threshold: originalFormData.danger_threshold,
          profileId,
          provider_key_mapping:
            Object.keys(providerKeyMapping).length > 0
              ? providerKeyMapping
              : null,
          provider_enabled:
            Object.keys(providerEnabled).length > 0 ? providerEnabled : null,
          auth_enabled:
            Object.keys(originalAuthEnabled).length > 0
              ? originalAuthEnabled
              : null,
          auth_value_mapping:
            Object.keys(originalAuthValueMapping).length > 0
              ? originalAuthValueMapping
              : null,
          auth_key_mapping:
            Object.keys(originalAuthKeyMapping).length > 0
              ? originalAuthKeyMapping
              : null,
          default_admin_profile_id:
            originalFormData.default_admin_profile_id || null,
          default_guest_profile_id:
            originalFormData.default_guest_profile_id || null,
          department_ids:
            originalDepartmentIds.length > 0 ? originalDepartmentIds : null,
        },
      });

      if (result.success) {
        toast.success("Provider settings updated successfully");
        // Update original state
        setOriginalProviderEnabled(JSON.parse(JSON.stringify(providerEnabled)));
        setOriginalProviderKeyMapping(
          JSON.parse(JSON.stringify(providerKeyMapping))
        );
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update provider settings");
      }
    } catch (error) {
      toast.error(
        `Failed to update provider settings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
      setSubmittingSection(null);
    }
  };

  const handleUpdateTheme = async () => {
    if (!updateSettingsAction || !originalFormData) {
      toast.error("Update action not available");
      return;
    }

    setSubmittingSection("theme");
    setIsSubmitting(true);

    try {
      const result = await updateSettingsAction({
        body: {
          name: originalFormData.name,
          description: originalFormData.description,
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
          guest_login_enabled: originalFormData.guest_login_enabled,
          success_threshold: formData.success_threshold,
          warning_threshold: formData.warning_threshold,
          danger_threshold: formData.danger_threshold,
          profileId,
          provider_key_mapping:
            Object.keys(originalProviderKeyMapping).length > 0
              ? originalProviderKeyMapping
              : null,
          provider_enabled:
            Object.keys(originalProviderEnabled).length > 0
              ? originalProviderEnabled
              : null,
          auth_enabled:
            Object.keys(originalAuthEnabled).length > 0
              ? originalAuthEnabled
              : null,
          auth_value_mapping:
            Object.keys(originalAuthValueMapping).length > 0
              ? originalAuthValueMapping
              : null,
          auth_key_mapping:
            Object.keys(originalAuthKeyMapping).length > 0
              ? originalAuthKeyMapping
              : null,
          default_admin_profile_id:
            originalFormData.default_admin_profile_id || null,
          default_guest_profile_id:
            originalFormData.default_guest_profile_id || null,
          department_ids:
            originalDepartmentIds.length > 0 ? originalDepartmentIds : null,
        },
      });

      if (result.success) {
        toast.success("Theme settings updated successfully");
        // Update original state
        setOriginalFormData({
          ...originalFormData,
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
          success_threshold: formData.success_threshold,
          warning_threshold: formData.warning_threshold,
          danger_threshold: formData.danger_threshold,
        });
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update theme settings");
      }
    } catch (error) {
      toast.error(
        `Failed to update theme settings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
      setSubmittingSection(null);
    }
  };

  // Handle preset theme selection
  const handlePresetThemeSelect = (theme: {
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
  }) => {
    setFormData((prev) => ({
      ...prev,
      primary_color: theme.primary_color,
      accent: theme.accent,
      background: theme.background,
      surface: theme.surface,
      success: theme.success,
      warning: theme.warning,
      error: theme.error,
      sidebar_background: theme.sidebar_background,
      sidebar_primary: theme.sidebar_primary,
      chart1: theme.chart1,
      chart2: theme.chart2,
      chart3: theme.chart3,
      chart4: theme.chart4,
      chart5: theme.chart5,
    }));
  };

  // Handle reset all colors
  const handleResetAllColors = () => {
    if (!originalFormData) return;
    setFormData((prev) => ({
      ...prev,
      primary_color: originalFormData.primary_color,
      accent: originalFormData.accent,
      background: originalFormData.background,
      surface: originalFormData.surface,
      success: originalFormData.success,
      warning: originalFormData.warning,
      error: originalFormData.error,
      sidebar_background: originalFormData.sidebar_background,
      sidebar_primary: originalFormData.sidebar_primary,
      chart1: originalFormData.chart1,
      chart2: originalFormData.chart2,
      chart3: originalFormData.chart3,
      chart4: originalFormData.chart4,
      chart5: originalFormData.chart5,
      success_threshold: originalFormData.success_threshold,
      warning_threshold: originalFormData.warning_threshold,
      danger_threshold: originalFormData.danger_threshold,
    }));
  };

  // Handle reset individual color
  const handleResetColor = (fieldName: string) => {
    if (!originalFormData) return;
    setFormData((prev) => ({
      ...prev,
      [fieldName]: originalFormData[fieldName as keyof typeof originalFormData],
    }));
  };

  // Typed wrapper functions for reset color
  const handleResetBrandColor = (fieldName: "primary_color" | "accent") => {
    handleResetColor(fieldName);
  };

  const handleResetLayoutColor = (fieldName: "background" | "surface") => {
    handleResetColor(fieldName);
  };

  const handleResetStatusColor = (
    fieldName:
      | "success"
      | "warning"
      | "error"
      | "success_threshold"
      | "warning_threshold"
      | "danger_threshold"
  ) => {
    handleResetColor(fieldName);
  };

  const handleResetSidebarColor = (
    fieldName: "sidebar_background" | "sidebar_primary"
  ) => {
    handleResetColor(fieldName);
  };

  const handleResetChartColor = (
    fieldName: "chart1" | "chart2" | "chart3" | "chart4" | "chart5"
  ) => {
    handleResetColor(fieldName);
  };

  // Calculate step status
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      switch (stepId) {
        case "basic":
          return "completed";
        case "default-guest":
          return formData.guest_login_enabled
            ? formData.default_guest_profile_id
              ? "completed"
              : "active"
            : "pending";
        case "default-admin":
          return formData.guest_login_enabled
            ? formData.default_admin_profile_id
              ? "completed"
              : "active"
            : "pending";
        case "auth-methods":
          return authMethodsList.length > 0 ? "active" : "pending";
        case "providers":
          return providerTableData.length > 0 ? "active" : "pending";
        case "theme":
          return "active";
        case "primary-color":
          return formData.primary_color ? "completed" : "active";
        case "accent":
          return formData.accent ? "completed" : "active";
        case "background":
          return formData.background ? "completed" : "active";
        case "surface":
          return formData.surface ? "completed" : "active";
        case "success":
          return formData.success ? "completed" : "active";
        case "warning":
          return formData.warning ? "completed" : "active";
        case "error":
          return formData.error ? "completed" : "active";
        case "sidebar-background":
          return formData.sidebar_background ? "completed" : "active";
        case "sidebar-primary":
          return formData.sidebar_primary ? "completed" : "active";
        case "chart1":
          return formData.chart1 ? "completed" : "active";
        case "chart2":
          return formData.chart2 ? "completed" : "active";
        case "chart3":
          return formData.chart3 ? "completed" : "active";
        case "chart4":
          return formData.chart4 ? "completed" : "active";
        case "chart5":
          return formData.chart5 ? "completed" : "active";
        default:
          // Handle individual auth method steps (auth-{authId})
          if (stepId.startsWith("auth-")) {
            const authId = stepId.replace("auth-", "");
            const enabled = authEnabled[authId] ?? false;
            if (!enabled) return "pending";
            // Check if configured (has items and at least one has key/value)
            const authData = authTableData.filter(
              (item) => item.auth_id === authId
            );
            const hasConfig = authData.some(
              (item) => item.selected_key_id || item.value
            );
            return hasConfig ? "completed" : "active";
          }
          // Handle individual provider steps (provider-{providerId})
          if (stepId.startsWith("provider-")) {
            const providerId = stepId.replace("provider-", "");
            const enabled = providerEnabled[providerId] ?? false;
            if (!enabled) return "pending";
            const provider = providerTableData.find(
              (p) => p.provider_id === providerId
            );
            return provider?.selected_key_id ? "completed" : "active";
          }
          return "pending";
      }
    },
    [
      formData.guest_login_enabled,
      formData.default_guest_profile_id,
      formData.default_admin_profile_id,
      authMethodsList.length,
      providerTableData.length,
      authEnabled,
      authTableData,
      providerEnabled,
      providerTableData,
      formData.primary_color,
      formData.accent,
      formData.background,
      formData.surface,
      formData.success,
      formData.warning,
      formData.error,
      formData.sidebar_background,
      formData.sidebar_primary,
      formData.chart1,
      formData.chart2,
      formData.chart3,
      formData.chart4,
      formData.chart5,
    ]
  );

  // IntersectionObserver to auto-open accordion when scrolling to color cards
  useEffect(() => {
    const refToAccordionMap = new Map<HTMLElement, string>([
      [primaryColorRef.current!, "primary-color"],
      [accentRef.current!, "accent"],
      [backgroundRef.current!, "background"],
      [surfaceRef.current!, "surface"],
      [successRef.current!, "success"],
      [warningRef.current!, "warning"],
      [errorRef.current!, "error"],
      [sidebarBackgroundRef.current!, "sidebar-background"],
      [sidebarPrimaryRef.current!, "sidebar-primary"],
      [chart1Ref.current!, "chart1"],
      [chart2Ref.current!, "chart2"],
      [chart3Ref.current!, "chart3"],
      [chart4Ref.current!, "chart4"],
      [chart5Ref.current!, "chart5"],
    ]);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
            const accordionValue = refToAccordionMap.get(
              entry.target as HTMLElement
            );
            if (accordionValue) {
              setOpenAccordionItem(accordionValue);
            }
          }
        });
      },
      { threshold: 0.3 }
    );

    // Observe all color card refs
    const refs = [
      primaryColorRef.current,
      accentRef.current,
      backgroundRef.current,
      surfaceRef.current,
      successRef.current,
      warningRef.current,
      errorRef.current,
      sidebarBackgroundRef.current,
      sidebarPrimaryRef.current,
      chart1Ref.current,
      chart2Ref.current,
      chart3Ref.current,
      chart4Ref.current,
      chart5Ref.current,
    ];

    refs.forEach((ref) => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => {
      refs.forEach((ref) => {
        if (ref) {
          observer.unobserve(ref);
        }
      });
    };
  }, []);

  // Arrow navigation handlers
  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  // Default Guest Account Section Component
  const DefaultGuestAccountSection = () => {
    if (!formData.guest_login_enabled) return null;
    const stepStatus = getStepStatus("default-guest");
    return (
      <SettingsDefaultAccountSection
        profileMapping={profileMapping}
        validProfileIds={guestProfiles}
        selectedProfileId={formData.default_guest_profile_id}
        onProfileIdChange={(profileId) =>
          setFormData((prev) => ({
            ...prev,
            default_guest_profile_id: profileId,
          }))
        }
        stepStatus={stepStatus}
        stepTitle="Default Guest Account"
        stepDescription="Select the default guest account for guest login"
        stepNumber={2}
        isReadonly={isSubmitting || submittingSection === "general"}
      />
    );
  };

  // Default Admin Account Section Component
  const DefaultAdminAccountSection = () => {
    if (!formData.guest_login_enabled) return null;
    const stepStatus = getStepStatus("default-admin");
    return (
      <SettingsDefaultAccountSection
        profileMapping={profileMapping}
        validProfileIds={adminProfiles}
        selectedProfileId={formData.default_admin_profile_id}
        onProfileIdChange={(profileId) =>
          setFormData((prev) => ({
            ...prev,
            default_admin_profile_id: profileId,
          }))
        }
        stepStatus={stepStatus}
        stepTitle="Default Admin Account"
        stepDescription="Select the default admin account for admin login"
        stepNumber={3}
        isReadonly={isSubmitting || submittingSection === "general"}
      />
    );
  };

  return (
    <div className="space-y-6">
      <form id="settings-form" className="space-y-6">
        {/* Settings Form */}
        {settingsDetail && (
          <div className="space-y-6">
            {/* Tabs Container */}
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">
                  General
                  {hasGeneralChanges && (
                    <span className="ml-2 text-destructive">(unsaved)</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="auth">
                  Auth
                  {hasAuthChanges && (
                    <span className="ml-2 text-destructive">(unsaved)</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="providers">
                  Providers
                  {hasProviderChanges && (
                    <span className="ml-2 text-destructive">(unsaved)</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="theme">
                  Theme
                  {hasThemeChanges && (
                    <span className="ml-2 text-destructive">(unsaved)</span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6 mt-6">
                {/* Step 1: Basic Information */}
                <SettingsBasicInfoSection
                  name={formData.name}
                  description={formData.description}
                  departmentIds={departmentIds}
                  validDepartmentIds={validDepartmentIds}
                  departmentMapping={departmentMapping}
                  active={formData.active}
                  guestLoginEnabled={formData.guest_login_enabled}
                  settingsList={filteredSettingsList}
                  selectedSettingsId={selectedSettingsId}
                  settingsMapping={settingsMapping}
                  onNameChange={(name) =>
                    setFormData((prev) => ({ ...prev, name }))
                  }
                  onDescriptionChange={(description) =>
                    setFormData((prev) => ({ ...prev, description }))
                  }
                  onDepartmentIdsChange={setDepartmentIds}
                  onActiveChange={(active) =>
                    setFormData((prev) => ({ ...prev, active }))
                  }
                  onGuestLoginEnabledChange={(enabled) =>
                    setFormData((prev) => ({
                      ...prev,
                      guest_login_enabled: enabled,
                    }))
                  }
                  onSettingsVersionSelect={handleSelectSettings}
                  isReadonly={isSubmitting || submittingSection === "general"}
                />

                {/* Step 2: Default Guest Account */}
                <DefaultGuestAccountSection />

                {/* Step 3: Default Admin Account */}
                <DefaultAdminAccountSection />

                {/* Update Button */}
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    onClick={handleUpdateGeneral}
                    data-testid="btn-update-general-settings"
                    disabled={isSubmitting || !hasGeneralChanges}
                    className="min-w-[160px]"
                  >
                    {submittingSection === "general" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Updating...
                      </>
                    ) : (
                      "Update General Settings"
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="auth" className="space-y-6 mt-6">
                {/* Step 1: Auth Methods List */}
                {authMethodsList.length > 0 && (
                  <SettingsAuthMethodsSection
                    authMethods={authMethodsList}
                    onAuthMethodClick={handleAuthMethodClick}
                    stepStatus={getStepStatus("auth-methods")}
                    stepTitle="Authentication Methods"
                    stepDescription="Select and configure authentication methods"
                    stepNumber={1}
                    isReadonly={isSubmitting || submittingSection === "auth"}
                  />
                )}

                {/* Individual Auth Method Configurations */}
                {Array.from(selectedAuthMethodIds).map((authId, index) => {
                  const auth = authMethodsList.find(
                    (a) => a.auth_id === authId
                  );
                  if (!auth) return null;
                  return (
                    <SettingsAuthMethodConfigSection
                      key={authId}
                      authId={authId}
                      authName={auth.auth_name}
                      authDescription={auth.auth_description}
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
                      isReadonly={isSubmitting || submittingSection === "auth"}
                    />
                  );
                })}

                {/* Update Button */}
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    onClick={handleUpdateAuth}
                    data-testid="btn-update-auth-settings"
                    disabled={isSubmitting || !hasAuthChanges}
                    className="min-w-[160px]"
                  >
                    {submittingSection === "auth" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Updating...
                      </>
                    ) : (
                      "Update Auth Settings"
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="providers" className="space-y-6 mt-6">
                {/* Step 1: AI Providers List */}
                {providerTableData.length > 0 && (
                  <SettingsAIProvidersSection
                    providers={providerTableData}
                    onProviderClick={handleProviderClick}
                    stepStatus={getStepStatus("providers")}
                    stepTitle="AI Providers"
                    stepDescription="Select and configure AI providers"
                    stepNumber={1}
                    isReadonly={
                      isSubmitting || submittingSection === "providers"
                    }
                  />
                )}

                {/* Individual AI Provider Configurations */}
                {Array.from(selectedProviderIds).map((providerId, index) => {
                  const provider = providerTableData.find(
                    (p) => p.provider_id === providerId
                  );
                  if (!provider) return null;
                  return (
                    <SettingsAIProviderConfigSection
                      key={providerId}
                      providerId={providerId}
                      providerName={provider.provider_name}
                      providerDescription={provider.provider_description}
                      data={providerTableData}
                      keyMapping={keyMapping}
                      validKeyIds={validKeyIds}
                      onKeyChange={(providerId, keyId) => {
                        setProviderKeyMapping((prev) => ({
                          ...prev,
                          [providerId]: keyId ?? "",
                        }));
                      }}
                      stepStatus={getStepStatus(`provider-${providerId}`)}
                      stepTitle={`Configure ${provider.provider_name}`}
                      stepDescription={provider.provider_description || ""}
                      stepNumber={
                        providerTableData.length > 0 ? index + 2 : index + 1
                      }
                      isReadonly={
                        isSubmitting || submittingSection === "providers"
                      }
                    />
                  );
                })}

                {/* Update Button */}
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    onClick={handleUpdateProviders}
                    data-testid="btn-update-provider-settings"
                    disabled={isSubmitting || !hasProviderChanges}
                    className="min-w-[160px]"
                  >
                    {submittingSection === "providers" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Updating...
                      </>
                    ) : (
                      "Update Provider Settings"
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="theme" className="space-y-6 mt-6">
                {/* Theme Preview - First Card */}
                <ThemePreview
                  primary_color={formData.primary_color}
                  accent={formData.accent}
                  background={formData.background}
                  surface={formData.surface}
                  success={formData.success}
                  warning={formData.warning}
                  error={formData.error}
                  sidebar_background={formData.sidebar_background}
                  sidebar_primary={formData.sidebar_primary}
                  chart1={formData.chart1}
                  chart2={formData.chart2}
                  chart3={formData.chart3}
                  chart4={formData.chart4}
                  chart5={formData.chart5}
                  onResetAll={handleResetAllColors}
                  hasChanges={hasThemeChanges}
                  stepStatus={getStepStatus("theme")}
                  onScrollToTop={handleScrollToTop}
                  onScrollToBottom={handleScrollToBottom}
                  themePicker={
                    <SettingsThemePresetPicker
                      onThemeSelect={handlePresetThemeSelect}
                      disabled={isSubmitting || submittingSection === "theme"}
                    />
                  }
                  scrollRefs={{
                    primaryColorRef,
                    accentRef,
                    backgroundRef,
                    surfaceRef,
                    successRef,
                    warningRef,
                    errorRef,
                    sidebarBackgroundRef,
                    sidebarPrimaryRef,
                    chart1Ref,
                    chart2Ref,
                    chart3Ref,
                    chart4Ref,
                    chart5Ref,
                  }}
                />

                {/* Accordion for Individual Color Cards */}
                <Accordion
                  type="single"
                  collapsible
                  {...(openAccordionItem ? { value: openAccordionItem } : {})}
                  onValueChange={(value) =>
                    setOpenAccordionItem(value ? value : null)
                  }
                  className="space-y-4"
                >
                  {/* Primary Color */}
                  <AccordionItem value="primary-color" className="border-none">
                    <Card
                      ref={primaryColorRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("primary-color") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("primary-color") === "pending" &&
                          "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("primary-color") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("primary-color") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("primary-color") ===
                              "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "1"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">
                                Primary Color
                              </CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "primary-color"
                                        ? null
                                        : "primary-color"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "primary-color" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "primary-color"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetBrandColor("primary_color");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.primary_color ===
                                      (originalFormData?.primary_color ||
                                        "#171717")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <BrandColorCard
                            label="Primary Color"
                            fieldName="primary_color"
                            value={formData.primary_color}
                            originalValue={
                              originalFormData?.primary_color || "#171717"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() =>
                              handleResetBrandColor("primary_color")
                            }
                            stepStatus={getStepStatus("primary-color")}
                            stepNumber={1}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Accent */}
                  <AccordionItem value="accent" className="border-none">
                    <Card
                      ref={accentRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("accent") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("accent") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("accent") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("accent") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("accent") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "2"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Accent</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "accent"
                                        ? null
                                        : "accent"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "accent" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "accent"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetBrandColor("accent");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.accent ===
                                      (originalFormData?.accent || "#f5f5f5")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <BrandColorCard
                            label="Accent"
                            fieldName="accent"
                            value={formData.accent}
                            originalValue={
                              originalFormData?.accent || "#f5f5f5"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetBrandColor("accent")}
                            stepStatus={getStepStatus("accent")}
                            stepNumber={2}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Background */}
                  <AccordionItem value="background" className="border-none">
                    <Card
                      ref={backgroundRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("background") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("background") === "pending" &&
                          "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("background") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("background") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("background") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "3"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">
                                Background
                              </CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "background"
                                        ? null
                                        : "background"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "background" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "background"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetLayoutColor("background");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.background ===
                                      (originalFormData?.background ||
                                        "#ffffff")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <LayoutColorCard
                            label="Background"
                            fieldName="background"
                            value={formData.background}
                            originalValue={
                              originalFormData?.background || "#ffffff"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetLayoutColor("background")}
                            stepStatus={getStepStatus("background")}
                            stepNumber={3}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Surface */}
                  <AccordionItem value="surface" className="border-none">
                    <Card
                      ref={surfaceRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("surface") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("surface") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("surface") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("surface") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("surface") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "4"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Surface</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "surface"
                                        ? null
                                        : "surface"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "surface" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "surface"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetLayoutColor("surface");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.surface ===
                                      (originalFormData?.surface || "#ffffff")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <LayoutColorCard
                            label="Surface"
                            fieldName="surface"
                            value={formData.surface}
                            originalValue={
                              originalFormData?.surface || "#ffffff"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetLayoutColor("surface")}
                            stepStatus={getStepStatus("surface")}
                            stepNumber={4}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Success */}
                  <AccordionItem value="success" className="border-none">
                    <Card
                      ref={successRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("success") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("success") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("success") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("success") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("success") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "5"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Success</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-2 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "success"
                                        ? null
                                        : "success"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "success" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "success"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="w-48 shrink-0">
                            <RangeSlider
                              min={formData.warning_threshold}
                              max={100}
                              value={[
                                formData.warning_threshold,
                                Math.max(
                                  formData.warning_threshold,
                                  Math.min(100, formData.success_threshold)
                                ),
                              ]}
                              onValueChange={(range) => {
                                const newValue = Math.max(
                                  range[1],
                                  formData.warning_threshold + 1
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  success_threshold: Math.min(100, newValue),
                                }));
                              }}
                              disabled={
                                isSubmitting || submittingSection === "theme"
                              }
                              className="space-y-0"
                            />
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetStatusColor("success");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.success ===
                                      (originalFormData?.success || "#009e34")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <StatusColorCard
                            label="Success"
                            fieldName="success"
                            value={formData.success}
                            originalValue={
                              originalFormData?.success || "#009e34"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetStatusColor("success")}
                            threshold={{
                              value: formData.success_threshold,
                              min: formData.warning_threshold,
                              max: 100,
                              onValueChange: (value) => {
                                const newValue = Math.max(
                                  value,
                                  formData.warning_threshold + 1
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  success_threshold: Math.min(100, newValue),
                                }));
                              },
                            }}
                            stepStatus={getStepStatus("success")}
                            stepNumber={5}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                            renderThresholdInHeader={false}
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Warning */}
                  <AccordionItem value="warning" className="border-none">
                    <Card
                      ref={warningRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("warning") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("warning") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("warning") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("warning") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("warning") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "6"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Warning</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-2 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "warning"
                                        ? null
                                        : "warning"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "warning" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "warning"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="w-48 shrink-0">
                            <RangeSlider
                              min={formData.danger_threshold}
                              max={formData.success_threshold}
                              value={[
                                formData.danger_threshold,
                                Math.max(
                                  formData.danger_threshold + 1,
                                  Math.min(
                                    formData.warning_threshold,
                                    formData.success_threshold - 1
                                  )
                                ),
                              ]}
                              onValueChange={(range) => {
                                const newValue = Math.max(
                                  formData.danger_threshold + 1,
                                  Math.min(
                                    range[1],
                                    formData.success_threshold - 1
                                  )
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  warning_threshold: newValue,
                                }));
                              }}
                              disabled={
                                isSubmitting || submittingSection === "theme"
                              }
                              className="space-y-0"
                            />
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetStatusColor("warning");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.warning ===
                                      (originalFormData?.warning || "#ea8100")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <StatusColorCard
                            label="Warning"
                            fieldName="warning"
                            value={formData.warning}
                            originalValue={
                              originalFormData?.warning || "#ea8100"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetStatusColor("warning")}
                            threshold={{
                              value: formData.warning_threshold,
                              min: formData.danger_threshold,
                              max: formData.success_threshold,
                              onValueChange: (value) => {
                                const newValue = Math.max(
                                  formData.danger_threshold + 1,
                                  Math.min(
                                    value,
                                    formData.success_threshold - 1
                                  )
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  warning_threshold: newValue,
                                }));
                              },
                            }}
                            stepStatus={getStepStatus("warning")}
                            stepNumber={6}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                            renderThresholdInHeader={false}
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Error */}
                  <AccordionItem value="error" className="border-none">
                    <Card
                      ref={errorRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("error") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("error") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("error") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("error") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("error") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "7"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Error</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-2 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "error"
                                        ? null
                                        : "error"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "error" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "error"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="w-48 shrink-0">
                            <RangeSlider
                              min={0}
                              max={formData.warning_threshold}
                              value={[
                                0,
                                Math.min(
                                  formData.danger_threshold,
                                  formData.warning_threshold - 1
                                ),
                              ]}
                              onValueChange={(range) => {
                                const newValue = Math.min(
                                  range[1],
                                  formData.warning_threshold - 1
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  danger_threshold: Math.max(0, newValue),
                                }));
                              }}
                              disabled={
                                isSubmitting || submittingSection === "theme"
                              }
                              className="space-y-0"
                            />
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetStatusColor("error");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.error ===
                                      (originalFormData?.error || "#e7000b")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <StatusColorCard
                            label="Error"
                            fieldName="error"
                            value={formData.error}
                            originalValue={originalFormData?.error || "#e7000b"}
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetStatusColor("error")}
                            threshold={{
                              value: formData.danger_threshold,
                              min: 0,
                              max: formData.warning_threshold,
                              onValueChange: (value) => {
                                const newValue = Math.min(
                                  value,
                                  formData.warning_threshold - 1
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  danger_threshold: Math.max(0, newValue),
                                }));
                              },
                            }}
                            stepStatus={getStepStatus("error")}
                            stepNumber={7}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                            renderThresholdInHeader={false}
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Sidebar Background */}
                  <AccordionItem
                    value="sidebar-background"
                    className="border-none"
                  >
                    <Card
                      ref={sidebarBackgroundRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("sidebar-background") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("sidebar-background") === "pending" &&
                          "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("sidebar-background") ===
                                  "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("sidebar-background") ===
                                      "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("sidebar-background") ===
                              "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "8"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">
                                Sidebar Background
                              </CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "sidebar-background"
                                        ? null
                                        : "sidebar-background"
                                    );
                                  }}
                                >
                                  {openAccordionItem ===
                                  "sidebar-background" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "sidebar-background"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetSidebarColor(
                                      "sidebar_background"
                                    );
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.sidebar_background ===
                                      (originalFormData?.sidebar_background ||
                                        "#fafafa")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <SidebarColorCard
                            label="Sidebar Background"
                            fieldName="sidebar_background"
                            value={formData.sidebar_background}
                            originalValue={
                              originalFormData?.sidebar_background || "#fafafa"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() =>
                              handleResetSidebarColor("sidebar_background")
                            }
                            stepStatus={getStepStatus("sidebar-background")}
                            stepNumber={8}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Sidebar Primary */}
                  <AccordionItem
                    value="sidebar-primary"
                    className="border-none"
                  >
                    <Card
                      ref={sidebarPrimaryRef}
                      className={cn(
                        "transition-all",
                        getStepStatus("sidebar-primary") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("sidebar-primary") === "pending" &&
                          "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("sidebar-primary") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("sidebar-primary") ===
                                      "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("sidebar-primary") ===
                              "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "9"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">
                                Sidebar Primary
                              </CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "sidebar-primary"
                                        ? null
                                        : "sidebar-primary"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "sidebar-primary" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "sidebar-primary"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetSidebarColor("sidebar_primary");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.sidebar_primary ===
                                      (originalFormData?.sidebar_primary ||
                                        "#171717")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <SidebarColorCard
                            label="Sidebar Primary"
                            fieldName="sidebar_primary"
                            value={formData.sidebar_primary}
                            originalValue={
                              originalFormData?.sidebar_primary || "#171717"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() =>
                              handleResetSidebarColor("sidebar_primary")
                            }
                            stepStatus={getStepStatus("sidebar-primary")}
                            stepNumber={9}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Chart 1 */}
                  <AccordionItem value="chart1" className="border-none">
                    <Card
                      ref={chart1Ref}
                      className={cn(
                        "transition-all",
                        getStepStatus("chart1") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("chart1") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("chart1") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("chart1") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("chart1") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "10"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Chart 1</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "chart1"
                                        ? null
                                        : "chart1"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "chart1" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "chart1"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetChartColor("chart1");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.chart1 ===
                                      (originalFormData?.chart1 || "#f54900")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <ChartColorCard
                            label="Chart 1"
                            fieldName="chart1"
                            value={formData.chart1}
                            originalValue={
                              originalFormData?.chart1 || "#f54900"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetChartColor("chart1")}
                            stepStatus={getStepStatus("chart1")}
                            stepNumber={10}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Chart 2 */}
                  <AccordionItem value="chart2" className="border-none">
                    <Card
                      ref={chart2Ref}
                      className={cn(
                        "transition-all",
                        getStepStatus("chart2") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("chart2") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("chart2") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("chart2") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("chart2") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "11"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Chart 2</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "chart2"
                                        ? null
                                        : "chart2"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "chart2" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "chart2"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetChartColor("chart2");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.chart2 ===
                                      (originalFormData?.chart2 || "#009689")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <ChartColorCard
                            label="Chart 2"
                            fieldName="chart2"
                            value={formData.chart2}
                            originalValue={
                              originalFormData?.chart2 || "#009689"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetChartColor("chart2")}
                            stepStatus={getStepStatus("chart2")}
                            stepNumber={11}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Chart 3 */}
                  <AccordionItem value="chart3" className="border-none">
                    <Card
                      ref={chart3Ref}
                      className={cn(
                        "transition-all",
                        getStepStatus("chart3") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("chart3") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("chart3") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("chart3") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("chart3") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "12"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Chart 3</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "chart3"
                                        ? null
                                        : "chart3"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "chart3" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "chart3"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetChartColor("chart3");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.chart3 ===
                                      (originalFormData?.chart3 || "#104e64")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <ChartColorCard
                            label="Chart 3"
                            fieldName="chart3"
                            value={formData.chart3}
                            originalValue={
                              originalFormData?.chart3 || "#104e64"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetChartColor("chart3")}
                            stepStatus={getStepStatus("chart3")}
                            stepNumber={12}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Chart 4 */}
                  <AccordionItem value="chart4" className="border-none">
                    <Card
                      ref={chart4Ref}
                      className={cn(
                        "transition-all",
                        getStepStatus("chart4") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("chart4") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("chart4") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("chart4") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("chart4") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "13"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Chart 4</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "chart4"
                                        ? null
                                        : "chart4"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "chart4" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "chart4"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetChartColor("chart4");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.chart4 ===
                                      (originalFormData?.chart4 || "#ffb900")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <ChartColorCard
                            label="Chart 4"
                            fieldName="chart4"
                            value={formData.chart4}
                            originalValue={
                              originalFormData?.chart4 || "#ffb900"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetChartColor("chart4")}
                            stepStatus={getStepStatus("chart4")}
                            stepNumber={13}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>

                  {/* Chart 5 */}
                  <AccordionItem value="chart5" className="border-none">
                    <Card
                      ref={chart5Ref}
                      className={cn(
                        "transition-all",
                        getStepStatus("chart5") === "active" &&
                          "ring-2 ring-primary",
                        getStepStatus("chart5") === "pending" && "opacity-50"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
                        <AccordionTrigger className="flex-1 hover:no-underline [&>svg]:hidden">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                                getStepStatus("chart5") === "completed"
                                  ? "bg-green-500 text-white"
                                  : getStepStatus("chart5") === "active"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted"
                              )}
                            >
                              {getStepStatus("chart5") === "completed" ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                "14"
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg">Chart 5</CardTitle>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <div className="flex items-center gap-1 shrink-0">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenAccordionItem(
                                      openAccordionItem === "chart5"
                                        ? null
                                        : "chart5"
                                    );
                                  }}
                                >
                                  {openAccordionItem === "chart5" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {openAccordionItem === "chart5"
                                    ? "Collapse"
                                    : "Expand"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToTop();
                                  }}
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to top</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleScrollToBottom();
                                  }}
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Scroll to bottom</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResetChartColor("chart5");
                                  }}
                                  disabled={
                                    isSubmitting ||
                                    submittingSection === "theme" ||
                                    formData.chart5 ===
                                      (originalFormData?.chart5 || "#fe9a00")
                                  }
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reset to original value</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <AccordionContent>
                        <CardContent className="pt-0">
                          <ChartColorCard
                            label="Chart 5"
                            fieldName="chart5"
                            value={formData.chart5}
                            originalValue={
                              originalFormData?.chart5 || "#fe9a00"
                            }
                            onColorChange={(fieldName, value) =>
                              setFormData((prev) => ({
                                ...prev,
                                [fieldName]: value,
                              }))
                            }
                            onReset={() => handleResetChartColor("chart5")}
                            stepStatus={getStepStatus("chart5")}
                            stepNumber={14}
                            isReadonly={
                              isSubmitting || submittingSection === "theme"
                            }
                            hideCardWrapper
                          />
                        </CardContent>
                      </AccordionContent>
                    </Card>
                  </AccordionItem>
                </Accordion>

                {/* Update Button */}
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    onClick={handleUpdateTheme}
                    data-testid="btn-update-theme-settings"
                    disabled={isSubmitting || !hasThemeChanges}
                    className="min-w-[160px]"
                  >
                    {submittingSection === "theme" ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Updating...
                      </>
                    ) : (
                      "Update Theme Settings"
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </form>
    </div>
  );
}
