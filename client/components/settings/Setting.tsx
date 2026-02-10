/**
 * Setting.tsx
 * Implementation using modular resource components
 * Used to create and manage settings - supports both creation and editing
 * Adapted from Persona.tsx pattern
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import type { GenerateRegenerateModalResource } from "@/components/common/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { AuthKeys } from "@/components/resources/AuthKeys";
import { Auths } from "@/components/resources/Auths";
import { Colors } from "@/components/resources/Colors";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/FlagsLegacy";
import { Names } from "@/components/resources/Names";
import { Profiles } from "@/components/resources/Profiles";
import { ProviderKeys } from "@/components/resources/ProviderKeys";
import { Roles } from "@/components/resources/Roles";
import { RoleRoutes } from "@/components/resources/RoleRoutes";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveSettingIn = InputOf<"/api/v4/artifacts/settings/save", "post">;
type SaveSettingOut = OutputOf<"/api/v4/artifacts/settings/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftColorsIn = InputOf<"/api/v4/resources/colors", "post">;
type CreateDraftColorsOut = OutputOf<"/api/v4/resources/colors", "post">;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type PatchSettingDraftIn = InputOf<"/api/v4/artifacts/settings/draft", "patch">;
type PatchSettingDraftOut = OutputOf<"/api/v4/artifacts/settings/draft", "patch">;

type SettingData = OutputOf<"/api/v4/artifacts/settings/get", "post">;

export interface SettingProps {
  settingId?: string;
  // Server-provided data (for server-side rendering)
  settingData?: SettingData;
  // Server actions (replaces useMutation)
  saveSettingAction?: (input: SaveSettingIn) => Promise<SaveSettingOut>;
  patchSettingDraftAction?: (
    input: PatchSettingDraftIn
  ) => Promise<PatchSettingDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createColorsAction?: (
    input: CreateDraftColorsIn
  ) => Promise<CreateDraftColorsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createDepartmentsAction?: (
    input: CreateDraftDepartmentsIn
  ) => Promise<CreateDraftDepartmentsOut>;
  createProviderKeysAction?: (input: {
    provider_id: string;
    key_id: string;
  }) => Promise<{ provider_keys_id?: string | null }>;
  getProviderKeysAction?: (ids: string[]) => Promise<
    Array<{
      id?: string | null;
      provider_id?: string | null;
      key_id?: string | null;
      provider_name?: string | null;
      key_name?: string | null;
      key_description?: string | null;
      generated?: boolean | null;
    }>
  >;
  createAuthKeysAction?: (input: {
    auth_id: string;
    key_id: string;
  }) => Promise<{ auth_keys_id?: string | null }>;
  getAuthKeysAction?: (ids: string[]) => Promise<
    Array<{
      id?: string | null;
      auth_id?: string | null;
      key_id?: string | null;
      auth_name?: string | null;
      key_name?: string | null;
      key_description?: string | null;
      generated?: boolean | null;
    }>
  >;
  createRoleRoutesAction?: (
    input: InputOf<"/api/v4/resources/setting_role_routes", "post">
  ) => Promise<OutputOf<"/api/v4/resources/setting_role_routes", "post">>;
}

function SettingComponent({
  settingId,
  settingData,
  saveSettingAction,
  patchSettingDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createColorsAction,
  createFlagsAction,
  createDepartmentsAction,
  createProviderKeysAction,
  getProviderKeysAction,
  createAuthKeysAction,
  getAuthKeysAction,
  createRoleRoutesAction,
}: SettingProps) {
  const router = useRouter();
  const isEditMode = !!settingId;
  const {
    profile,
    selectedDraftId,
    setSelectedDraftId,
    socket,
    isConnected,
  } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Generation state for AI workflows - simplified using ResourceType
  const [generatingResources, setGeneratingResources] = useState<
    Set<ResourceType>
  >(new Set());

  // Modal state for generate/regenerate
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const settingSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      colorSearch: parseAsString,
      descriptionSearch: parseAsString,
      // Filter params (URL-backed)
      colorShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store settingData to prevent callback recreation on every render
  const settingDataRef = React.useRef(settingData);
  React.useEffect(() => {
    settingDataRef.current = settingData;
  }, [settingData]);

  // Memoize settingData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableSettingDataFields = React.useMemo(() => {
    if (!settingData) return null;
    return {
      group_id: settingData.group_id,
      name_resource: settingData.name_resource,
      show_name: settingData.show_name,
      name_suggestions: settingData.name_suggestions,
      names: settingData.names,
      name_required: settingData.name_required,
      name_agent_id: settingData.name_agent_id,
      description_resource: settingData.description_resource,
      show_description: settingData.show_description,
      description_suggestions: settingData.description_suggestions,
      description_required: settingData.description_required,
      description_agent_id: settingData.description_agent_id,
      descriptions: settingData.descriptions,
      department_resources: settingData.department_resources,
      show_departments: settingData.show_departments,
      department_suggestions: settingData.department_suggestions,
      departments_required: settingData.departments_required,
      departments_agent_id: settingData.departments_agent_id,
      departments: settingData.departments,
      department_ids: settingData.department_ids,
      profile_resources: settingData.profile_resources,
      show_profiles: settingData.show_profiles,
      profile_suggestions: settingData.profile_suggestions,
      profiles_required: settingData.profiles_required,
      profiles_agent_id: settingData.profiles_agent_id,
      profiles: settingData.profiles,
      profile_ids: settingData.profile_ids,
      flag_resource: settingData.flag_resource,
      show_flag: settingData.show_flag,
      flag_required: settingData.flag_required,
      flag_agent_id: settingData.flag_agent_id,
      color_resources: settingData.color_resources,
      show_colors: settingData.show_colors,
      color_suggestions: settingData.color_suggestions,
      colors_required: settingData.colors_required,
      colors_agent_id: settingData.colors_agent_id,
      colors: settingData.colors,
      color_ids: settingData.color_ids,
      auth_resources: settingData.auth_resources,
      show_auths: settingData.show_auths,
      auth_suggestions: settingData.auth_suggestions,
      auths_required: settingData.auths_required,
      auths_agent_id: settingData.auths_agent_id,
      auths: settingData.auths,
      auth_ids: settingData.auth_ids,
      provider_resources: settingData.provider_resources,
      show_providers: settingData.show_providers,
      provider_suggestions: settingData.provider_suggestions,
      providers_required: settingData.providers_required,
      providers_agent_id: settingData.providers_agent_id,
      providers: settingData.providers,
      provider_key_ids: settingData.provider_key_ids,
      provider_key_resources:
        ((settingData as Record<string, unknown>)["provider_key_resources"] as
          | Array<{
              id?: string | null;
              provider_id?: string | null;
              key_id?: string | null;
              provider_name?: string | null;
              key_name?: string | null;
              key_description?: string | null;
              generated?: boolean | null;
            }>
          | null
          | undefined) ?? [],
      key_resources: settingData.key_resources,
      show_keys: settingData.show_keys,
      key_suggestions: settingData.key_suggestions,
      keys_required: settingData.keys_required,
      keys_agent_id: settingData.keys_agent_id,
      keys: settingData.keys,
      auth_key_ids: settingData.auth_key_ids,
      auth_key_resources:
        ((settingData as Record<string, unknown>)["auth_key_resources"] as
          | Array<{
              id?: string | null;
              auth_id?: string | null;
              key_id?: string | null;
              auth_name?: string | null;
              key_name?: string | null;
              key_description?: string | null;
              generated?: boolean | null;
            }>
          | null
          | undefined) ?? [],
      basic_agent_id: settingData.basic_agent_id,
      general_agent_id: settingData.general_agent_id,
      role_ids: settingData.role_ids,
      role_resources: settingData.role_resources,
      show_roles: settingData.show_roles,
      roles_required: settingData.roles_required,
      roles: settingData.roles,
      route_resources: settingData.route_resources,
      show_routes: settingData.show_routes,
      routes_required: settingData.routes_required,
      routes: settingData.routes,
      role_route_ids: settingData.role_route_ids,
      role_route_resources: settingData.role_route_resources,
      show_role_routes: settingData.show_role_routes,
      role_routes: settingData.role_routes,
    };
    // Intentionally depend on individual fields, not whole settingData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settingData?.group_id,
    settingData?.name_resource,
    settingData?.show_name,
    settingData?.name_suggestions,
    settingData?.names,
    settingData?.name_required,
    settingData?.name_agent_id,
    settingData?.description_resource,
    settingData?.show_description,
    settingData?.description_suggestions,
    settingData?.description_required,
    settingData?.description_agent_id,
    settingData?.descriptions,
    settingData?.department_resources,
    settingData?.show_departments,
    settingData?.department_suggestions,
    settingData?.departments_required,
    settingData?.departments_agent_id,
    settingData?.departments,
    settingData?.department_ids,
    settingData?.profile_resources,
    settingData?.show_profiles,
    settingData?.profile_suggestions,
    settingData?.profiles_required,
    settingData?.profiles_agent_id,
    settingData?.profiles,
    settingData?.profile_ids,
    settingData?.flag_resource,
    settingData?.show_flag,
    settingData?.flag_required,
    settingData?.flag_agent_id,
    settingData?.color_resources,
    settingData?.show_colors,
    settingData?.color_suggestions,
    settingData?.colors_required,
    settingData?.colors_agent_id,
    settingData?.colors,
    settingData?.color_ids,
    settingData?.auth_resources,
    settingData?.show_auths,
    settingData?.auth_suggestions,
    settingData?.auths_required,
    settingData?.auths_agent_id,
    settingData?.auths,
    settingData?.auth_ids,
    settingData?.provider_resources,
    settingData?.show_providers,
    settingData?.provider_suggestions,
    settingData?.providers_required,
    settingData?.providers_agent_id,
    settingData?.providers,
    settingData?.provider_key_ids,
    settingData?.key_resources,
    settingData?.show_keys,
    settingData?.key_suggestions,
    settingData?.keys_required,
    settingData?.keys_agent_id,
    settingData?.keys,
    settingData?.auth_key_ids,
    settingData?.basic_agent_id,
    settingData?.general_agent_id,
    settingData?.role_ids,
    settingData?.role_resources,
    settingData?.show_roles,
    settingData?.roles_required,
    settingData?.roles,
    settingData?.route_resources,
    settingData?.show_routes,
    settingData?.routes_required,
    settingData?.routes,
    settingData?.role_route_ids,
    settingData?.role_route_resources,
    settingData?.show_role_routes,
    settingData?.role_routes,
  ]);

  // Helper to check if a resource type can be regenerated
  // Use stableSettingDataFields to prevent callback recreation when settingData object reference changes
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableSettingDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableSettingDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return (
            stableSettingDataFields.description_resource?.generated ?? false
          );
        case "colors":
          return (
            stableSettingDataFields.color_resources?.some((c) => c.generated) ??
            false
          );
        case "flags":
          return stableSettingDataFields.flag_resource?.generated ?? false;
        case "departments":
          return (
            stableSettingDataFields.department_resources?.some(
              (d) => d.generated
            ) ?? false
          );
        default:
          return false;
      }
    },
    [stableSettingDataFields]
  );

  const getInitialFormState = useCallback(() => {
    const data = settingDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        color_ids: [] as string[],
        active_flag_id: null as string | null,
        department_ids: [] as string[],
        profile_ids: [] as string[],
        auth_ids: [] as string[],
        provider_key_ids: [] as string[],
        auth_key_ids: [] as string[],
        role_ids: [] as string[],
        role_route_ids: [] as string[],
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      color_ids: data.color_ids ?? [],
      active_flag_id: data.active_flag_id ?? null,
      department_ids: data.department_ids ?? [],
      profile_ids: data.profile_ids ?? [],
      auth_ids: data.auth_ids ?? [],
      provider_key_ids: data.provider_key_ids ?? [],
      auth_key_ids: data.auth_key_ids ?? [],
      role_ids: data.role_ids ?? [],
      role_route_ids: data.role_route_ids ?? [],
    };
    // Remove settingData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const departmentIdsStr = React.useMemo(
    () => JSON.stringify(settingData?.department_ids ?? []),
    [settingData?.department_ids]
  );
  const colorIdsStr = React.useMemo(
    () => JSON.stringify(settingData?.color_ids ?? []),
    [settingData?.color_ids]
  );
  const authIdsStr = React.useMemo(
    () => JSON.stringify(settingData?.auth_ids ?? []),
    [settingData?.auth_ids]
  );
  const profileIdsStr = React.useMemo(
    () => JSON.stringify(settingData?.profile_ids ?? []),
    [settingData?.profile_ids]
  );
  const providerIdsStr = React.useMemo(
    () => JSON.stringify(settingData?.provider_key_ids ?? []),
    [settingData?.provider_key_ids]
  );
  const keyIdsStr = React.useMemo(
    () => JSON.stringify(settingData?.auth_key_ids ?? []),
    [settingData?.auth_key_ids]
  );
  const roleIdsStr = React.useMemo(
    () => JSON.stringify(settingData?.role_ids ?? []),
    [settingData?.role_ids]
  );
  const roleRouteIdsStr = React.useMemo(
    () => JSON.stringify(settingData?.role_route_ids ?? []),
    [settingData?.role_route_ids]
  );

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateDepartmentIdsStr = React.useMemo(
    () => JSON.stringify(formState.department_ids),
    [formState.department_ids]
  );
  const formStateColorIdsStr = React.useMemo(
    () => JSON.stringify(formState.color_ids),
    [formState.color_ids]
  );
  const formStateAuthIdsStr = React.useMemo(
    () => JSON.stringify(formState.auth_ids),
    [formState.auth_ids]
  );
  const formStateProfileIdsStr = React.useMemo(
    () => JSON.stringify(formState.profile_ids),
    [formState.profile_ids]
  );
  const formStateProviderIdsStr = React.useMemo(
    () => JSON.stringify(formState.provider_key_ids),
    [formState.provider_key_ids]
  );
  const formStateKeyIdsStr = React.useMemo(
    () => JSON.stringify(formState.auth_key_ids),
    [formState.auth_key_ids]
  );
  const formStateRoleIdsStr = React.useMemo(
    () => JSON.stringify(formState.role_ids),
    [formState.role_ids]
  );
  const formStateRoleRouteIdsStr = React.useMemo(
    () => JSON.stringify(formState.role_route_ids),
    [formState.role_route_ids]
  );

  // Update form state when server data changes
  // Use settingData directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        JSON.stringify(prev.color_ids) !== JSON.stringify(newState.color_ids) ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(newState.department_ids) ||
        JSON.stringify(prev.profile_ids) !==
          JSON.stringify(newState.profile_ids) ||
        JSON.stringify(prev.auth_ids) !== JSON.stringify(newState.auth_ids) ||
        JSON.stringify(prev.provider_key_ids) !==
          JSON.stringify(newState.provider_key_ids) ||
        JSON.stringify(prev.auth_key_ids) !== JSON.stringify(newState.auth_key_ids) ||
        JSON.stringify(prev.role_ids) !== JSON.stringify(newState.role_ids) ||
        JSON.stringify(prev.role_route_ids) !==
          JSON.stringify(newState.role_route_ids)
      ) {
        return newState;
      }
      return prev;
    });
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settingData?.name_id,
    settingData?.description_id,
    settingData?.active_flag_id,
    colorIdsStr,
    departmentIdsStr,
    profileIdsStr,
    authIdsStr,
    providerIdsStr,
    keyIdsStr,
    roleIdsStr,
    roleRouteIdsStr,
  ]);

  // Draft version tracking for optimistic concurrency control
  // Keep version in a ref so updating it doesn't retrigger the effect
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    settingData && "draft_version" in settingData
      ? (settingData as { draft_version?: number | null }).draft_version
      : null;
  React.useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

  // Get draftId from GenericForm's URL state via bridge (GenericForm is single source of truth)
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Memoized callback to sync draftId from GenericForm - only update if value changed
  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
    // Store formData for access in handleGenerateResources
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  // Use ref to stabilize patchSettingDraftAction to prevent effect recreation when prop reference changes
  const patchSettingDraftActionRef = React.useRef(patchSettingDraftAction);
  React.useEffect(() => {
    patchSettingDraftActionRef.current = patchSettingDraftAction;
  }, [patchSettingDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      color_ids: formState.color_ids,
      active_flag_id: formState.active_flag_id,
      department_ids: formState.department_ids,
      profile_ids: formState.profile_ids,
      auth_ids: formState.auth_ids,
      provider_key_ids: formState.provider_key_ids,
      auth_key_ids: formState.auth_key_ids,
      role_ids: formState.role_ids,
      role_route_ids: formState.role_route_ids,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formStateColorIdsStr,
    formStateDepartmentIdsStr,
    formStateProfileIdsStr,
    formStateAuthIdsStr,
    formStateProviderIdsStr,
    formStateKeyIdsStr,
    formStateRoleIdsStr,
    formStateRoleRouteIdsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.color_ids.length > 0 ||
      formState.active_flag_id ||
      formState.department_ids.length > 0 ||
      formState.profile_ids.length > 0 ||
      formState.auth_ids.length > 0 ||
      formState.provider_key_ids.length > 0 ||
      formState.auth_key_ids.length > 0 ||
      formState.role_ids.length > 0 ||
      formState.role_route_ids.length > 0;

    if (!hasResourceIds || !patchSettingDraftActionRef.current) {
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchSettingDraftActionRef.current) return;
        const result = await patchSettingDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            color_ids: formState.color_ids,
            active_flag_id: formState.active_flag_id,
            department_ids: formState.department_ids,
            profile_ids: formState.profile_ids,
            auth_ids: formState.auth_ids,
            provider_key_ids: formState.provider_key_ids,
            auth_key_ids: formState.auth_key_ids,
            role_ids: formState.role_ids,
            role_route_ids: formState.role_route_ids,
            expected_version: lastSavedVersionRef.current, // ✅ ref, not state dep
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge (GenericForm owns URL state)
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        // This can stay as state (for UI), but it won't re-trigger patching
        // because the effect is gated by payload changes.
        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Failed to save draft - error already logged by API
        // Don't update lastPatchedKeyRef on failure so we retry on next change
      }
    }, 1000);

    return () => clearTimeout(timer);
    // ✅ Trigger only when payload changes, not when version changes
    // patchSettingDraftAction and setDraftId are accessed via refs to prevent effect recreation
    // when prop/function references change but functionality is the same
    // We access formState fields and draftId inside the effect, but depend on draftPatchKey
    // to prevent unnecessary effect recreation when individual fields change but payload is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    // patchSettingDraftAction and setDraftId are accessed via refs
  ]);

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!settingData) return false;
    return !settingData.can_edit;
  }, [settingData]);

  // Set breadcrumb context when setting data is loaded
  useEffect(() => {
    const settingName = settingData?.name_resource?.name;
    if (settingName && settingId && isEditMode) {
      setEntityMetadata({
        entityId: settingId,
        entityName: settingName,
        entityType: "setting",
      });
    }
    return () => clearEntityMetadata();
  }, [
    settingData,
    settingId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from settingData
      if (settingData?.name_required && !formState.name_id) {
        toast.error("Setting name is required");
        throw new Error("Setting name is required");
      }

      if (settingData?.colors_required && formState.color_ids.length === 0) {
        toast.error("At least one color is required");
        throw new Error("At least one color is required");
      }

      if (
        settingData?.departments_required &&
        formState.department_ids.length === 0
      ) {
        toast.error("At least one department is required");
        throw new Error("At least one department is required");
      }

      // Ensure profileId exists - required for API calls
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveSettingAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      try {
        await saveSettingAction({
          body: {
            input_setting_id: isEditMode && settingId ? settingId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            color_ids: formState.color_ids || [],
            active_flag_id: formState.active_flag_id || null,
            department_ids: formState.department_ids || [],
            profile_ids: formState.profile_ids || [],
            auth_ids: formState.auth_ids || [],
            provider_key_ids: formState.provider_key_ids || [],
            auth_key_ids: formState.auth_key_ids || [],
            role_ids: formState.role_ids || [],
            role_route_ids: formState.role_route_ids || [],
          },
        });
        toast.success(
          `Setting ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/settings");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} setting: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      settingId,
      profile?.id,
      saveSettingAction,
      router,
      settingData?.name_required,
      settingData?.colors_required,
      settingData?.departments_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "colors":
          if (!hasName || !hasDescription) return "pending";
          return formState.color_ids.length > 0 ? "completed" : "active";
        case "configuration":
          if (!hasName || !hasDescription) return "pending";
          return "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      colors: ["colors"],
      configuration: [], // No generation for auths/provider_keys/auth_keys yet
      all: ["names", "descriptions", "colors", "flags", "departments"], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Record<ResourceType, string> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      colors: "Colors",
      icons: "Icons",
      instructions: "Instructions",
      flags: "Flags",
      examples: "Examples",
      fields: "Fields",
      departments: "Departments",
    }),
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: ResourceType[],
      userInstructions?: string
    ) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;
      const colorSearch = (formData["colorSearch"] as string | undefined) ?? null;

      socket.emit("setting_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        color_search: colorSearch || null,
        mcp: false,
        setting_id: settingId || null,
      });
    },
    [socket, isConnected, settingId]
  );

  useEffect(() => {
    if (!socket || !isConnected) return;

    const currentGroupId = settingData?.group_id;
    const validResourceTypes: ResourceType[] = [
      "names",
      "descriptions",
      "colors",
      "flags",
      "departments",
    ];

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      active_flag_id?: string | null;
      color_ids?: string[];
      department_ids?: string[];
      message?: string;
      success?: boolean;
    }) => {
      if (
        data.artifact_type !== "setting" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        setFormState((prev) => ({
          ...prev,
          name_id: data.name_id ?? prev.name_id,
          description_id: data.description_id ?? prev.description_id,
          active_flag_id: data.active_flag_id ?? prev.active_flag_id,
          color_ids: data.color_ids ?? prev.color_ids,
          department_ids: data.department_ids ?? prev.department_ids,
        }));
      }

      const completedTypes = data.resource_type ? [data.resource_type] : [];
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        completedTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });

      if (data.success) {
        toast.success(data.message || "Generation completed");
      } else {
        toast.error(data.message || "Generation failed");
      }
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      resource_types?: string[];
      message?: string;
    }) => {
      if (
        data.artifact_type !== "setting" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }

      const resourceTypes =
        data.resource_types || (data.resource_type ? [data.resource_type] : []);

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => {
          if (validResourceTypes.includes(rt as ResourceType)) {
            next.delete(rt as ResourceType);
          }
        });
        return next;
      });
      toast.error(data.message || "Generation failed");
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
    }) => {
      if (
        data.artifact_type !== "setting" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return;
      }
    };

    socket.on("setting_generation_progress", handleGenerationProgress);
    socket.on("setting_generation_complete", handleGenerationComplete);
    socket.on("setting_generation_error", handleGenerationError);

    return () => {
      socket.off("setting_generation_progress", handleGenerationProgress);
      socket.off("setting_generation_complete", handleGenerationComplete);
      socket.off("setting_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, settingData?.group_id]);

  // Handler to open modal for step card generation
  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt],
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  // Handler for modal generate/regenerate action
  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as ResourceType[];
      await handleGenerateResources(
        resourceTypes,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = (
      event: CustomEvent<{ agentId?: string }>
    ) => {
      const agentId = event.detail?.agentId;
      if (agentId) {
        // Open modal instead of directly generating
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener(
      "full-page-generate",
      handleFullPageGenerate as EventListener
    );
    return () =>
      window.removeEventListener(
        "full-page-generate",
        handleFullPageGenerate as EventListener
      );
  }, [handleOpenStepCardModal]);

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the setting name, description, departments, and active status.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "colors",
        title: "Theme Colors",
        description: "Select theme colors for this setting.",
        resetFields: ["color_ids", "colorSearch", "colorShowSelected"],
      },
      {
        id: "configuration",
        title: "Configuration",
        description: "Configure profiles, auths, provider keys, and auth keys.",
        resetFields: ["profile_ids", "auth_ids", "provider_key_ids", "auth_key_ids"],
      },
      {
        id: "roles_routes",
        title: "Roles & Routes",
        description: "Configure available roles and role-route permissions for this setting.",
        resetFields: ["role_ids", "role_route_ids"],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "color_ids",
      "active",
      "department_ids",
      "profile_ids",
      "auth_ids",
      "provider_key_ids",
      "auth_key_ids",
      "role_ids",
      "role_route_ids",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "colors":
        return "Colors reset";
      case "configuration":
        return "Configuration reset";
      case "roles_routes":
        return "Roles & Routes reset";
      default:
        return "Reset";
    }
  }, []);

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      switch (stepId) {
        case "basic":
          return {
            ...prev,
            name_id: null,
            description_id: null,
            active_flag_id: null,
            department_ids: [],
          };
        case "colors":
          return {
            ...prev,
            color_ids: [],
          };
        case "configuration":
          return {
            ...prev,
            profile_ids: [],
            auth_ids: [],
            provider_key_ids: [],
            auth_key_ids: [],
          };
        case "roles_routes":
          return {
            ...prev,
            role_ids: [],
            role_route_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/settings",
      backLabel: "Back",
      createLabel: "Create Setting",
      updateLabel: "Update Setting",
    }),
    []
  );

  // Memoize renderStep to prevent GenericForm re-renders
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
      onReset,
    }: {
      stepId: string;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      stepStatus: StepStatus;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
      onReset?: () => void;
    }) => {
      // Use memoized fields to avoid dependency on settingData object reference
      const currentSettingData = stableSettingDataFields;
      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              customHeader={
                <Names
                  name_id={formState.name_id ?? null}
                  name_resource={currentSettingData?.name_resource ?? null}
                  show_name={currentSettingData?.show_name ?? true}
                  name_suggestions={currentSettingData?.name_suggestions ?? []}
                  names={currentSettingData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  placeholder="e.g., Production Settings"
                  defaultName="New Setting"
                  required={currentSettingData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentSettingData?.group_id ?? null}
                  agent_id={currentSettingData?.name_agent_id ?? null}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                (currentSettingData?.name_agent_id ||
                  currentSettingData?.description_agent_id ||
                  currentSettingData?.departments_agent_id ||
                  currentSettingData?.flag_agent_id) ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "basic"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "basic",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["basic"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["basic"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["basic"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentSettingData?.description_resource ?? null
                  }
                  show_description={
                    currentSettingData?.show_description ?? true
                  }
                  description_suggestions={
                    currentSettingData?.description_suggestions ?? []
                  }
                  descriptions={currentSettingData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  searchTerm={
                    (stepFormData["descriptionSearch"] as
                      | string
                      | null
                      | undefined) || ""
                  }
                  onSearchChange={(term: string) =>
                    setStepFormData({ descriptionSearch: term || null })
                  }
                  label="Description"
                  placeholder="Detailed description of this setting"
                  required={currentSettingData?.description_required ?? false}
                  rows={4}
                  data-testid="input-setting-description"
                  group_id={currentSettingData?.group_id ?? null}
                  agent_id={currentSettingData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Department Selection */}
                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    currentSettingData?.department_resources ?? []
                  }
                  show_departments={
                    currentSettingData?.show_departments ?? false
                  }
                  department_suggestions={
                    currentSettingData?.department_suggestions ?? []
                  }
                  departments={currentSettingData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  required={currentSettingData?.departments_required ?? false}
                  group_id={currentSettingData?.group_id ?? null}
                  agent_id={currentSettingData?.departments_agent_id ?? null}
                  createDepartmentsAction={createDepartmentsAction}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentSettingData?.flag_resource ?? null}
                  show_flag={currentSettingData?.show_flag ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  label="Active"
                  helpText="Inactive settings will not be available"
                  required={currentSettingData?.flag_required ?? false}
                  group_id={currentSettingData?.group_id ?? null}
                  agent_id={currentSettingData?.flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
                />
              </div>
            </StepCard>
          );

        case "colors": {
          const colorShowSelected =
            (stepFormData["colorShowSelected"] as boolean | null | undefined) ??
            false;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={
                (stepFormData["colorSearch"] as string | null | undefined) || ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ colorSearch: term || null })
              }
              searchPlaceholder="Search colors..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: colorShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ colorShowSelected: value || null }),
                },
              ]}
              resetFields={["color_ids", "colorSearch", "colorShowSelected"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["colors"] &&
                stepResources["colors"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "colors"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "colors",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["colors"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["colors"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["colors"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              {/* Multi-select Colors component */}
              <Colors
                color_ids={formState.color_ids ?? []}
                color_resources={currentSettingData?.color_resources ?? []}
                show_color={currentSettingData?.show_colors ?? false}
                color_suggestions={currentSettingData?.color_suggestions ?? []}
                colors={currentSettingData?.colors ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, color_ids: ids }))
                }
                multiSelect={true}
                searchTerm={
                  (stepFormData["colorSearch"] as string | null | undefined) ||
                  ""
                }
                onSearchChange={(term) =>
                  setStepFormData({ colorSearch: term || null })
                }
                showSelectedFilter={colorShowSelected}
                onShowSelectedChange={(value) =>
                  setStepFormData({ colorShowSelected: value || null })
                }
                required={currentSettingData?.colors_required ?? false}
                group_id={currentSettingData?.group_id ?? null}
                agent_id={currentSettingData?.colors_agent_id ?? null}
                createColorsAction={createColorsAction}
              />
            </StepCard>
          );
        }

        case "roles_routes":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["role_ids", "role_route_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Roles
                  roles={currentSettingData?.roles ?? []}
                  show_roles={currentSettingData?.show_roles ?? true}
                  disabled={disabled}
                  editable={true}
                  multiSelect={true}
                  role_ids={formState.role_ids ?? []}
                  onRoleChange={() => {}}
                  onRolesChange={(ids) =>
                    setFormState((prev) => ({ ...prev, role_ids: ids }))
                  }
                  label="Roles"
                />

                <RoleRoutes
                  role_route_ids={formState.role_route_ids ?? []}
                  role_route_resources={currentSettingData?.role_route_resources ?? []}
                  show_role_routes={currentSettingData?.show_role_routes ?? true}
                  role_routes={currentSettingData?.role_routes ?? []}
                  role_ids={formState.role_ids ?? []}
                  role_resources={currentSettingData?.role_resources ?? []}
                  routes={currentSettingData?.routes ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, role_route_ids: ids }))
                  }
                  group_id={currentSettingData?.group_id ?? null}
                  createRoleRoutesAction={createRoleRoutesAction}
                  label="Role Routes"
                  description="Configure which routes each role can access"
                />
              </div>
            </StepCard>
          );

        case "configuration":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["profile_ids", "auth_ids", "provider_key_ids", "auth_key_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              {/* Multi-select Auths, Providers, Keys components */}
              <div className="space-y-4">
                <Profiles
                  profile_ids={formState.profile_ids ?? []}
                  profile_resources={currentSettingData?.profile_resources ?? []}
                  show_profiles={currentSettingData?.show_profiles ?? false}
                  profile_suggestions={
                    currentSettingData?.profile_suggestions ?? []
                  }
                  profiles={currentSettingData?.profiles ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, profile_ids: ids }))
                  }
                  label="Profiles"
                  description="Profiles enabled for identity provider login."
                />

                <Auths
                  auth_ids={formState.auth_ids ?? []}
                  auth_resources={currentSettingData?.auth_resources ?? []}
                  show_auths={currentSettingData?.show_auths ?? false}
                  auth_suggestions={currentSettingData?.auth_suggestions ?? []}
                  auths={currentSettingData?.auths ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, auth_ids: ids }))
                  }
                  required={currentSettingData?.auths_required ?? false}
                  group_id={currentSettingData?.group_id ?? null}
                  agent_id={currentSettingData?.auths_agent_id ?? null}
                />

                <ProviderKeys
                  provider_key_ids={formState.provider_key_ids ?? []}
                  provider_key_resources={
                    currentSettingData?.provider_key_resources ?? []
                  }
                  providers={currentSettingData?.providers ?? []}
                  keys={currentSettingData?.keys ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, provider_key_ids: ids }))
                  }
                  show_provider_keys={currentSettingData?.show_providers ?? false}
                  createProviderKeysAction={createProviderKeysAction}
                  getProviderKeysAction={getProviderKeysAction}
                />

                <AuthKeys
                  auth_key_ids={formState.auth_key_ids ?? []}
                  auth_key_resources={currentSettingData?.auth_key_resources ?? []}
                  auths={currentSettingData?.auths ?? []}
                  keys={currentSettingData?.keys ?? []}
                  selected_auth_ids={formState.auth_ids ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, auth_key_ids: ids }))
                  }
                  show_auth_keys={currentSettingData?.show_auths ?? false}
                  createAuthKeysAction={createAuthKeysAction}
                  getAuthKeysAction={getAuthKeysAction}
                />
              </div>
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      // Use stableSettingDataFields instead of settingData to prevent callback recreation
      // when only object reference changes (but content is same)
      stableSettingDataFields,
      disabled,
      isEditMode,
      isGenerating,
      stepResources,
      // Depend on individual formState fields instead of whole object to prevent callback recreation
      // when object reference changes but values are same
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      // Include arrays - they're used in the callback, but the formState sync effect ensures
      // they only change when content actually changes (not just reference)
      formState.department_ids,
      formState.profile_ids,
      formState.color_ids,
      formState.auth_ids,
      formState.provider_key_ids,
      formState.auth_key_ids,
      formState.role_ids,
      formState.role_route_ids,
      createNamesAction,
      createDescriptionsAction,
      createColorsAction,
      createFlagsAction,
      createDepartmentsAction,
      createProviderKeysAction,
      getProviderKeysAction,
      createAuthKeysAction,
      getAuthKeysAction,
      createRoleRoutesAction,
      canRegenerate,
      handleOpenStepCardModal,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`setting-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={settingData?.disabled_reason ?? null}
          entityType="setting"
        />

        <GenericForm
          nuqsParsers={
            settingSearchParamsClient as Record<string, Parser<unknown>>
          }
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={settingData}
        formFieldKeys={formFieldKeys}
        onReset={(stepId) => handleReset(stepId)}
        resetSuccessMessage={resetSuccessMessage}
        onSubmit={handleSubmit}
        submitButton={submitButton}
        isReadonly={disabled}
          isEditMode={isEditMode}
          renderStep={renderStep}
          onFormDataChange={onFormDataChange}
          registerSetFormData={(setter) => {
            setUrlFormDataRef.current = setter;
          }}
        />

        {/* Generate/Regenerate Modal */}
        {modalMode && (
          <GenerateRegenerateModal
            open={showGenerateModal}
            onOpenChange={setShowGenerateModal}
            resources={modalResources}
            onResourcesChange={setModalResources}
            instructions={modalInstructions}
            onInstructionsChange={setModalInstructions}
            onGenerate={handleModalGenerate}
            isGenerating={modalResources.some((r) =>
              isGenerating(r.id as ResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(SettingComponent, (prevProps, nextProps) => {
  // Compare settingData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.settingData?.name_id,
    description_id: prevProps.settingData?.description_id,
    color_ids: prevProps.settingData?.color_ids,
    active_flag_id: prevProps.settingData?.active_flag_id,
    department_ids: prevProps.settingData?.department_ids,
    auth_ids: prevProps.settingData?.auth_ids,
    provider_key_ids:
      prevProps.settingData?.provider_key_ids,
    auth_key_ids:
      prevProps.settingData?.auth_key_ids,
    role_ids: prevProps.settingData?.role_ids,
    role_route_ids: prevProps.settingData?.role_route_ids,
  };
  const nextIds = {
    name_id: nextProps.settingData?.name_id,
    description_id: nextProps.settingData?.description_id,
    color_ids: nextProps.settingData?.color_ids,
    active_flag_id: nextProps.settingData?.active_flag_id,
    department_ids: nextProps.settingData?.department_ids,
    auth_ids: nextProps.settingData?.auth_ids,
    provider_key_ids:
      nextProps.settingData?.provider_key_ids,
    auth_key_ids:
      nextProps.settingData?.auth_key_ids,
    role_ids: nextProps.settingData?.role_ids,
    role_route_ids: nextProps.settingData?.role_route_ids,
  };

  // Compare primitive props
  if (
    prevProps.settingId !== nextProps.settingId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.saveSettingAction !== nextProps.saveSettingAction ||
    prevProps.patchSettingDraftAction !== nextProps.patchSettingDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createColorsAction !== nextProps.createColorsAction ||
    prevProps.createFlagsAction !== nextProps.createFlagsAction ||
    prevProps.createDepartmentsAction !== nextProps.createDepartmentsAction ||
    prevProps.createProviderKeysAction !== nextProps.createProviderKeysAction ||
    prevProps.getProviderKeysAction !== nextProps.getProviderKeysAction ||
    prevProps.createAuthKeysAction !== nextProps.createAuthKeysAction ||
    prevProps.getAuthKeysAction !== nextProps.getAuthKeysAction ||
    prevProps.createRoleRoutesAction !== nextProps.createRoleRoutesAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
