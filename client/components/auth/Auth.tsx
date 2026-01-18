/**
 * Auth.tsx
 * Implementation using modular resource components
 * Used to create and manage auth - supports both creation and editing
 * Follows Persona.tsx pattern exactly but adapted for auth resources
 */
"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AuthItemCardGrid,
  type AuthItemCard,
} from "@/components/auth/AuthItemCardGrid";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Protocols } from "@/components/resources/Protocols";
import { Slugs } from "@/components/resources/Slugs";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useGenerationContext } from "@/contexts/generation-context";
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveAuthIn = InputOf<"/api/v4/auths/save", "post">;
type SaveAuthOut = OutputOf<"/api/v4/auths/save", "post">;
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
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftProtocolsIn = InputOf<"/api/v4/resources/protocols", "post">;
type CreateDraftProtocolsOut = OutputOf<"/api/v4/resources/protocols", "post">;
type CreateDraftSlugsIn = InputOf<"/api/v4/resources/slugs", "post">;
type CreateDraftSlugsOut = OutputOf<"/api/v4/resources/slugs", "post">;
type PatchAuthDraftIn = InputOf<"/api/v4/auth/draft", "patch">;
type PatchAuthDraftOut = OutputOf<"/api/v4/auth/draft", "patch">;

type AuthData = OutputOf<"/api/v4/auths/get", "post">;

export interface AuthProps {
  authId?: string;
  // Server-provided data (for server-side rendering)
  authData?: AuthData;
  // Server actions (replaces useMutation)
  saveAuthAction?: (input: SaveAuthIn) => Promise<SaveAuthOut>;
  patchAuthDraftAction?: (
    input: PatchAuthDraftIn
  ) => Promise<PatchAuthDraftOut>;
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createProtocolsAction?: (
    input: CreateDraftProtocolsIn
  ) => Promise<CreateDraftProtocolsOut>;
  createSlugsAction?: (
    input: CreateDraftSlugsIn
  ) => Promise<CreateDraftSlugsOut>;
}

function AuthComponent({
  authId,
  authData,
  saveAuthAction,
  patchAuthDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createFlagsAction,
  createProtocolsAction,
  createSlugsAction,
}: AuthProps) {
  const router = useRouter();
  const isEditMode = !!authId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { setGenerationCapability, clearGenerationCapability } =
    useGenerationContext();

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const authSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
      // Search params (URL-backed, updated via debounced callback in StepCard)
      descriptionSearch: parseAsString,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store authData to prevent callback recreation on every render
  const authDataRef = React.useRef(authData);
  React.useEffect(() => {
    authDataRef.current = authData;
  }, [authData]);

  // Memoize authData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableAuthDataFields = React.useMemo(() => {
    if (!authData) return null;
    return {
      group_id: authData.group_id,
      name_resource: authData.name_resource,
      show_name: authData.show_name,
      name_suggestions: authData.name_suggestions,
      names: authData.names,
      name_required: authData.name_required,
      name_agent_id: authData.name_agent_id,
      description_resource: authData.description_resource,
      show_description: authData.show_description,
      description_suggestions: authData.description_suggestions,
      description_required: authData.description_required,
      description_agent_id: authData.description_agent_id,
      descriptions: authData.descriptions,
      flag_resource: authData.flag_resource,
      show_flag: authData.show_flag,
      flag_required: authData.flag_required,
      flag_agent_id: authData.flag_agent_id,
      protocol_resources: authData.protocol_resources,
      show_protocols: authData.show_protocols,
      protocol_suggestions: authData.protocol_suggestions,
      protocols_required: authData.protocols_required,
      protocols_agent_id: authData.protocols_agent_id,
      protocols: authData.protocols,
      slug_resources: authData.slug_resources,
      show_slugs: authData.show_slugs,
      slug_suggestions: authData.slug_suggestions,
      slugs_required: authData.slugs_required,
      slugs_agent_id: authData.slugs_agent_id,
      slugs: authData.slugs,
      auth_items: authData.auth_items,
    };
    // Intentionally depend on individual fields, not whole authData object
    // to prevent recreation when only object reference changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authData?.group_id,
    authData?.name_resource,
    authData?.show_name,
    authData?.name_suggestions,
    authData?.names,
    authData?.name_required,
    authData?.name_agent_id,
    authData?.description_resource,
    authData?.show_description,
    authData?.description_suggestions,
    authData?.description_required,
    authData?.description_agent_id,
    authData?.descriptions,
    authData?.flag_resource,
    authData?.show_flag,
    authData?.flag_required,
    authData?.flag_agent_id,
    authData?.protocol_resources,
    authData?.show_protocols,
    authData?.protocol_suggestions,
    authData?.protocols_required,
    authData?.protocols_agent_id,
    authData?.protocols,
    authData?.slug_resources,
    authData?.show_slugs,
    authData?.slug_suggestions,
    authData?.slugs_required,
    authData?.slugs_agent_id,
    authData?.slugs,
    authData?.auth_items,
  ]);

  const getInitialFormState = useCallback(() => {
    const data = authDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
        protocol_ids: [] as string[],
        slug_ids: [] as string[],
        auth_items: [] as Array<{
          name: string;
          description: string;
          encrypted: boolean;
          position: number;
          active: boolean;
          key_id: string | null;
        }>,
      };
    }
    // Extract resource IDs from server data
    // Note: Server data may have display values, but we only store IDs here
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
      protocol_ids: data.protocol_ids ?? [],
      slug_ids: data.slug_ids ?? [],
      auth_items:
        data.auth_items?.map((item) => ({
          name: item.name ?? "",
          description: item.description ?? "",
          encrypted: item.encrypted ?? false,
          position: item.position ?? 0,
          active: item.active ?? true,
          key_id: item.key_id ?? null,
        })) ?? [],
    };
    // Remove authData from dependencies - use ref instead to prevent callback recreation
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Memoize stringified array dependencies to prevent effect from running when array references change but content is same
  const protocolIdsStr = React.useMemo(
    () => JSON.stringify(authData?.protocol_ids ?? []),
    [authData?.protocol_ids]
  );
  const slugIdsStr = React.useMemo(
    () => JSON.stringify(authData?.slug_ids ?? []),
    [authData?.slug_ids]
  );

  // Memoize stringified formState arrays for draft listener effect dependencies
  const formStateProtocolIdsStr = React.useMemo(
    () => JSON.stringify(formState.protocol_ids),
    [formState.protocol_ids]
  );
  const formStateSlugIdsStr = React.useMemo(
    () => JSON.stringify(formState.slug_ids),
    [formState.slug_ids]
  );
  const formStateAuthItemsStr = React.useMemo(
    () => JSON.stringify(formState.auth_items),
    [formState.auth_items]
  );

  // Update form state when server data changes
  // Use authData directly in dependency array, not getInitialFormState
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id ||
        JSON.stringify(prev.protocol_ids) !==
          JSON.stringify(newState.protocol_ids) ||
        JSON.stringify(prev.slug_ids) !== JSON.stringify(newState.slug_ids) ||
        JSON.stringify(prev.auth_items) !== JSON.stringify(newState.auth_items)
      ) {
        return newState;
      }
      return prev;
    });
    // Use stringified arrays in dependencies to prevent effect from running when array references change but content is same
    // Intentionally exclude formState and getInitialFormState to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authData?.name_id,
    authData?.description_id,
    authData?.active_flag_id,
    protocolIdsStr,
    slugIdsStr,
    authData?.auth_items,
  ]);

  // Draft version tracking for optimistic concurrency control
  // Keep version in a ref so updating it doesn't retrigger the effect
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);

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

  // Use ref to stabilize patchAuthDraftAction to prevent effect recreation when prop reference changes
  const patchAuthDraftActionRef = React.useRef(patchAuthDraftAction);
  React.useEffect(() => {
    patchAuthDraftActionRef.current = patchAuthDraftAction;
  }, [patchAuthDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
      protocol_ids: formState.protocol_ids,
      slug_ids: formState.slug_ids,
      auth_items: formState.auth_items,
    });
    // Use stringified arrays to prevent recreation when array references change but content is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
    formStateProtocolIdsStr,
    formStateSlugIdsStr,
    formStateAuthItemsStr,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  // Only triggers when the payload actually changes, not when version changes
  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.active_flag_id ||
      formState.protocol_ids.length > 0 ||
      formState.slug_ids.length > 0 ||
      formState.auth_items.length > 0;

    if (!hasResourceIds || !patchAuthDraftActionRef.current) {
      return;
    }

    // ✅ If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchAuthDraftActionRef.current) return;
        const result = await patchAuthDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            active_flag_id: formState.active_flag_id,
            protocol_ids: formState.protocol_ids,
            slug_ids: formState.slug_ids,
            auth_items: formState.auth_items,
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
    // patchAuthDraftAction and setDraftId are accessed via refs to prevent effect recreation
    // when prop/function references change but functionality is the same
    // We access formState fields and draftId inside the effect, but depend on draftPatchKey
    // to prevent unnecessary effect recreation when individual fields change but payload is same
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftPatchKey, // ✅ trigger only when payload changes
    // patchAuthDraftAction and setDraftId are accessed via refs
  ]);

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!authData) return false;
    return !authData.can_edit;
  }, [authData]);

  // Set breadcrumb context when auth data is loaded
  useEffect(() => {
    const authName = authData?.name_resource?.name;
    if (authName && authId && isEditMode) {
      setEntityMetadata({
        entityId: authId,
        entityName: authName,
        entityType: "auth",
      });
    }
    return () => clearEntityMetadata();
  }, [authData, authId, isEditMode, setEntityMetadata, clearEntityMetadata]);

  // Set generation capability when auth data is loaded
  useEffect(() => {
    // Auth doesn't have general_agent_id like personas, so we'll check individual resource agents
    // For now, we'll set canGenerate to false - can be enhanced later with WebSocket support
    setGenerationCapability({
      artifactType: "auth",
      canGenerate: false,
      agentId: null,
    });
    return () => clearGenerationCapability();
  }, [setGenerationCapability, clearGenerationCapability]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from authData
      if (authData?.name_required && !formState.name_id) {
        toast.error("Auth name is required");
        throw new Error("Auth name is required");
      }

      if (authData?.description_required && !formState.description_id) {
        toast.error("Description is required");
        throw new Error("Description is required");
      }

      if (
        authData?.protocols_required &&
        (!formState.protocol_ids || formState.protocol_ids.length === 0)
      ) {
        toast.error("Protocols are required");
        throw new Error("Protocols are required");
      }

      if (
        authData?.slugs_required &&
        (!formState.slug_ids || formState.slug_ids.length === 0)
      ) {
        toast.error("Slugs are required");
        throw new Error("Slugs are required");
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveAuthAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      // Ensure required fields are present (TypeScript guard)
      if (!formState.name_id) {
        toast.error("Required fields are missing");
        throw new Error("Required fields are missing");
      }

      try {
        await saveAuthAction({
          body: {
            input_auth_id: isEditMode && authId ? authId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
            protocol_ids: formState.protocol_ids || [],
            slug_ids: formState.slug_ids || [],
            auth_items: formState.auth_items || [],
          },
        });
        toast.success(
          `Auth ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/system/auth");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} auth: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      authId,
      effectiveProfile?.id,
      saveAuthAction,
      router,
      authData?.name_required,
      authData?.description_required,
      authData?.protocols_required,
      authData?.slugs_required,
    ]
  );

  // Step status logic (for GenericForm) - check resource IDs instead of display values
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      // Check resource IDs from formState (components manage their own display state)
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasProtocols = formState.protocol_ids.length > 0;
      const hasSlugs = formState.slug_ids.length > 0;
      const hasItems = formState.auth_items.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "protocols":
          if (!hasName || !hasDescription) return "pending";
          return hasProtocols ? "completed" : "active";
        case "slugs":
          if (!hasName || !hasDescription) return "pending";
          return hasSlugs ? "completed" : "active";
        case "items":
          if (!hasName || !hasDescription) return "pending";
          return hasItems ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the auth name, description, and active status.",
        resetFields: ["name", "description", "active"],
      },
      {
        id: "protocols",
        title: "Protocols",
        description: "Select protocols for this auth.",
        resetFields: ["protocol_ids"],
      },
      {
        id: "slugs",
        title: "Slugs",
        description: "Select slugs for this auth.",
        resetFields: ["slug_ids"],
      },
      {
        id: "items",
        title: "Auth Items",
        description: "Add and configure auth items.",
        resetFields: ["auth_items"],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "active",
      "protocol_ids",
      "slug_ids",
      "auth_items",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "protocols":
        return "Protocols reset";
      case "slugs":
        return "Slugs reset";
      case "items":
        return "Auth items reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/system/auth",
      backLabel: "Back",
      createLabel: "Create Auth",
      updateLabel: "Update Auth",
    }),
    []
  );

  // Convert auth_items to AuthItemCard format for AuthItemCardGrid
  const authItemCards = useMemo(() => {
    return formState.auth_items.map((item, index) => ({
      id: `item-${index}`,
      name: item.name,
      description: item.description,
      encrypted: item.encrypted,
      active: item.active,
      position: item.position || index + 1,
      isNew: false,
    }));
  }, [formState.auth_items]);

  // Handle auth items change from AuthItemCardGrid
  const handleItemsChange = useCallback((items: AuthItemCard[]) => {
    setFormState((prev) => ({
      ...prev,
      auth_items: items.map((item) => ({
        name: item.name,
        description: item.description || "",
        encrypted: item.encrypted,
        position: item.position,
        active: item.active,
        key_id: null,
      })),
    }));
  }, []);

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
      // Use memoized fields to avoid dependency on authData object reference
      const currentAuthData = stableAuthDataFields;
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
                  name_resource={currentAuthData?.name_resource ?? null}
                  show_name={currentAuthData?.show_name ?? true}
                  name_suggestions={currentAuthData?.name_suggestions ?? []}
                  names={currentAuthData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  placeholder="e.g., OIDC Authentication"
                  defaultName="New Auth"
                  required={currentAuthData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentAuthData?.group_id ?? null}
                  agent_id={currentAuthData?.name_agent_id ?? null}
                  createNamesAction={
                    createNamesAction as
                      | ((
                          input: CreateDraftNamesIn
                        ) => Promise<CreateDraftNamesOut>)
                      | undefined
                  }
                />
              }
              resetFields={["name", "description", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                {/* Description field - using Descriptions resource component */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentAuthData?.description_resource ?? null
                  }
                  show_description={currentAuthData?.show_description ?? true}
                  description_suggestions={
                    currentAuthData?.description_suggestions ?? []
                  }
                  descriptions={currentAuthData?.descriptions ?? []}
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
                  placeholder="Describe this authentication method"
                  required={currentAuthData?.description_required ?? false}
                  rows={4}
                  data-testid="input-auth-description"
                  group_id={currentAuthData?.group_id ?? null}
                  agent_id={currentAuthData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentAuthData?.flag_resource ?? null}
                  show_flag={currentAuthData?.show_flag ?? false}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  label="Active"
                  helpText="Inactive auth methods will not be available"
                  required={currentAuthData?.flag_required ?? false}
                  group_id={currentAuthData?.group_id ?? null}
                  agent_id={currentAuthData?.flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
                />
              </div>
            </StepCard>
          );

        case "protocols":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["protocol_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Protocols
                protocol_ids={formState.protocol_ids ?? []}
                protocol_resources={currentAuthData?.protocol_resources ?? []}
                show_protocols={currentAuthData?.show_protocols ?? false}
                protocol_suggestions={
                  currentAuthData?.protocol_suggestions ?? []
                }
                protocols={currentAuthData?.protocols ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, protocol_ids: ids }))
                }
                required={currentAuthData?.protocols_required ?? false}
                group_id={currentAuthData?.group_id ?? null}
                agent_id={currentAuthData?.protocols_agent_id ?? null}
                createProtocolsAction={createProtocolsAction}
              />
            </StepCard>
          );

        case "slugs":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["slug_ids"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Slugs
                slug_ids={formState.slug_ids ?? []}
                slug_resources={currentAuthData?.slug_resources ?? []}
                show_slugs={currentAuthData?.show_slugs ?? false}
                slug_suggestions={currentAuthData?.slug_suggestions ?? []}
                slugs={currentAuthData?.slugs ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, slug_ids: ids }))
                }
                required={currentAuthData?.slugs_required ?? false}
                group_id={currentAuthData?.group_id ?? null}
                agent_id={currentAuthData?.slugs_agent_id ?? null}
                createSlugsAction={createSlugsAction}
              />
            </StepCard>
          );

        case "items":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["auth_items"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <AuthItemCardGrid
                items={authItemCards}
                onItemsChange={handleItemsChange}
                readonly={disabled}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      // Use stableAuthDataFields instead of authData to prevent callback recreation
      // when only object reference changes (but content is same)
      stableAuthDataFields,
      disabled,
      isEditMode,
      // Depend on individual formState fields instead of whole object to prevent callback recreation
      // when object reference changes but values are same
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      // Include arrays - they're used in the callback, but the formState sync effect ensures
      // they only change when content actually changes (not just reference)
      formState.protocol_ids,
      formState.slug_ids,
      formState.auth_items,
      authItemCards,
      handleItemsChange,
      createNamesAction,
      createDescriptionsAction,
      createFlagsAction,
      createProtocolsAction,
      createSlugsAction,
    ]
  );

  return (
    <div
      className="w-full p-6 space-y-8"
      data-page={`auth-${isEditMode ? "edit" : "new"}`}
    >
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={authData?.disabled_reason ?? null}
        entityType="auth"
      />

      <GenericForm
        nuqsParsers={authSearchParamsClient as Record<string, Parser<unknown>>}
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={authData}
        formFieldKeys={formFieldKeys}
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
    </div>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(AuthComponent, (prevProps, nextProps) => {
  // Compare authData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.authData?.name_id,
    description_id: prevProps.authData?.description_id,
    active_flag_id: prevProps.authData?.active_flag_id,
    protocol_ids: prevProps.authData?.protocol_ids,
    slug_ids: prevProps.authData?.slug_ids,
  };
  const nextIds = {
    name_id: nextProps.authData?.name_id,
    description_id: nextProps.authData?.description_id,
    active_flag_id: nextProps.authData?.active_flag_id,
    protocol_ids: nextProps.authData?.protocol_ids,
    slug_ids: nextProps.authData?.slug_ids,
  };

  // Compare primitive props
  if (
    prevProps.authId !== nextProps.authId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.saveAuthAction !== nextProps.saveAuthAction ||
    prevProps.patchAuthDraftAction !== nextProps.patchAuthDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createFlagsAction !== nextProps.createFlagsAction ||
    prevProps.createProtocolsAction !== nextProps.createProtocolsAction ||
    prevProps.createSlugsAction !== nextProps.createSlugsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
