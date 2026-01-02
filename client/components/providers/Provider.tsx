/**
 * Provider.tsx
 * Used to create and manage providers for the admin dashboard
 */
"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";

import type {
  CreateProviderIn,
  CreateProviderOut,
  PatchProviderDraftIn,
  PatchProviderDraftOut,
  ProviderNewOut,
} from "@/app/(main)/system/providers/new/page";
import type {
  ProviderDetailOut,
  UpdateProviderIn,
  UpdateProviderOut,
} from "@/app/(main)/system/providers/p/[providerId]/page";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Power } from "lucide-react";
import {
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

export interface ProviderProps {
  providerId?: string;
  mode?: "create" | "edit";
  // For edit mode: provider detail
  providerDetail?: ProviderDetailOut;
  // For create mode: provider detail default
  providerDetailDefault?: ProviderNewOut;
  // Server actions (replaces useMutation)
  createProviderAction?: (
    input: CreateProviderIn,
  ) => Promise<CreateProviderOut>;
  updateProviderAction?: (
    input: UpdateProviderIn,
  ) => Promise<UpdateProviderOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  patchProviderDraftAction?: (
    input: PatchProviderDraftIn,
  ) => Promise<PatchProviderDraftOut>;
}

function ProviderComponent({
  providerId,
  mode = providerId ? "edit" : "create",
  providerDetail: serverProviderDetail,
  providerDetailDefault: serverProviderDetailDefault,
  createProviderAction,
  updateProviderAction,
  patchProviderDraftAction,
}: ProviderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!providerId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Stabilize server props to prevent unnecessary re-renders from object reference changes
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverProviderDetail | typeof serverProviderDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("provider_id" in data && data.provider_id) {
          return `provider_id:${String(data.provider_id)}`;
        }
        return `new:${JSON.stringify(data).slice(0, 100)}`;
      }
      return String(data);
    },
    []
  );

  const providerDetailId = React.useMemo(
    () => stabilizeServerProp(serverProviderDetail),
    [serverProviderDetail, stabilizeServerProp]
  );
  const providerDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverProviderDetailDefault),
    [serverProviderDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerProviderDetailRef = React.useRef(serverProviderDetail);
  const latestServerProviderDetailDefaultRef = React.useRef(
    serverProviderDetailDefault
  );

  latestServerProviderDetailRef.current = serverProviderDetail;
  latestServerProviderDetailDefaultRef.current = serverProviderDetailDefault;

  // Use refs to track stable server props
  const stableProviderDetailRef = React.useRef<{
    data: typeof serverProviderDetail;
    id: string | null;
  }>({
    data: serverProviderDetail,
    id: providerDetailId,
  });
  const stableProviderDetailDefaultRef = React.useRef<{
    data: typeof serverProviderDetailDefault;
    id: string | null;
  }>({
    data: serverProviderDetailDefault,
    id: providerDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableProviderDetailRef.current.id !== providerDetailId) {
      stableProviderDetailRef.current = {
        data: latestServerProviderDetailRef.current,
        id: providerDetailId,
      };
    }
  }, [providerDetailId]);

  React.useEffect(() => {
    if (
      stableProviderDetailDefaultRef.current.id !== providerDetailDefaultId
    ) {
      stableProviderDetailDefaultRef.current = {
        data: latestServerProviderDetailDefaultRef.current,
        id: providerDetailDefaultId,
      };
    }
  }, [providerDetailDefaultId]);

  // Use stable references
  const providerDetail = stableProviderDetailRef.current.data;
  const providerDetailDefault =
    stableProviderDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const providerDataId = React.useMemo(() => {
    const data = isEditMode ? providerDetail : providerDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("provider_id" in data && data.provider_id) {
        return `provider_id:${String(data.provider_id)}`;
      }
      return `new:${JSON.stringify(data).slice(0, 100)}`;
    }
    return String(data);
  }, [isEditMode, providerDetail, providerDetailDefault]);

  const stableProviderDataRef = React.useRef<{
    data: typeof providerDetail | typeof providerDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? providerDetail : providerDetailDefault,
    id: providerDataId,
  });

  React.useEffect(() => {
    if (stableProviderDataRef.current.id !== providerDataId) {
      stableProviderDataRef.current = {
        data: isEditMode ? providerDetail : providerDetailDefault,
        id: providerDataId,
      };
    }
  }, [isEditMode, providerDetail, providerDetailDefault, providerDataId]);

  const providerData = stableProviderDataRef.current.data;

  // Inline parsers for URL-backed state (navigation/search params only)
  const providerSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(providerSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Local draft state (not in URL) - initialized from server data or draft payload
  type DraftState = {
    name: string;
    description: string;
    value: string;
    active: boolean;
  };

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? providerDetail : providerDetailDefault;

    if (!data) {
      return {
        name: "",
        description: "",
        value: "",
        active: true,
      };
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    return {
      name: data.name || "",
      description: data.description || "",
      value: data.value || "",
      active: data.active ?? true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    providerDetail,
    providerDetailDefault,
    providerDetailId,
    providerDetailDefaultId,
    draftId,
    urlDraftId,
    // Include actual content fields so it recomputes when server data changes
    providerDetailDefault?.name,
    providerDetailDefault?.description,
    providerDetailDefault?.value,
    providerDetailDefault?.active,
    providerDetail?.name,
    providerDetail?.description,
    providerDetail?.value,
    providerDetail?.active,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState((currentDraftState) => {
        // Check if new state is "empty" (no name, no value) but current state has content
        const newStateIsEmpty =
          (!initialDraftState.name || initialDraftState.name.trim() === "") &&
          (!initialDraftState.value || initialDraftState.value.trim() === "");

        const currentStateHasContent =
          (currentDraftState.name?.trim() || "").length > 0 ||
          (currentDraftState.value?.trim() || "").length > 0;

        // Prevent overwriting with empty values if current state has content
        // BUT: Always update boolean fields from initialDraftState
        if (newStateIsEmpty && currentStateHasContent) {
          // Keep current state but update boolean fields from initialDraftState
          return {
            ...currentDraftState,
            active: initialDraftState.active,
          };
        }

        // Otherwise, update with full initialDraftState
        return initialDraftState;
      });
    }
  }, [initialDraftState]);

  // Integrate autosave hook
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    patchDraftAction: patchProviderDraftAction
      ? async (input) => {
          // Transform hook API → backend API
          const result = await patchProviderDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchProviderDraftIn["body"],
          });
          // Transform backend API → hook API
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Only update URL if draftId actually changed
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        // Update URL with new draftId and trigger server-side refetch
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        // Force server components to re-render with updated search params
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
    } as Record<string, unknown>;
  }, [draftState]);

  // Wrapper for setFormData that updates draftState for form fields
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      // Handle function form
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (key === "name" || key === "description" || key === "value" || key === "active") {
          draftUpdates[key as keyof DraftState] = value as never;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
    },
    [formData]
  );

  // Readonly logic
  const isReadonly = useMemo(() => {
    if (!isEditMode || !providerData) return false;
    // Check if user is admin or superadmin - they can always edit
    if (
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin"
    ) {
      return false;
    }
    return !providerData.can_edit;
  }, [isEditMode, providerData, effectiveProfile?.role]);

  // Set breadcrumb context when provider data is loaded
  useEffect(() => {
    if (providerDetail?.name && providerId && isEditMode) {
      setEntityMetadata({
        entityId: providerId,
        entityName: providerDetail.name,
        entityType: "provider",
      });
    }
    return () => {
      if (providerId) {
        clearEntityMetadata(providerId);
      }
    };
  }, [
    providerDetail,
    providerId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Form initialization function for GenericForm
  const initializeForm = useCallback(
    (serverData: unknown, editMode: boolean) => {
      if (
        !editMode ||
        !serverData ||
        typeof serverData !== "object" ||
        !("name" in serverData)
      ) {
        return {};
      }

      const providerDetail = serverData as ProviderDetailOut;

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (providerDetail.name) draftUpdates.name = providerDetail.name;
      if (providerDetail.description)
        draftUpdates.description = providerDetail.description;
      if (providerDetail.value) draftUpdates.value = providerDetail.value;
      if (providerDetail.active !== undefined)
        draftUpdates.active = providerDetail.active ?? true;

      // Apply updates to draftState
      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }

      // Return empty object for GenericForm compatibility (form fields are handled via draftState)
      return {};
    },
    []
  );

  // Submit handler for GenericForm (uses draftState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!draftState.name?.trim()) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      if (!draftState.value?.trim()) {
        toast.error("Value is required");
        throw new Error("Value is required");
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (isEditMode) {
        if (!updateProviderAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        try {
          await updateProviderAction({
            body: {
              provider_id: providerId!,
              name: draftState.name || "",
              description: draftState.description || "",
              value: draftState.value || "",
              active: draftState.active ?? true,
            },
          });
          toast.success("Provider updated successfully!");
          router.push("/system/providers");
        } catch (error) {
          toast.error(
            `Failed to update provider: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      } else {
        if (!createProviderAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        try {
          await createProviderAction({
            body: {
              name: draftState.name || "",
              description: draftState.description || "",
              value: draftState.value || "",
              active: draftState.active ?? true,
            },
          });
          toast.success("Provider created successfully!");
          router.push("/system/providers");
        } catch (error) {
          toast.error(
            `Failed to create provider: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      }
    },
    [
      draftState,
      isEditMode,
      providerId,
      effectiveProfile?.id,
      updateProviderAction,
      createProviderAction,
      router,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(
        formData["name"] as string | null | undefined
      )?.trim();
      const hasValue = !!(
        formData["value"] as string | null | undefined
      )?.trim();

      switch (stepId) {
        case "basic":
          return hasName && hasValue ? "completed" : "active";
        default:
          return "pending";
      }
    },
    []
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the provider name, value identifier, description, and active status.",
        resetFields: ["name", "description", "value", "active"] as string[],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => ["name", "description", "value", "active"],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/system/providers",
      backLabel: "Back",
      createLabel: "Create Provider",
      updateLabel: "Update Provider",
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
      onReset?: () => void;
    }) => {
      switch (stepId) {
        case "basic":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              editableTitle={{
                value:
                  (stepFormData["name"] as string | null | undefined) ?? "",
                onChange: (value) => setStepFormData({ name: value || null }),
                placeholder: "New Provider",
                defaultName: "New Provider",
                required: true,
              }}
              resetFields={["name", "description", "value", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="value">Value</Label>
                  <Input
                    id="value"
                    data-testid="input-provider-value"
                    value={
                      (stepFormData["value"] as string | null | undefined) || ""
                    }
                    onChange={(e) =>
                      setStepFormData({ value: e.target.value || null })
                    }
                    placeholder="Enter provider value identifier (e.g., openai, gemini, custom)"
                    disabled={isReadonly}
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier for this provider (used in API calls)
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-provider-description"
                    value={
                      (stepFormData["description"] as
                        | string
                        | null
                        | undefined) || ""
                    }
                    onChange={(e) =>
                      setStepFormData({
                        description: e.target.value || null,
                      })
                    }
                    placeholder="Enter a brief description (optional)"
                    rows={3}
                    disabled={isReadonly}
                  />
                </div>

                {/* Active Switch */}
                <div className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="active"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <Power className="h-3.5 w-3.5 text-muted-foreground" />
                        Active
                      </Label>
                      <Switch
                        id="active"
                        data-testid="switch-provider-active"
                        checked={
                          (stepFormData["active"] as
                            | boolean
                            | null
                            | undefined) ??
                          (providerData as { active?: boolean })?.active ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                        }
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Inactive providers will not be available for selection
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );

        default:
          return null;
      }
    },
    [providerData, isReadonly, isEditMode]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`provider-${isEditMode ? "edit" : "new"}`}
      >
        {isReadonly && (
          <div className="bg-muted border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-muted-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-foreground">
                  Provider is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    You do not have permission to edit this provider. You can
                    view the details but cannot make changes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <GenericForm
          nuqsParsers={
            providerSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          formData={formData}
          setFormData={setFormData}
          serverData={providerData}
          initializeForm={initializeForm}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
          renderStep={renderStep}
        />
      </div>
    </TooltipProvider>
  );
}

// Helper function to generate stable ID from server prop
function getStableServerPropId(
  data: ProviderDetailOut | ProviderNewOut | undefined
): string | null {
  if (!data) return null;
  if (typeof data === "object" && data !== null) {
    if ("provider_id" in data && data.provider_id) {
      return `provider_id:${String(data.provider_id)}`;
    }
    return `new:${JSON.stringify(data).slice(0, 100)}`;
  }
  return String(data);
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(ProviderComponent, (prevProps, nextProps) => {
  const prevDetailId = getStableServerPropId(prevProps.providerDetail);
  const nextDetailId = getStableServerPropId(nextProps.providerDetail);
  const prevDefaultId = getStableServerPropId(prevProps.providerDetailDefault);
  const nextDefaultId = getStableServerPropId(
    nextProps.providerDetailDefault
  );

  return (
    prevProps.providerId === nextProps.providerId &&
    prevProps.mode === nextProps.mode &&
    prevDetailId === nextDetailId &&
    prevDefaultId === nextDefaultId
  );
});
