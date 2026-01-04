/**
 * Key.tsx
 * Used to create and manage keys for the admin dashboard
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

// UI Components
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { cn } from "@/lib/utils";
import { Check, Edit, Eye, EyeOff, Power, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

// Type-only import from server pages
import type {
  DecryptKeyIn,
  DecryptKeyOut,
  KeyDetailOut,
  PatchKeyDraftIn,
  PatchKeyDraftOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/system/keys/k/[keyId]/page";
import type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn as DecryptKeyInNew,
  DecryptKeyOut as DecryptKeyOutNew,
  KeyNewOut,
  PatchKeyDraftIn as PatchKeyDraftInNew,
  PatchKeyDraftOut as PatchKeyDraftOutNew,
} from "@/app/(main)/system/keys/new/page";
import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";

export interface KeyProps {
  keyId?: string;
  mode?: "create" | "edit";
  // For edit mode: key detail
  keyDetail?: KeyDetailOut;
  // For create mode: key detail default
  keyDetailDefault?: KeyNewOut;
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
  updateKeyAction?: (input: UpdateKeyIn) => Promise<UpdateKeyOut>;
  decryptKeyAction?: (
    input: DecryptKeyIn | DecryptKeyInNew,
  ) => Promise<DecryptKeyOut | DecryptKeyOutNew>;
  patchKeyDraftAction?: (
    input: PatchKeyDraftIn | PatchKeyDraftInNew,
  ) => Promise<PatchKeyDraftOut | PatchKeyDraftOutNew>;
}

function KeyComponent({
  keyId,
  mode = keyId ? "edit" : "create",
  keyDetail: serverKeyDetail,
  keyDetailDefault: serverKeyDetailDefault,
  createKeyAction,
  updateKeyAction,
  decryptKeyAction,
  patchKeyDraftAction,
}: KeyProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = mode === "edit" && !!keyId;
  const { selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverKeyDetail | typeof serverKeyDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("key_id" in data && data.key_id) {
          return `key_id:${String(data.key_id)}`;
        }
        return `new:${JSON.stringify(data).slice(0, 100)}`;
      }
      return String(data);
    },
    []
  );

  const keyDetailId = React.useMemo(
    () => stabilizeServerProp(serverKeyDetail),
    [serverKeyDetail, stabilizeServerProp]
  );
  const keyDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverKeyDetailDefault),
    [serverKeyDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerKeyDetailRef = React.useRef(serverKeyDetail);
  const latestServerKeyDetailDefaultRef = React.useRef(serverKeyDetailDefault);

  latestServerKeyDetailRef.current = serverKeyDetail;
  latestServerKeyDetailDefaultRef.current = serverKeyDetailDefault;

  // Use refs to track stable server props
  const stableKeyDetailRef = React.useRef<{
    data: typeof serverKeyDetail;
    id: string | null;
  }>({
    data: serverKeyDetail,
    id: keyDetailId,
  });
  const stableKeyDetailDefaultRef = React.useRef<{
    data: typeof serverKeyDetailDefault;
    id: string | null;
  }>({
    data: serverKeyDetailDefault,
    id: keyDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableKeyDetailRef.current.id !== keyDetailId) {
      stableKeyDetailRef.current = {
        data: latestServerKeyDetailRef.current,
        id: keyDetailId,
      };
    }
  }, [keyDetailId]);

  React.useEffect(() => {
    if (stableKeyDetailDefaultRef.current.id !== keyDetailDefaultId) {
      stableKeyDetailDefaultRef.current = {
        data: latestServerKeyDetailDefaultRef.current,
        id: keyDetailDefaultId,
      };
    }
  }, [keyDetailDefaultId]);

  // Use stable references
  const keyDetail = stableKeyDetailRef.current.data;
  const keyDetailDefault = stableKeyDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const keyDataId = React.useMemo(() => {
    const data = isEditMode ? keyDetail : keyDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("key_id" in data && data.key_id) {
        return `key_id:${String(data.key_id)}`;
      }
      return `new:${JSON.stringify(data).slice(0, 100)}`;
    }
    return String(data);
  }, [isEditMode, keyDetail, keyDetailDefault]);

  const stableKeyDataRef = React.useRef<{
    data: typeof keyDetail | typeof keyDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? keyDetail : keyDetailDefault,
    id: keyDataId,
  });

  React.useEffect(() => {
    if (stableKeyDataRef.current.id !== keyDataId) {
      stableKeyDataRef.current = {
        data: isEditMode ? keyDetail : keyDetailDefault,
        id: keyDataId,
      };
    }
  }, [isEditMode, keyDetail, keyDetailDefault, keyDataId]);

  const keyData = stableKeyDataRef.current.data;

  // Inline parsers for URL-backed state (navigation/search params only)
  const keySearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams] = useQueryStates(keySearchParamsClient, {
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
    active: boolean;
    key: string; // Key value (never populated from server in edit mode for security)
  };

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? keyDetail : keyDetailDefault;

    if (!data) {
      return {
        name: "New Key",
        description: "",
        active: true,
        key: "",
      };
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    // NOTE: Never populate key value from server in edit mode (security)
    return {
      name: data.name || "New Key",
      description: data.description || "",
      active: data.active ?? true,
      key: "", // Always empty - never populate from server
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    keyDetail,
    keyDetailDefault,
    keyDetailId,
    keyDetailDefaultId,
    draftId,
    urlDraftId,
    // Include actual content fields so it recomputes when server data changes
    keyDetailDefault?.name,
    keyDetailDefault?.description,
    keyDetailDefault?.active,
    keyDetail?.name,
    keyDetail?.description,
    keyDetail?.active,
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
        // Check if new state is "empty" (no name) but current state has content
        const newStateIsEmpty =
          (!initialDraftState.name || initialDraftState.name.trim() === "");

        const currentStateHasContent =
          (currentDraftState.name?.trim() || "").length > 0;

        // Prevent overwriting with empty values if current state has content
        // BUT: Always update boolean fields from initialDraftState
        if (newStateIsEmpty && currentStateHasContent) {
          // Keep current state but update boolean fields from initialDraftState
          return {
            ...currentDraftState,
            active: initialDraftState.active,
          };
        }

        // Otherwise, update with full initialDraftState (but preserve key value)
        return {
          ...initialDraftState,
          key: currentDraftState.key, // Preserve key value (never overwrite from server)
        };
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
    patchDraftAction: patchKeyDraftAction
      ? async (input) => {
          // Transform hook API → backend API
          const result = await patchKeyDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchKeyDraftIn["body"],
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
        if (
          key === "name" ||
          key === "description" ||
          key === "active" ||
          key === "key"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
    },
    [formData]
  );

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !keyData) return false;
    if ("can_edit" in keyData) {
      return !(keyData as KeyDetailOut).can_edit;
    }
    return false;
  }, [isEditMode, keyData]);

  // Set breadcrumb context when key data is loaded
  useEffect(() => {
    if (keyDetail?.name && keyId && isEditMode) {
      setEntityMetadata({
        entityId: keyId,
        entityName: keyDetail.name,
        entityType: "key",
      });
    }
    return () => clearEntityMetadata();
  }, [
    keyDetail,
    keyId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Key value preview/edit state (local, not in draft)
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedKey, setDecryptedKey] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [editingKeyValue, setEditingKeyValue] = useState("");
  const [dotsCount, setDotsCount] = useState(100);
  const dotsContainerRef = useRef<HTMLDivElement>(null);

  const handleTogglePreview = useCallback(async () => {
    if (!isPreviewMode) {
      // Turning preview on - need to decrypt
      if (!keyId || !decryptKeyAction) {
        toast.error("Cannot decrypt key: missing required information");
        return;
      }

      setIsDecrypting(true);
      setDecryptedKey(null);

      try {
        const result = await decryptKeyAction({
          body: {
            key_id: keyId,
          },
        });
        setDecryptedKey(result.key ?? null);
        setIsPreviewMode(true);
      } catch (error) {
        toast.error(
          `Failed to decrypt key: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      } finally {
        setIsDecrypting(false);
      }
    } else {
      // Turning preview off
      setIsPreviewMode(false);
      setDecryptedKey(null);
    }
  }, [isPreviewMode, keyId, decryptKeyAction]);

  const handleStartEditKey = useCallback(() => {
    setIsEditingKey(true);
    setEditingKeyValue(draftState.key || "");
  }, [draftState.key]);

  const handleSaveEditKey = useCallback(() => {
    setFormData({ key: editingKeyValue });
    setIsEditingKey(false);
    setEditingKeyValue("");
  }, [editingKeyValue, setFormData]);

  const handleCancelEditKey = useCallback(() => {
    setIsEditingKey(false);
    setEditingKeyValue("");
  }, []);

  // Calculate dots dynamically based on container width
  useEffect(() => {
    const calculateDots = () => {
      if (!dotsContainerRef.current) return;

      const container = dotsContainerRef.current;
      const containerWidth = container.offsetWidth;
      const padding = 24; // p-3 = 12px on each side
      const availableWidth = containerWidth - padding;

      // Approximate width of a dot character at text-lg (18px)
      const tempSpan = document.createElement("span");
      tempSpan.style.fontSize = "18px";
      tempSpan.style.visibility = "hidden";
      tempSpan.style.position = "absolute";
      tempSpan.textContent = "•";
      document.body.appendChild(tempSpan);
      const dotWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);

      // Calculate number of dots that fit
      const dotsNeeded = Math.floor(availableWidth / dotWidth);
      setDotsCount(Math.max(50, dotsNeeded)); // Minimum 50 dots
    };

    calculateDots();

    // Recalculate on window resize
    const resizeObserver = new ResizeObserver(calculateDots);
    if (dotsContainerRef.current) {
      resizeObserver.observe(dotsContainerRef.current);
    }

    window.addEventListener("resize", calculateDots);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", calculateDots);
    };
  }, [isEditMode, isEditingKey]);

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

      const keyDetailData = serverData as KeyDetailOut;

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (keyDetailData.name) draftUpdates.name = keyDetailData.name;
      if (keyDetailData.description)
        draftUpdates.description = keyDetailData.description || "";
      if (keyDetailData.active !== undefined)
        draftUpdates.active = keyDetailData.active ?? true;
      // NOTE: Never populate key value from server (security)

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
      if (!draftState.name || !draftState.name.trim()) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      if (!draftState.key && !isEditMode) {
        toast.error("Key value is required");
        throw new Error("Key value is required");
      }

      // Extract body types from server action types for type safety
      type CreateKeyBody = CreateKeyIn extends { body: infer B } ? B : never;
      type UpdateKeyBody = UpdateKeyIn extends { body: infer B } ? B : never;

      if (isEditMode) {
        if (!updateKeyAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        try {
          await updateKeyAction({
            body: {
              key_id: keyId!,
              name: draftState.name,
              key: draftState.key || "", // Use existing key if not changed
              description: draftState.description || "",
              active: draftState.active ?? true,
              department_ids: null,
            } as UpdateKeyBody,
          });
          toast.success("Key updated successfully!");
          router.push("/system/keys");
        } catch (error) {
          toast.error(
            `Failed to update key: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          throw error;
        }
      } else {
        if (!createKeyAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        try {
          await createKeyAction({
            body: {
              name: draftState.name,
              key: draftState.key!,
              description: draftState.description || "",
              active: draftState.active ?? true,
              department_ids: null,
            } as CreateKeyBody,
          });
          toast.success("Key created successfully!");
          router.push("/system/keys");
        } catch (error) {
          toast.error(
            `Failed to create key: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          throw error;
        }
      }
    },
    [
      draftState,
      isEditMode,
      keyId,
      updateKeyAction,
      createKeyAction,
      router,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(
        formData["name"] as string | null | undefined
      )?.trim();

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "key-value":
          return "active"; // Always available
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
          "Set the key name, description, and active status.",
        resetFields: ["name", "description", "active"],
      },
      {
        id: "key-value",
        title: "Key Value",
        description: "Enter or update the API key value.",
        resetFields: ["key"],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => ["name", "description", "active", "key"],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "key-value":
        return "Key value reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/system/keys",
      backLabel: "Back",
      createLabel: "Create Key",
      updateLabel: "Update Key",
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
                placeholder: "New Key",
                defaultName: "New Key",
                required: true,
              }}
              resetFields={["name", "description", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-key-description"
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
                        data-testid="switch-key-active"
                        checked={
                          (stepFormData["active"] as
                            | boolean
                            | null
                            | undefined) ??
                          (keyData as { active?: boolean })?.active ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                        }
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Inactive keys will not be available for selection
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );

        case "key-value":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["key"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                isEditMode && keyId ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleTogglePreview}
                        disabled={isDecrypting || isReadonly}
                        data-testid="btn-preview-key"
                      >
                        {isDecrypting ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                        ) : isPreviewMode ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isPreviewMode ? "Hide Preview" : "Preview Key"}
                    </TooltipContent>
                  </Tooltip>
                ) : undefined
              }
            >
              <div className="space-y-2">
                <Label htmlFor="key">API Key</Label>
                {!isEditMode || isEditingKey ? (
                  <div className="flex items-center gap-2">
                    <Textarea
                      id="key"
                      data-testid="input-key-value"
                      value={
                        isEditingKey
                          ? editingKeyValue
                          : (stepFormData["key"] as string | null | undefined) ||
                            ""
                      }
                      onChange={(e) => {
                        if (isEditingKey) {
                          setEditingKeyValue(e.target.value);
                        } else {
                          setStepFormData({ key: e.target.value || null });
                        }
                      }}
                      placeholder="Enter key value"
                      className={cn("flex-1 h-10 resize-none")}
                      disabled={isReadonly}
                      onKeyDown={(e) => {
                        if (isEditingKey) {
                          if (e.key === "Enter" && e.ctrlKey) {
                            handleSaveEditKey();
                          } else if (e.key === "Escape") {
                            handleCancelEditKey();
                          }
                        }
                      }}
                    />
                    {isEditingKey && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSaveEditKey();
                          }}
                          disabled={isReadonly}
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCancelEditKey();
                          }}
                          disabled={isReadonly}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <div
                      ref={dotsContainerRef}
                      className="flex-1 p-3 bg-muted rounded-md border h-10 flex items-center w-full overflow-hidden"
                    >
                      {isPreviewMode && decryptedKey ? (
                        <code className="text-sm break-all w-full">
                          {decryptedKey}
                        </code>
                      ) : (
                        <span className="text-muted-foreground text-lg whitespace-nowrap">
                          {"•".repeat(dotsCount)}
                        </span>
                      )}
                    </div>
                    {!isReadonly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleStartEditKey}
                        className="shrink-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      isReadonly,
      isEditMode,
      keyId,
      keyData,
      isDecrypting,
      isPreviewMode,
      decryptedKey,
      dotsCount,
      isEditingKey,
      editingKeyValue,
      handleTogglePreview,
      handleStartEditKey,
      handleSaveEditKey,
      handleCancelEditKey,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`key-${isEditMode ? "edit" : "new"}`}
      >
        <GenericForm
          nuqsParsers={
            keySearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          formData={formData}
          setFormData={setFormData}
          serverData={keyData}
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
  data: KeyDetailOut | KeyNewOut | undefined
): string | null {
  if (!data) return null;
  if (typeof data === "object" && data !== null) {
    if ("key_id" in data && data.key_id) {
      return `key_id:${String(data.key_id)}`;
    }
    return `new:${JSON.stringify(data).slice(0, 100)}`;
  }
  return String(data);
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(KeyComponent, (prevProps, nextProps) => {
  const prevDetailId = getStableServerPropId(prevProps.keyDetail);
  const nextDetailId = getStableServerPropId(nextProps.keyDetail);
  const prevDefaultId = getStableServerPropId(prevProps.keyDetailDefault);
  const nextDefaultId = getStableServerPropId(nextProps.keyDetailDefault);

  // Compare primitive props
  if (prevProps.keyId !== nextProps.keyId || prevProps.mode !== nextProps.mode) {
    return false; // Props changed, re-render
  }

  // Compare server props by content ID, not reference
  if (prevDetailId !== nextDetailId) {
    return false; // Content changed, re-render
  }

  if (prevDefaultId !== nextDefaultId) {
    return false; // Content changed, re-render
  }

  // All props are equivalent (same content), skip re-render
  return true;
});
