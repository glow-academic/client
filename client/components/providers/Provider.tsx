/**
 * Provider.tsx
 * Implementation using modular resource components
 * Used to create and manage providers - supports both creation and editing
 * Follows personas pattern with resource components
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
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
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
import { parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
type SaveProviderIn = InputOf<"/api/v4/providers/save", "post">;
type SaveProviderOut = OutputOf<"/api/v4/providers/save", "post">;
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
type PatchProviderDraftIn = InputOf<"/api/v4/providers/draft", "patch">;
type PatchProviderDraftOut = OutputOf<"/api/v4/providers/draft", "patch">;

type ProviderData = OutputOf<"/api/v4/providers/get", "post">;

export interface ProviderProps {
  providerId?: string;
  // Server-provided data (for server-side rendering)
  providerData?: ProviderData;
  // Server actions (replaces useMutation)
  saveProviderAction?: (input: SaveProviderIn) => Promise<SaveProviderOut>;
  patchProviderDraftAction?: (
    input: PatchProviderDraftIn
  ) => Promise<PatchProviderDraftOut>;
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
}

function ProviderComponent({
  providerId,
  providerData,
  saveProviderAction,
  patchProviderDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createFlagsAction,
}: ProviderProps) {
  const router = useRouter();
  const isEditMode = !!providerId;
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

  const isGenerating = useCallback(
    (resourceType: ResourceType) => generatingResources.has(resourceType),
    [generatingResources]
  );

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  // Memoize to prevent new object reference on every render
  const providerSearchParamsClient = useMemo(
    () => ({
      // Draft ID (URL-backed, updated when draft is created)
      draftId: parseAsString,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  // Display values are managed inside resource components
  // Use ref to store providerData to prevent callback recreation on every render
  const providerDataRef = React.useRef(providerData);
  React.useEffect(() => {
    providerDataRef.current = providerData;
  }, [providerData]);

  // Memoize providerData fields used in renderStep to prevent callback recreation
  // when only object reference changes (but content is same)
  const stableProviderDataFields = React.useMemo(() => {
    if (!providerData) return null;
    return {
      group_id: providerData.group_id,
      name_resource: providerData.name_resource,
      show_name: providerData.show_name,
      name_suggestions: providerData.name_suggestions,
      names: providerData.names,
      name_required: providerData.name_required,
      name_agent_id: providerData.name_agent_id,
      description_resource: providerData.description_resource,
      show_description: providerData.show_description,
      description_suggestions: providerData.description_suggestions,
      description_required: providerData.description_required,
      description_agent_id: providerData.description_agent_id,
      descriptions: providerData.descriptions,
      flag_resource: providerData.flag_resource,
      show_flag: providerData.show_flag,
      flag_required: providerData.flag_required,
      flag_agent_id: providerData.flag_agent_id,
      flags: providerData.flags,
    };
    // Intentionally depend on individual fields, not whole providerData object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    providerData?.group_id,
    providerData?.name_resource,
    providerData?.show_name,
    providerData?.name_suggestions,
    providerData?.names,
    providerData?.name_required,
    providerData?.name_agent_id,
    providerData?.description_resource,
    providerData?.show_description,
    providerData?.description_suggestions,
    providerData?.description_required,
    providerData?.description_agent_id,
    providerData?.descriptions,
    providerData?.flag_resource,
    providerData?.show_flag,
    providerData?.flag_required,
    providerData?.flag_agent_id,
    providerData?.flags,
  ]);

  // Helper to check if a resource type can be regenerated
  const canRegenerate = useCallback(
    (resourceType: ResourceType): boolean => {
      if (!stableProviderDataFields) return false;
      switch (resourceType) {
        case "names":
          return stableProviderDataFields.name_resource?.generated ?? false;
        case "descriptions":
          return (
            stableProviderDataFields.description_resource?.generated ?? false
          );
        case "flags":
          return stableProviderDataFields.flag_resource?.generated ?? false;
        default:
          return false;
      }
    },
    [stableProviderDataFields]
  );

  const getInitialFormState = useCallback(() => {
    const data = providerDataRef.current;
    if (!data) {
      return {
        name_id: null as string | null,
        description_id: null as string | null,
        active_flag_id: null as string | null,
      };
    }
    // Extract resource IDs from server data
    return {
      name_id: data.name_id ?? null,
      description_id: data.description_id ?? null,
      active_flag_id: data.active_flag_id ?? null,
    };
  }, []);

  const [formState, setFormState] = useState(getInitialFormState);
  // Use ref to access formState in renderStep without depending on it
  const formStateRef = React.useRef(formState);
  React.useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      // Only update if resource IDs actually changed
      if (
        prev.name_id !== newState.name_id ||
        prev.description_id !== newState.description_id ||
        prev.active_flag_id !== newState.active_flag_id
      ) {
        return newState;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    providerData?.name_id,
    providerData?.description_id,
    providerData?.active_flag_id,
  ]);

  // Draft version tracking for optimistic concurrency control
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = React.useRef(0);
  React.useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    providerData && "draft_version" in providerData
      ? (providerData as { draft_version?: number | null }).draft_version
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

  // Use ref to stabilize patchProviderDraftAction to prevent effect recreation when prop reference changes
  const patchProviderDraftActionRef = React.useRef(patchProviderDraftAction);
  React.useEffect(() => {
    patchProviderDraftActionRef.current = patchProviderDraftAction;
  }, [patchProviderDraftAction]);

  // Build a stable key for "what would we patch" - only changes when form data actually changes
  const draftPatchKey = React.useMemo(() => {
    return JSON.stringify({
      draftId: draftId || null,
      name_id: formState.name_id,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
    });
  }, [
    draftId,
    formState.name_id,
    formState.description_id,
    formState.active_flag_id,
  ]);

  // Track last patched payload so we don't repatch identical state
  const lastPatchedKeyRef = React.useRef<string | null>(null);

  // Draft change listener - watches resource IDs and patches draft
  useEffect(() => {
    const hasResourceIds =
      formState.name_id || formState.description_id || formState.active_flag_id;

    if (!hasResourceIds || !patchProviderDraftActionRef.current) {
      return;
    }

    // If nothing changed since the last successful patch, do nothing.
    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchProviderDraftActionRef.current) return;
        const result = await patchProviderDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            active_flag_id: formState.active_flag_id,
            expected_version: lastSavedVersionRef.current,
          },
        });

        // Mark this payload as patched so we don't loop
        lastPatchedKeyRef.current = draftPatchKey;

        if (!draftId && result.draft_id) {
          // Update URL when draft is created via GenericForm bridge
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPatchKey]);

  // WebSocket handlers for AI generation
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Use single group_id from providerData
    const currentGroupId = providerData?.group_id;

    const handleGenerationComplete = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      name_id?: string | null;
      description_id?: string | null;
      active_flag_id?: string | null;
      message?: string;
      success?: boolean;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "provider" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this provider or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
      ];
      if (
        data.resource_type &&
        validResourceTypes.includes(data.resource_type as ResourceType)
      ) {
        // Update formState with the resource ID that was generated
        setFormState((prev) => {
          const updates: Partial<typeof prev> = {};

          if (data.name_id) updates.name_id = data.name_id;
          if (data.description_id) updates.description_id = data.description_id;
          if (data.active_flag_id) updates.active_flag_id = data.active_flag_id;

          return { ...prev, ...updates };
        });

        setGeneratingResources((prev) => {
          const next = new Set(prev);
          next.delete(data.resource_type as ResourceType);
          return next;
        });
        if (data.success) {
          toast.success(
            data.message || `${data.resource_type} generated successfully`
          );
        } else {
          toast.error(
            data.message || `Failed to generate ${data.resource_type}`
          );
        }
      }
    };

    const handleGenerationProgress = (data: {
      artifact_type?: string;
      group_id?: string;
      resource_type?: string;
      [key: string]: unknown;
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "provider" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this provider or wrong group_id
      }
      // Handle progress updates if needed
    };

    const handleGenerationError = (data: {
      artifact_type?: string;
      group_id?: string;
      message?: string;
      resource_type?: string;
      resource_types?: string[];
    }) => {
      // Filter by artifact_type and group_id
      if (
        data.artifact_type !== "provider" ||
        !data.group_id ||
        data.group_id !== currentGroupId
      ) {
        return; // Not for this provider or wrong group_id
      }

      const validResourceTypes: ResourceType[] = [
        "names",
        "descriptions",
        "flags",
      ];
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

    // Listen to provider-specific events filtered by artifact_type and group_id
    socket.on("provider_generation_progress", handleGenerationProgress);
    socket.on("provider_generation_complete", handleGenerationComplete);
    socket.on("provider_generation_error", handleGenerationError);

    return () => {
      socket.off("provider_generation_progress", handleGenerationProgress);
      socket.off("provider_generation_complete", handleGenerationComplete);
      socket.off("provider_generation_error", handleGenerationError);
    };
  }, [socket, isConnected, providerData?.group_id]);

  // Generation handler - accepts list of resource types
  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      // Set all resources as generating
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      // Read search params from formData
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      // Emit provider_generate event
      socket.emit("provider_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
        mcp: false,
        provider_id: providerId || null,
      });
    },
    [socket, isConnected, providerId]
  );

  // Individual generation handlers
  const handleGenerateName = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources]
  );

  const handleGenerateDescription = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources]
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"]),
    [handleGenerateResources]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      // Check if generation is available (provider has generation capability)
      if (providerData?.general_agent_id) {
        // Generate all available resources
        handleGenerateResources(["names", "descriptions", "flags"]);
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [providerData?.general_agent_id, handleGenerateResources]);

  // Disabled logic based on can_edit flag - check in both new and edit modes
  const disabled = useMemo(() => {
    if (!providerData) return false;
    return !providerData.can_edit;
  }, [providerData]);

  // Set breadcrumb context when provider data is loaded
  useEffect(() => {
    const providerName = providerData?.name_resource?.name;
    if (providerName && providerId && isEditMode) {
      setEntityMetadata({
        entityId: providerId,
        entityName: providerName,
        entityType: "provider",
      });
    }
    return () => clearEntityMetadata();
  }, [
    providerData,
    providerId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Submit handler for GenericForm (uses formState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      // Validate required resource IDs using {resource}_required flags from providerData
      if (providerData?.name_required && !formState.name_id) {
        toast.error("Provider name is required");
        throw new Error("Provider name is required");
      }

      if (!saveProviderAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      try {
        await saveProviderAction({
          body: {
            input_provider_id: isEditMode && providerId ? providerId : null,
            name_id: formState.name_id,
            description_id: formState.description_id || null,
            active_flag_id: formState.active_flag_id || null,
          },
        });
        toast.success(
          `Provider ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/system/providers");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} provider: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        throw error;
      }
    },
    [
      formState,
      isEditMode,
      providerId,
      providerData?.name_required,
      saveProviderAction,
      router,
    ]
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState.name_id]
  );

  // Steps configuration
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the provider name, description, and active status.",
        resetFields: [
          "name_id",
          "description_id",
          "active_flag_id",
        ] as string[],
      },
    ],
    []
  );

  // Memoize formFieldKeys
  const formFieldKeys = useMemo(
    () => ["name_id", "description_id", "active_flag_id"],
    []
  );

  // Memoize resetSuccessMessage
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
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
          };
        default:
          return prev;
      }
    });
  }, []);

  // Memoize submitButton
  const submitButton = useMemo(
    () => ({
      backUrl: "/system/providers",
      backLabel: "Back",
      createLabel: "Create Provider",
      updateLabel: "Update Provider",
    }),
    []
  );

  // Step-to-resources mapping
  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags"],
    }),
    []
  );

  // Memoize renderStep
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
      onReset?: () => void;
    }) => {
      // Use memoized fields to avoid dependency on providerData object reference
      const currentProviderData = stableProviderDataFields;
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
                  name_resource={currentProviderData?.name_resource ?? null}
                  show_name={currentProviderData?.show_name ?? true}
                  name_suggestions={currentProviderData?.name_suggestions ?? []}
                  names={currentProviderData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateName}
                  isGenerating={isGenerating("names")}
                  placeholder="e.g., OpenAI"
                  defaultName="New Provider"
                  required={currentProviderData?.name_required ?? false}
                  hideDescription={true}
                  group_id={currentProviderData?.group_id ?? null}
                  agent_id={currentProviderData?.name_agent_id ?? null}
                  createNamesAction={createNamesAction}
                />
              }
              resetFields={["name_id", "description_id", "active_flag_id"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["basic"] && stepResources["basic"].length > 0 ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            handleGenerateResources(stepResources["basic"]!);
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
            >
              <div className="space-y-6">
                {/* Description */}
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    currentProviderData?.description_resource ?? null
                  }
                  show_description={
                    currentProviderData?.show_description ?? true
                  }
                  description_suggestions={
                    currentProviderData?.description_suggestions ?? []
                  }
                  descriptions={currentProviderData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                    }))
                  }
                  onGenerate={handleGenerateDescription}
                  isGenerating={isGenerating("descriptions")}
                  label="Description"
                  placeholder="Enter a brief description (optional)"
                  required={currentProviderData?.description_required ?? false}
                  rows={3}
                  group_id={currentProviderData?.group_id ?? null}
                  agent_id={currentProviderData?.description_agent_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                />

                {/* Active Switch - using Flags resource component */}
                <Flags
                  flag_id={formState.active_flag_id ?? null}
                  flag_resource={currentProviderData?.flag_resource ?? null}
                  show_flag={currentProviderData?.show_flag ?? false}
                  flags={currentProviderData?.flags ?? []}
                  disabled={disabled}
                  onFlagIdChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                  isGenerating={isGenerating("flags")}
                  label="Active"
                  helpText="Inactive providers will not be available for selection"
                  required={currentProviderData?.flag_required ?? false}
                  group_id={currentProviderData?.group_id ?? null}
                  agent_id={currentProviderData?.flag_agent_id ?? null}
                  createFlagsAction={createFlagsAction}
                />
              </div>
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      stableProviderDataFields,
      disabled,
      isEditMode,
      handleGenerateName,
      handleGenerateDescription,
      handleGenerateFlags,
      isGenerating,
      stepResources,
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      createNamesAction,
      createDescriptionsAction,
      createFlagsAction,
      canRegenerate,
      handleGenerateResources,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`provider-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={providerData?.disabled_reason ?? null}
          entityType="provider"
        />

        <GenericForm
          nuqsParsers={
            providerSearchParamsClient as Record<string, Parser<unknown>>
          }
        steps={steps}
        getStepStatus={getStepStatus}
        serverData={providerData}
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
      </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change (content is same)
export default React.memo(ProviderComponent, (prevProps, nextProps) => {
  // Compare providerData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.providerData?.name_id,
    description_id: prevProps.providerData?.description_id,
    active_flag_id: prevProps.providerData?.active_flag_id,
  };
  const nextIds = {
    name_id: nextProps.providerData?.name_id,
    description_id: nextProps.providerData?.description_id,
    active_flag_id: nextProps.providerData?.active_flag_id,
  };

  // Compare primitive props
  if (
    prevProps.providerId !== nextProps.providerId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference (should be stable from server actions)
  if (
    prevProps.saveProviderAction !== nextProps.saveProviderAction ||
    prevProps.patchProviderDraftAction !== nextProps.patchProviderDraftAction ||
    prevProps.createNamesAction !== nextProps.createNamesAction ||
    prevProps.createDescriptionsAction !== nextProps.createDescriptionsAction ||
    prevProps.createFlagsAction !== nextProps.createFlagsAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
