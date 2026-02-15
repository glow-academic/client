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
import type { GenerateRegenerateModalResource } from "@/components/common/forms/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { AuthItemKeys } from "@/components/resources/AuthItemKeys";
import { Auths } from "@/components/resources/Auths";
import { Colors } from "@/components/resources/Colors";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags, type FlagConfig } from "@/components/resources/Flags";
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
import { useDrafts } from "@/contexts/draft-context";
import { useProfile } from "@/contexts/profile-context";
import { useSocket } from "@/contexts/socket-context";
import { useArtifactGeneration } from "@/hooks/use-artifact-generation";
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
  createAuthItemKeysAction?: (input: {
    auth_id: string;
    key_id: string;
  }) => Promise<{ auth_item_keys_id?: string | null }>;
  getAuthItemKeysAction?: (ids: string[]) => Promise<
    Array<{
      id?: string | null;
      auth_id?: string | null;
      item_id?: string | null;
      key_id?: string | null;
      auth_name?: string | null;
      key_name?: string | null;
      key_description?: string | null;
      generated?: boolean | null;
    }>
  >;
}

function SettingComponent({
  settingId,
  settingData,
  saveSettingAction,
  patchSettingDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createColorsAction,
  createProviderKeysAction,
  getProviderKeysAction,
  createAuthItemKeysAction,
  getAuthItemKeysAction,
}: SettingProps) {
  const router = useRouter();
  const isEditMode = !!settingId;
  const { profile } = useProfile();
  const { selectedDraftId, setSelectedDraftId } = useDrafts();
  const { socket, isConnected } = useSocket();
  // Generation state for AI workflows
  const VALID_SETTING_RESOURCE_TYPES: ResourceType[] = [
    "names", "descriptions", "colors", "flags", "departments",
  ];
  const { isGenerating, startGenerating, makeOnGenerationComplete } =
    useArtifactGeneration({
      artifactType: "setting",
      groupId: settingData?.group_id,
      validResourceTypes: VALID_SETTING_RESOURCE_TYPES,
    });

  // Modal state for generate/regenerate
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

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
      // Names (single-select section)
      name_resource: settingData.names?.resource ?? null,
      show_name: settingData.names?.show ?? true,
      name_suggestions: settingData.names?.suggestions ?? [],
      names: settingData.names?.resources ?? [],
      name_required: settingData.names?.required ?? false,
      name_agent_id: settingData.resource_agent_ids?.names ?? null,
      // Descriptions (single-select section)
      description_resource: settingData.descriptions?.resource ?? null,
      show_description: settingData.descriptions?.show ?? true,
      description_suggestions: settingData.descriptions?.suggestions ?? [],
      description_required: settingData.descriptions?.required ?? false,
      description_agent_id: settingData.resource_agent_ids?.descriptions ?? null,
      descriptions: settingData.descriptions?.resources ?? [],
      // Departments (multi-select section)
      department_resources: settingData.departments?.current ?? [],
      show_departments: settingData.departments?.show ?? false,
      department_suggestions: settingData.departments?.suggestions ?? [],
      departments_required: settingData.departments?.required ?? false,
      departments_agent_id: settingData.resource_agent_ids?.departments ?? null,
      departments: settingData.departments?.resources ?? [],
      department_ids: (settingData.departments?.current ?? []).map((d: { id?: string | null }) => d.id).filter(Boolean),
      // Profiles (multi-select section)
      profile_resources: settingData.profiles?.current ?? [],
      show_profiles: settingData.profiles?.show ?? false,
      profile_suggestions: settingData.profiles?.suggestions ?? [],
      profiles_required: settingData.profiles?.required ?? false,
      profiles_agent_id: settingData.resource_agent_ids?.profiles ?? null,
      profiles: settingData.profiles?.resources ?? [],
      profile_ids: (settingData.profiles?.current ?? []).map((p: { id?: string | null }) => p.id).filter(Boolean),
      // Flags (single-select section)
      flag_resource: settingData.flags?.current ?? null,
      show_flag: settingData.flags?.show ?? false,
      flag_required: settingData.flags?.required ?? false,
      flag_agent_id: settingData.resource_agent_ids?.flags ?? null,
      // Colors (multi-select section)
      color_resources: settingData.colors?.current ?? [],
      show_colors: settingData.colors?.show ?? false,
      color_suggestions: settingData.colors?.suggestions ?? [],
      colors_required: settingData.colors?.required ?? false,
      colors_agent_id: settingData.resource_agent_ids?.colors ?? null,
      colors: settingData.colors?.resources ?? [],
      color_ids: (settingData.colors?.current ?? []).map((c: { id?: string | null }) => c.id).filter(Boolean),
      // Auths (multi-select section)
      auth_resources: settingData.auths?.current ?? [],
      show_auths: settingData.auths?.show ?? false,
      auth_suggestions: settingData.auths?.suggestions ?? [],
      auths_required: settingData.auths?.required ?? false,
      auths_agent_id: settingData.resource_agent_ids?.auths ?? null,
      auths: settingData.auths?.resources ?? [],
      auth_ids: (settingData.auths?.current ?? []).map((a: { id?: string | null }) => a.id).filter(Boolean),
      // Provider keys (multi-select section)
      provider_key_ids: (settingData.provider_keys?.current ?? []).map((pk: { id?: string | null }) => pk.id).filter(Boolean),
      providers:
        ((settingData as Record<string, unknown>)["providers"] as
          | Array<{
              provider_id?: string | null;
              name?: string | null;
              description?: string | null;
            }>
          | null
          | undefined) ?? [],
      provider_key_resources: settingData.provider_keys?.current ?? [],
      // Auth item keys (multi-select section)
      auth_item_key_resources: settingData.auth_item_keys?.current ?? [],
      // Keys - not a section in the API, check if it exists
      key_resources: ((settingData as Record<string, unknown>)["key_resources"] as unknown[]) ?? [],
      show_keys: ((settingData as Record<string, unknown>)["show_keys"] as boolean) ?? false,
      key_suggestions: ((settingData as Record<string, unknown>)["key_suggestions"] as string[]) ?? [],
      keys_required: ((settingData as Record<string, unknown>)["keys_required"] as boolean) ?? false,
      keys_agent_id: settingData.resource_agent_ids?.keys ?? null,
      keys: ((settingData as Record<string, unknown>)["keys"] as unknown[]) ?? [],
      key_ids: ((settingData as Record<string, unknown>)["key_ids"] as string[]) ?? [],
      // Roles (multi-select section)
      role_ids: (settingData.roles?.current ?? []).map((r: { id?: string | null }) => r.id).filter(Boolean),
      role_resources: settingData.roles?.current ?? [],
      show_roles: settingData.roles?.show ?? false,
      roles_required: settingData.roles?.required ?? false,
      roles: settingData.roles?.resources ?? [],
      // Role routes (multi-select section)
      route_resources: settingData.role_routes?.current ?? [],
      show_routes: settingData.role_routes?.show ?? false,
      routes_required: settingData.role_routes?.required ?? false,
      routes: settingData.role_routes?.resources ?? [],
      role_route_ids: (settingData.role_routes?.current ?? []).map((rr: { id?: string | null }) => rr.id).filter(Boolean),
      role_route_resources: settingData.role_routes?.current ?? [],
      show_role_routes: settingData.role_routes?.show ?? false,
      role_routes: settingData.role_routes?.resources ?? [],
    };
    // Intentionally depend on individual fields, not whole settingData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settingData?.group_id,
    // Names section
    settingData?.names?.resource,
    settingData?.names?.show,
    settingData?.names?.suggestions,
    settingData?.names?.resources,
    settingData?.names?.required,
    settingData?.resource_agent_ids?.names,
    settingData?.descriptions?.resource,
    settingData?.descriptions?.show,
    settingData?.descriptions?.suggestions,
    settingData?.descriptions?.required,
    settingData?.resource_agent_ids?.descriptions,
    settingData?.descriptions?.resources,
    // Departments section
    settingData?.departments?.current,
    settingData?.departments?.show,
    settingData?.departments?.suggestions,
    settingData?.departments?.required,
    settingData?.departments?.resources,
    settingData?.resource_agent_ids?.departments,
    // Profiles section
    settingData?.profiles?.current,
    settingData?.profiles?.show,
    settingData?.profiles?.suggestions,
    settingData?.profiles?.required,
    settingData?.profiles?.resources,
    settingData?.resource_agent_ids?.profiles,
    // Flags section
    settingData?.flags?.current,
    settingData?.flags?.show,
    settingData?.flags?.required,
    settingData?.resource_agent_ids?.flags,
    // Colors section
    settingData?.colors?.current,
    settingData?.colors?.show,
    settingData?.colors?.suggestions,
    settingData?.colors?.required,
    settingData?.colors?.resources,
    settingData?.resource_agent_ids?.colors,
    // Auths section
    settingData?.auths?.current,
    settingData?.auths?.show,
    settingData?.auths?.suggestions,
    settingData?.auths?.required,
    settingData?.auths?.resources,
    settingData?.resource_agent_ids?.auths,
    // Provider keys section
    settingData?.provider_keys?.current,
    // Auth item keys section
    settingData?.auth_item_keys?.current,
    // Roles section
    settingData?.roles?.current,
    settingData?.roles?.show,
    settingData?.roles?.required,
    settingData?.roles?.resources,
    // Role routes section
    settingData?.role_routes?.current,
    settingData?.role_routes?.show,
    settingData?.role_routes?.required,
    settingData?.role_routes?.resources,
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
        key_ids: [] as string[],
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
      key_ids: data.key_ids ?? [],
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
    () => JSON.stringify(settingData?.key_ids ?? []),
    [settingData?.key_ids]
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
    () => JSON.stringify(formState.key_ids),
    [formState.key_ids]
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
        JSON.stringify(prev.key_ids) !== JSON.stringify(newState.key_ids) ||
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
      key_ids: formState.key_ids,
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
      formState.key_ids.length > 0 ||
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
            group_id: settingData?.group_id ?? null,
            name_id: formState.name_id || null,
            description_id: formState.description_id || null,
            flag_id: formState.active_flag_id || null,
            color_ids: formState.color_ids.length > 0 ? formState.color_ids : null,
            department_ids: formState.department_ids.length > 0 ? formState.department_ids : null,
            profile_ids: formState.profile_ids.length > 0 ? formState.profile_ids : null,
            auth_ids: formState.auth_ids.length > 0 ? formState.auth_ids : null,
            provider_key_ids: formState.provider_key_ids.length > 0 ? formState.provider_key_ids : null,
            auth_item_key_ids: formState.key_ids.length > 0 ? formState.key_ids : null,
            role_ids: formState.role_ids.length > 0 ? formState.role_ids : null,
            role_route_ids: formState.role_route_ids.length > 0 ? formState.role_route_ids : null,
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
            name_id: formState.name_id!,
            description_id: formState.description_id || null,
            flag_id: formState.active_flag_id || null,
            color_ids: formState.color_ids.length > 0 ? formState.color_ids : null,
            department_ids: formState.department_ids.length > 0 ? formState.department_ids : null,
            profile_ids: formState.profile_ids.length > 0 ? formState.profile_ids : null,
            auth_ids: formState.auth_ids.length > 0 ? formState.auth_ids : null,
            provider_key_ids: formState.provider_key_ids.length > 0 ? formState.provider_key_ids : null,
            auth_item_key_ids: formState.key_ids.length > 0 ? formState.key_ids : null,
            role_ids: formState.role_ids.length > 0 ? formState.role_ids : null,
            role_route_ids: formState.role_route_ids.length > 0 ? formState.role_route_ids : null,
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
      configuration: [], // No generation for auths/provider_keys/auth_item_keys yet
      all: ["names", "descriptions", "colors", "flags", "departments"], // All resources for full-page generation
    }),
    []
  );

  // Resource labels for display
  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
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

      startGenerating(resourceTypes);

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
    [socket, isConnected, settingId, startGenerating]
  );

  // Handler to open modal for step card generation
  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt] ?? rt,
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
    const handleFullPageGenerate = () => {
      handleOpenStepCardModal("all", "generate");
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
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
        resetFields: ["profile_ids", "auth_ids", "provider_key_ids", "key_ids"],
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
      "key_ids",
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
            key_ids: [],
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
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flags={currentSettingData?.flag_resource ? [currentSettingData.flag_resource as unknown as FlagConfig] : []}
                  flag_id={formState.active_flag_id ?? null}
                  show_flags={currentSettingData?.show_flag ?? false}
                  columns={1}
                  label="Active"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  group_id={currentSettingData?.group_id ?? null}
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
              resetFields={["profile_ids", "auth_ids", "provider_key_ids", "key_ids"]}
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
                  show_provider_keys={currentSettingData?.show_keys ?? false}
                  createProviderKeysAction={createProviderKeysAction}
                  getProviderKeysAction={getProviderKeysAction}
                />

                <AuthItemKeys
                  auth_item_key_ids={formState.key_ids ?? []}
                  auth_item_key_resources={currentSettingData?.auth_item_key_resources ?? []}
                  auths={currentSettingData?.auths ?? []}
                  keys={currentSettingData?.keys ?? []}
                  selected_auth_ids={formState.auth_ids ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, key_ids: ids }))
                  }
                  show_auth_item_keys={currentSettingData?.show_auths ?? false}
                  createAuthItemKeysAction={createAuthItemKeysAction}
                  getAuthItemKeysAction={getAuthItemKeysAction}
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
      formState.key_ids,
      formState.role_ids,
      formState.role_route_ids,
      createNamesAction,
      createDescriptionsAction,
      createColorsAction,
      createProviderKeysAction,
      getProviderKeysAction,
      createAuthItemKeysAction,
      getAuthItemKeysAction,
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
    key_ids:
      prevProps.settingData?.key_ids,
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
    key_ids:
      nextProps.settingData?.key_ids,
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
    prevProps.createProviderKeysAction !== nextProps.createProviderKeysAction ||
    prevProps.getProviderKeysAction !== nextProps.getProviderKeysAction ||
    prevProps.createAuthItemKeysAction !== nextProps.createAuthItemKeysAction ||
    prevProps.getAuthItemKeysAction !== nextProps.getAuthItemKeysAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
