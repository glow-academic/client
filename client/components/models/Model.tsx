/**
 * Model.tsx
 * Used to create and manage models for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { GenericForm, type StepStatus } from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { StepCard } from "@/components/common/forms/StepCard";
import {
  TemperatureBoundsPicker,
  type TemperatureBounds,
} from "@/components/common/forms/TemperatureBoundsPicker";
import { InputModalityCardGrid } from "@/components/common/models/InputModalityCardGrid";
import { OutputModalityCardGrid } from "@/components/common/models/OutputModalityCardGrid";
import { PricingTypeCardGrid } from "@/components/common/models/PricingTypeCardGrid";
import { ProviderCardGrid } from "@/components/common/models/ProviderCardGrid";
import { QualityCardGrid } from "@/components/common/models/QualityCardGrid";
import { ReasoningCardGrid } from "@/components/common/models/ReasoningCardGrid";
import { UnitCardGrid } from "@/components/common/models/UnitCardGrid";
import { VoiceCardGrid } from "@/components/common/models/VoiceCardGrid";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { cn } from "@/lib/utils";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import {
  Brain,
  Check,
  DollarSign,
  Edit,
  Image,
  Power,
  Settings,
  Thermometer,
  Volume2,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Parser } from "nuqs";
import { parseAsString, useQueryStates } from "nuqs";

interface FormErrors {
  name?: string;
  description?: string;
  provider_id?: string;
  value?: string;
  baseUrl?: string;
}


// Type-only import from server pages
import type {
  ModelDetailOut,
  UpdateModelIn,
  UpdateModelOut,
  PatchModelDraftIn,
  PatchModelDraftOut,
} from "@/app/(main)/engine/models/[modelId]/page";
import type {
  CreateModelIn,
  CreateModelOut,
  ModelNewOut,
} from "@/app/(main)/engine/models/new/page";

// Type guard to check if data has ModelDetailOut properties
function isModelDetailOut(d: unknown): d is ModelDetailOut {
  return typeof d === "object" && d !== null && "name" in d;
}

// Custom URL step component (separate component to use hooks properly)
function CustomUrlStep({
  stepStatus,
  stepNumber,
  stepTitle,
  stepDescription,
  isReadonly,
  isEditMode,
  baseUrl,
  setStepFormData,
  errors,
  isSubmitting,
  onReset,
}: {
  stepStatus: StepStatus;
  stepNumber: number;
  stepTitle: string;
  stepDescription: string;
  isReadonly: boolean;
  isEditMode: boolean;
  baseUrl: string;
  setStepFormData: (updates: Partial<Record<string, unknown>>) => void;
  errors: FormErrors;
  isSubmitting: boolean;
  onReset?: () => void;
}) {
  const [isEditingBaseUrl, setIsEditingBaseUrl] = useState(false);
  const [editingBaseUrlValue, setEditingBaseUrlValue] = useState("");
  const dotsContainerRef = useRef<HTMLDivElement>(null);
  const [dotsCount, setDotsCount] = useState(100);

  // Initialize editing value when entering edit mode
  useEffect(() => {
    if (isEditingBaseUrl) {
      setEditingBaseUrlValue(baseUrl || "");
    }
  }, [isEditingBaseUrl, baseUrl]);

  // Calculate dots dynamically
  useEffect(() => {
    const calculateDots = () => {
      if (!dotsContainerRef.current) return;
      const container = dotsContainerRef.current;
      const containerWidth = container.offsetWidth;
      const padding = 24;
      const availableWidth = containerWidth - padding;
      const tempSpan = document.createElement("span");
      tempSpan.style.fontSize = "18px";
      tempSpan.style.visibility = "hidden";
      tempSpan.style.position = "absolute";
      tempSpan.textContent = "•";
      document.body.appendChild(tempSpan);
      const dotWidth = tempSpan.offsetWidth;
      document.body.removeChild(tempSpan);
      const dotsNeeded = Math.floor(availableWidth / dotWidth);
      setDotsCount(Math.max(50, dotsNeeded));
    };
    calculateDots();
    const resizeObserver = new ResizeObserver(calculateDots);
    if (dotsContainerRef.current) {
      resizeObserver.observe(dotsContainerRef.current);
    }
    window.addEventListener("resize", calculateDots);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", calculateDots);
    };
  }, []);

  return (
    <StepCard
      stepStatus={stepStatus}
      stepNumber={stepNumber}
      stepTitle={stepTitle}
      stepDescription={stepDescription}
      isReadonly={isReadonly}
      isEditMode={isEditMode}
      resetFields={["baseUrl", "customModel"]}
      {...(onReset ? { onReset } : {})}
      resetLabel="Reset"
    >
      <div className="space-y-2">
        <Label htmlFor="baseUrl">Base URL</Label>
        {!isEditMode || isEditingBaseUrl ? (
          <div className="flex items-center gap-2">
            <Textarea
              id="baseUrl"
              data-testid="input-model-base-url"
              value={isEditingBaseUrl ? editingBaseUrlValue : baseUrl}
              onChange={(e) => {
                if (isEditingBaseUrl) {
                  setEditingBaseUrlValue(e.target.value);
                } else {
                  setStepFormData({ baseUrl: e.target.value || null });
                }
              }}
              placeholder="e.g. https://api.example.com/v1"
              className={cn(
                "flex-1 h-10 resize-none",
                errors.baseUrl ? "border-destructive" : "",
              )}
              disabled={isReadonly}
              onKeyDown={(e) => {
                if (isEditingBaseUrl) {
                  if (e.key === "Enter" && e.ctrlKey) {
                    setStepFormData({ baseUrl: editingBaseUrlValue || null });
                    setIsEditingBaseUrl(false);
                    setEditingBaseUrlValue("");
                  } else if (e.key === "Escape") {
                    setIsEditingBaseUrl(false);
                    setEditingBaseUrlValue("");
                  }
                }
              }}
            />
            {isEditingBaseUrl && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setStepFormData({ baseUrl: editingBaseUrlValue || null });
                    setIsEditingBaseUrl(false);
                    setEditingBaseUrlValue("");
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
                    setIsEditingBaseUrl(false);
                    setEditingBaseUrlValue("");
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
              {baseUrl ? (
                <code className="text-sm break-all w-full">
                  {baseUrl}
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
                onClick={() => {
                  setIsEditingBaseUrl(true);
                  setEditingBaseUrlValue(baseUrl || "");
                }}
                disabled={isSubmitting}
                className="shrink-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {errors.baseUrl && (
          <p className="text-sm text-destructive">
            {errors.baseUrl}
          </p>
        )}
      </div>
    </StepCard>
  );
}

export interface ModelProps {
  modelId?: string;
  // For create mode: default model detail with provider mapping
  modelDetailDefault?: ModelNewOut;
  // For edit mode: model detail with provider mapping
  modelDetail?: ModelDetailOut;
  createModelAction?: (input: CreateModelIn) => Promise<CreateModelOut>;
  updateModelAction?: (input: UpdateModelIn) => Promise<UpdateModelOut>;
  patchModelDraftAction?: (
    input: PatchModelDraftIn
  ) => Promise<PatchModelDraftOut>;
}

export default function Model({
  modelId,
  modelDetailDefault,
  modelDetail: serverModelDetail,
  createModelAction,
  updateModelAction,
  patchModelDraftAction,
}: ModelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { effectiveProfile } = useProfile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingBaseUrl, setIsEditingBaseUrl] = useState(false);
  const [editingBaseUrlValue, setEditingBaseUrlValue] = useState("");
  const [dotsCount, setDotsCount] = useState(100);
  const dotsContainerRef = useRef<HTMLDivElement>(null);
  const isEditMode = !!modelId;

  // Inline parsers for URL-backed state (draftId only for now)
  const modelSearchParamsClient = {
    draftId: parseAsString,
  } as const;

  // URL-backed state using nuqs (only draftId)
  const [urlParams, setUrlParams] = useQueryStates(modelSearchParamsClient, {
    history: "replace",
    shallow: true,
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;
  const draftId = urlDraftId;

  // Use server-provided data
  const modelData = isEditMode ? serverModelDetail : modelDetailDefault;

  // Draft state type (all form fields that should be saved to draft)
  type DraftState = {
    name: string;
    description: string;
    provider_id: string;
    value: string;
    active: boolean;
    departmentIds: string[];
    customModel: boolean;
    baseUrl: string;
    enableModalities: boolean;
    enableTemperature: boolean;
    enablePricing: boolean;
    enableVoices: boolean;
    enableReasoningLevels: boolean;
    enableQualities: boolean;
    temperature_bounds?: TemperatureBounds;
    pricing?: Record<string, { unit_id: string; price: number }[]>;
    selectedPricingTypes?: string[];
    modalities?: { input: string[]; output: string[] };
    reasoning_levels?: string[];
    voices?: string[];
    qualities?: string[];
  };

  const isSuperadmin = effectiveProfile?.role === "superadmin";
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id || null,
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id],
  );

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    if (!modelData) {
      return {
      name: "New Model",
      description: "",
      provider_id: "",
      value: "",
      active: true,
      departmentIds: defaultDepartmentIds,
      customModel: false,
      baseUrl: "",
        enableModalities: true,
        enableTemperature: false,
        enablePricing: false,
        enableVoices: false,
        enableReasoningLevels: false,
        enableQualities: false,
        modalities: { input: ["text"], output: ["text"] },
        pricing: {},
        selectedPricingTypes: [],
        reasoning_levels: [],
        voices: [],
        qualities: [],
      };
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    const data = modelData as ModelDetailOut | ModelNewOut;
    
    // Parse temperature bounds if present
    let temperature_bounds: TemperatureBounds | undefined;
    if ("temperature_lower" in data && "temperature_upper" in data) {
      const tempLower = (data as ModelDetailOut).temperature_lower ?? 0.0;
      const tempUpper = (data as ModelDetailOut).temperature_upper ?? 1.0;
      const tempValues = (data as ModelDetailOut).temperature_values;
      if (tempValues && tempValues.length > 0) {
        temperature_bounds = {
          type: "range",
          lower: tempLower,
          upper: tempUpper,
        };
      }
    }

    // Parse pricing
    if (!data || typeof data !== "object" || !("pricing" in data)) {
      // Handle case where data is null or doesn't have pricing - return empty pricing array
      return {
        ...initialDraftState,
        pricing: {},
        selectedPricingTypes: [],
      };
    }
    const pricingArray =
      data.pricing && Array.isArray(data.pricing)
        ? data.pricing
            .filter((p): p is NonNullable<typeof p> => p != null)
            .map((p) => ({
              type: (p?.pricing_type ?? "input") as "input" | "output" | "cached",
              unit_id: p?.unit_id || "",
              price: p?.price ?? 0,
            }))
        : [];
    const pricing: Record<string, { unit_id: string; price: number }[]> = {};
    const selectedPricingTypesSet = new Set<string>();
    pricingArray.forEach((entry: any) => {
      const type = entry.type;
      selectedPricingTypesSet.add(type);
      if (!pricing[type]) {
        pricing[type] = [];
      }
      pricing[type].push({
        unit_id: entry.unit_id,
        price: entry.price,
      });
    });
    const selectedPricingTypes = Array.from(selectedPricingTypesSet);

    // Parse modalities
    const modalities =
      "modalities" in data && data.modalities && typeof data.modalities === "object"
        ? {
            input: Array.isArray((data as ModelDetailOut).modalities?.input) 
              ? (data as ModelDetailOut).modalities!.input || ["text"]
              : ["text"],
            output: Array.isArray((data as ModelDetailOut).modalities?.output)
              ? (data as ModelDetailOut).modalities!.output || ["text"]
              : ["text"],
          }
        : { input: ["text"], output: ["text"] };

    // Determine feature toggles
    const hasModalities =
      modalities.input.length > 0 || modalities.output.length > 0;
    const hasTemperature = !!temperature_bounds;
    const hasPricing = pricing && Object.keys(pricing).length > 0;
    const hasVoices =
      "voices" in data &&
      data.voices &&
      Array.isArray(data.voices) &&
      (data.voices as Array<string | { voice: string }>).length > 0;
    const hasReasoningLevels =
      "reasoning_levels" in data &&
      data.reasoning_levels &&
      Array.isArray(data.reasoning_levels) &&
      data.reasoning_levels.length > 0;
    const hasQualities =
      "qualities" in data && 
      data.qualities && 
      Array.isArray(data.qualities) &&
      data.qualities.length > 0;

    // Determine if custom model
    const baseUrl = "base_url" in data ? (data as ModelDetailOut).base_url || "" : "";
    const customModel = baseUrl !== "" && baseUrl.trim() !== "";

    // Type guard to check if data has ModelDetailOut properties
    const isModelDetailOut = (d: unknown): d is ModelDetailOut => {
      return typeof d === "object" && d !== null && "name" in d;
    };

    return {
      name: isModelDetailOut(data) ? (data.name ?? "New Model") : "New Model",
      description: isModelDetailOut(data) ? (data.description ?? "") : "",
      provider_id: isModelDetailOut(data) ? (data.provider_id ?? "") : "",
      value: isModelDetailOut(data) ? (data.value ?? "") : "",
      active: isModelDetailOut(data) ? (data.active ?? true) : true,
      departmentIds: isModelDetailOut(data) ? (data.department_ids ?? defaultDepartmentIds) : defaultDepartmentIds,
      customModel,
      baseUrl,
      enableModalities: hasModalities,
      enableTemperature: hasTemperature ?? false,
      enablePricing: hasPricing ?? false,
      enableVoices: hasVoices ?? false,
      enableReasoningLevels: hasReasoningLevels ?? false,
      enableQualities: hasQualities ?? false,
      ...(temperature_bounds ? { temperature_bounds } : {}),
      pricing,
      selectedPricingTypes,
      modalities,
      reasoning_levels: "reasoning_levels" in data ? (data as ModelDetailOut).reasoning_levels || [] : [],
      voices:
        "voices" in data && data.voices
          ? (data.voices as Array<string | { voice: string }>)
              .map((v: string | { voice: string }) =>
                typeof v === "string" ? v : v.voice,
              )
              .filter(Boolean)
          : [],
      qualities: "qualities" in data ? (data as ModelDetailOut).qualities || [] : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    modelData,
    defaultDepartmentIds,
    draftId,
    urlDraftId,
    isModelDetailOut(modelData) ? modelData.name : undefined,
    isModelDetailOut(modelData) ? modelData.description : undefined,
    isModelDetailOut(modelData) ? modelData.value : undefined,
    isModelDetailOut(modelData) ? modelData.active : undefined,
    (modelData as ModelDetailOut)?.provider_id,
    (modelData as ModelDetailOut)?.department_ids,
    (modelData as ModelDetailOut)?.base_url,
    (modelData as ModelDetailOut)?.temperature_lower,
    (modelData as ModelDetailOut)?.temperature_upper,
    (modelData as ModelDetailOut)?.modalities,
    (modelData as ModelDetailOut)?.pricing,
    (modelData as ModelDetailOut)?.reasoning_levels,
    (modelData as ModelDetailOut)?.voices,
    (modelData as ModelDetailOut)?.qualities,
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
      setDraftState(initialDraftState);
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
    initialVersion: modelData?.draft_version || 0,
    patchDraftAction: patchModelDraftAction
      ? async (input) => {
          const result = await patchModelDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchModelDraftIn["body"],
          });
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
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
      draftId: urlParams.draftId || null,
    } as Record<string, unknown>;
  }, [draftState, urlParams]);

  // Wrapper for setFormData that updates draftState for form fields, urlParams for navigation
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};
      const urlUpdates: Partial<Record<string, unknown>> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (
          key === "name" ||
          key === "description" ||
          key === "provider_id" ||
          key === "value" ||
          key === "active" ||
          key === "departmentIds" ||
          key === "customModel" ||
          key === "baseUrl" ||
          key === "enableModalities" ||
          key === "enableTemperature" ||
          key === "enablePricing" ||
          key === "enableVoices" ||
          key === "enableReasoningLevels" ||
          key === "enableQualities" ||
          key === "temperature_bounds" ||
          key === "pricing" ||
          key === "selectedPricingTypes" ||
          key === "modalities" ||
          key === "reasoning_levels" ||
          key === "voices" ||
          key === "qualities"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        } else if (key === "draftId") {
          urlUpdates["draftId"] = value;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
      if (Object.keys(urlUpdates).length > 0) {
        const hasChanges = Object.keys(urlUpdates).some((key) => {
          const newValue = urlUpdates[key];
          const currentValue = urlParams[key as keyof typeof urlParams];
          return newValue !== currentValue;
        });

        if (hasChanges) {
          setUrlParams(urlUpdates as Parameters<typeof setUrlParams>[0]);
        }
      }
    },
    [formData, setUrlParams, urlParams]
  );

  const [errors, setErrors] = useState<FormErrors>({});

  // Extract body types from server action types for type safety
  type CreateModelBody = CreateModelIn extends { body: infer B } ? B : never;
  type UpdateModelBody = UpdateModelIn extends { body: infer B } ? B : never;

  // Use server actions directly (no mutations needed)
  const handleCreateModel = async (body: CreateModelBody) => {
    if (!createModelAction) {
      throw new Error("createModelAction is required");
    }
    await createModelAction({ body });
  };

  const handleUpdateModel = async (body: UpdateModelBody) => {
    if (!updateModelAction) {
      throw new Error("updateModelAction is required");
    }
    await updateModelAction({ body });
  };

  // Readonly logic - models are always editable for now (no can_edit field in API)
  const isReadonly = useMemo(() => {
    // Models don't have can_edit field yet, so always allow editing
    // TODO: Add can_edit field to ModelDetailResponse if needed
    return false;
  }, []);

  // Use server-provided data (for breadcrumbs and other non-form uses)
  const modelDetail = isEditMode ? serverModelDetail : modelDetailDefault;

  // Get department and key arrays (replacing mappings)
  const modelDataForArrays = isEditMode ? modelDetail : modelDetailDefault;
  const departments = useMemo(() => {
    return modelDataForArrays?.departments || [];
  }, [modelDataForArrays]);

  const validDepartmentIds = useMemo(() => {
    return modelDataForArrays?.valid_department_ids || [];
  }, [modelDataForArrays]);

  // Get provider array (replacing provider_mapping)
  const providers = useMemo(() => {
    return modelDataForArrays?.providers || [];
  }, [modelDataForArrays]);

  // Get keys array (replacing key_mapping) - unused but kept for potential future use
  // const _keys = useMemo(() => {
  //   return modelDataForArrays?.keys || [];
  // }, [modelDataForArrays]);

  // Get current department_ids and key_id for edit mode - unused but kept for potential future use
  // const _currentDepartmentIds = useMemo(() => {
  //   if (isEditMode && modelDetail && "department_ids" in modelDetail) {
  //     return (modelDetail.department_ids as string[]) || [];
  //   }
  //   return defaultDepartmentIds;
  // }, [isEditMode, modelDetail, defaultDepartmentIds]);

  // const _currentKeyId = useMemo(() => {
  //   if (isEditMode && modelDetail && "default_key_id" in modelDetail) {
  //     return (modelDetail.default_key_id as string | null) || null;
  //   }
  //   return null;
  // }, [isEditMode, modelDetail]);

  // Set breadcrumb context for model (edit mode only)
  useEffect(() => {
    const detailName = isModelDetailOut(modelDetail) ? modelDetail.name : null;
    if (detailName && modelId && isEditMode) {
      setEntityMetadata({
        entityId: modelId,
        entityName: detailName,
        entityType: "model",
      });
    }
    return () => {
      if (modelId) {
        clearEntityMetadata(modelId);
      }
    };
  }, [
    modelDetail,
    modelId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Get units from model detail response (already included)
  // Map server units to Unit type expected by UnitCardGrid
  const units = useMemo(() => {
    if (!modelData?.units) return [];
    return modelData.units
      .filter((u): u is NonNullable<typeof u> & { unit_id: string; name: string; value: number } => 
        u !== null && u.unit_id !== null && u.name !== null && u.value !== null
      )
      .map((u) => ({
        id: u.unit_id,
        name: u.name,
        unit_category: u.unit_category || "",
        value: u.value,
      }));
  }, [modelData]);


  const resetFormAndState = () => {
    setDraftState(initialDraftState);
    setErrors({});
  };

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(formData["name"] as string | null | undefined)?.trim();
      const hasValue = !!(formData["value"] as string | null | undefined)?.trim();
      const hasDescription = !!(formData["description"] as string | null | undefined)?.trim();
      const hasProvider = !!(formData["provider_id"] as string | null | undefined)?.trim();
      const hasCustomUrl =
        !(formData["customModel"] as boolean | null | undefined) ||
        ((formData["customModel"] as boolean) && !!(formData["baseUrl"] as string | null | undefined)?.trim());
      const modalities = formData["modalities"] as { input: string[]; output: string[] } | null | undefined;
      const hasInputModalities =
        modalities && modalities.input && modalities.input.length > 0;
      const hasOutputModalities =
        modalities && modalities.output && modalities.output.length > 0;
      const hasModalities = hasInputModalities && hasOutputModalities;

      switch (stepId) {
        case "basic":
          return hasName && hasValue && hasDescription ? "completed" : "active";
        case "customUrl":
          if (!hasName || !hasValue || !hasDescription) return "pending";
          return hasCustomUrl ? "completed" : "active";
        case "provider":
          if (!hasName || !hasValue || !hasDescription) return "pending";
          return hasProvider ? "completed" : "active";
        case "inputModalities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          return hasInputModalities ? "completed" : "active";
        case "outputModalities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities) return "pending";
          return hasOutputModalities ? "completed" : "active";
        case "modalities":
          // Keep for backward compatibility, but use inputModalities and outputModalities instead
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          return hasModalities ? "completed" : "active";
        case "temperature":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          const enableTemperature = formData["enableTemperature"] as boolean | null | undefined;
          const temperature_bounds = formData["temperature_bounds"] as TemperatureBounds | null | undefined;
          return enableTemperature && temperature_bounds
            ? "completed"
            : enableTemperature
              ? "active"
              : "pending";
        case "pricing":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          // Check if pricing has any entries (new Record structure)
          const enablePricing = formData["enablePricing"] as boolean | null | undefined;
          const pricing = formData["pricing"] as Record<string, { unit_id: string; price: number }[]> | null | undefined;
          const hasPricingEntries =
            enablePricing &&
            pricing &&
            Object.values(pricing).some(
              (entries) => entries && entries.length > 0,
            );
          return hasPricingEntries
            ? "completed"
            : enablePricing
              ? "active"
              : "pending";
        case "reasoning":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          if (!modalities?.output?.includes("text")) return "pending";
          const enableReasoningLevels = formData["enableReasoningLevels"] as boolean | null | undefined;
          const reasoning_levels = formData["reasoning_levels"] as string[] | null | undefined;
          return enableReasoningLevels &&
            reasoning_levels && reasoning_levels.length > 0
            ? "completed"
            : enableReasoningLevels
              ? "active"
              : "pending";
        case "voices":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          if (
            !modalities?.input?.includes("audio") ||
            !modalities?.output?.includes("audio")
          )
            return "pending";
          const enableVoices = formData["enableVoices"] as boolean | null | undefined;
          const voices = formData["voices"] as string[] | null | undefined;
          return enableVoices && voices && voices.length > 0
            ? "completed"
            : enableVoices
              ? "active"
              : "pending";
        case "qualities":
          if (!hasName || !hasValue || !hasDescription || !hasProvider)
            return "pending";
          if (!hasInputModalities || !hasOutputModalities) return "pending";
          if (
            !modalities?.output?.includes("image") &&
            !modalities?.output?.includes("audio")
          )
            return "pending";
          const enableQualities = formData["enableQualities"] as boolean | null | undefined;
          const qualities = formData["qualities"] as string[] | null | undefined;
          return enableQualities && qualities && qualities.length > 0
            ? "completed"
            : enableQualities
              ? "active"
              : "pending";
        default:
          return "pending";
      }
    },
    [],
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the model name, description, value, departments, and switches.",
        resetFields: [
          "name",
          "description",
          "value",
          "departmentIds",
          "active",
          "customModel",
          "enableModalities",
          "enableTemperature",
          "enablePricing",
          "enableVoices",
          "enableReasoningLevels",
          "enableQualities",
        ],
      },
      {
        id: "customUrl",
        title: "Custom Model URL",
        description: "Configure custom base URL for this model (optional).",
        resetFields: ["baseUrl", "customModel"],
        optional: true,
      },
      {
        id: "provider",
        title: "Provider",
        description: "Select the provider for this model.",
        resetFields: ["provider_id"],
      },
      {
        id: "inputModalities",
        title: "Input Modalities",
        description: "Configure input modalities.",
        resetFields: ["modalities"],
      },
      {
        id: "outputModalities",
        title: "Output Modalities",
        description: "Configure output modalities.",
        resetFields: ["modalities"],
      },
      {
        id: "temperature",
        title: "Temperature",
        description: "Configure temperature bounds (optional).",
        resetFields: ["temperature_bounds", "enableTemperature"],
        optional: true,
      },
      {
        id: "pricing",
        title: "Pricing",
        description: "Configure pricing for this model (optional).",
        resetFields: ["pricing", "selectedPricingTypes", "enablePricing"],
        optional: true,
      },
      {
        id: "reasoning",
        title: "Reasoning Levels",
        description: "Select reasoning levels (optional, text output only).",
        resetFields: ["reasoning_levels", "enableReasoningLevels"],
        optional: true,
      },
      {
        id: "voices",
        title: "Voices",
        description: "Select voices (optional, audio input/output only).",
        resetFields: ["voices", "enableVoices"],
        optional: true,
      },
      {
        id: "qualities",
        title: "Qualities",
        description: "Select qualities (optional, image/audio output only).",
        resetFields: ["qualities", "enableQualities"],
        optional: true,
      },
    ],
    []
  );

  // Initialize form from server data (for GenericForm)
  const initializeForm = useCallback(
    (_serverData: unknown, _isEditMode: boolean): Partial<Record<string, unknown>> => {
      // Form is already initialized via initialDraftState, so return empty object
      // GenericForm will use the formData prop we provide
      return {};
    },
    []
  );

  // Form field keys (for GenericForm)
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "provider_id",
      "value",
      "active",
      "departmentIds",
      "customModel",
      "baseUrl",
      "enableModalities",
      "enableTemperature",
      "enablePricing",
      "enableVoices",
      "enableReasoningLevels",
      "enableQualities",
      "temperature_bounds",
      "pricing",
      "selectedPricingTypes",
      "modalities",
      "reasoning_levels",
      "voices",
      "qualities",
    ],
    []
  );

  // Custom URL editing handlers (will be recreated in renderStep with stepFormData)
  const handleStartEditBaseUrl = useCallback(() => {
    setIsEditingBaseUrl(true);
    setEditingBaseUrlValue((draftState.baseUrl || "") as string);
  }, [draftState.baseUrl]);

  const handleSaveEditBaseUrl = useCallback(() => {
    setDraftState((prev) => ({ ...prev, baseUrl: editingBaseUrlValue }));
    setIsEditingBaseUrl(false);
    setEditingBaseUrlValue("");
  }, [editingBaseUrlValue]);

  const handleCancelEditBaseUrl = useCallback(() => {
    setIsEditingBaseUrl(false);
    setEditingBaseUrlValue("");
  }, []);

  // Calculate dots dynamically based on container width (for custom URL display)
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

      const dotsNeeded = Math.floor(availableWidth / dotWidth);
      setDotsCount(Math.max(50, dotsNeeded));
    };

    calculateDots();

    const resizeObserver = new ResizeObserver(calculateDots);
    if (dotsContainerRef.current) {
      resizeObserver.observe(dotsContainerRef.current);
    }

    window.addEventListener("resize", calculateDots);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", calculateDots);
    };
  }, [isEditMode, isEditingBaseUrl]);

  // Submit handler for GenericForm
  const handleSubmit = useCallback(
    async (formData: Record<string, unknown>): Promise<void> => {
      const name = formData["name"] as string | null | undefined;
      const description = formData["description"] as string | null | undefined;
      const provider_id = formData["provider_id"] as string | null | undefined;
      const value = formData["value"] as string | null | undefined;
      const customModel = formData["customModel"] as boolean | null | undefined;
      const baseUrl = formData["baseUrl"] as string | null | undefined;

      if (!name || !name.trim()) {
      setErrors((prev) => ({ ...prev, name: "Name is required" }));
      return;
    }

      if (!description || !description.trim()) {
      setErrors((prev) => ({
        ...prev,
        description: "Description is required",
      }));
      return;
    }

      if (!provider_id || !provider_id.trim()) {
      setErrors((prev) => ({
        ...prev,
        provider_id: "Provider is required",
      }));
      return;
    }

      if (!value || !value.trim()) {
      setErrors((prev) => ({
        ...prev,
        value: "Model value is required",
      }));
      return;
    }

    // Validate base_url if custom model
      if (customModel && (!baseUrl || baseUrl.trim() === "")) {
      setErrors((prev) => ({
        ...prev,
        baseUrl: "Base URL is required for custom models",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      // Transform temperature bounds for API (only if enabled)
        const enableTemperature = formData["enableTemperature"] as boolean | null | undefined;
        const temperature_bounds = formData["temperature_bounds"] as TemperatureBounds | null | undefined;
        const apiTemperatureBounds =
          enableTemperature && temperature_bounds
          ? {
              bounds_type: "range" as const,
              lower_bound: temperature_bounds.lower ?? 0.0,
              upper_bound: temperature_bounds.upper ?? 1.0,
              values_array: null,
            }
          : undefined;

      // Transform pricing for API (only if enabled)
        const enablePricing = formData["enablePricing"] as boolean | null | undefined;
        const pricing = formData["pricing"] as Record<string, { unit_id: string; price: number }[]> | null | undefined;
        const apiPricing =
          enablePricing &&
          pricing &&
          Object.keys(pricing).length > 0
            ? Object.entries(pricing).flatMap(([type, entries]) =>
              entries.map((entry) => ({
                pricing_type: type as "input" | "output" | "cached",
                unit_id: entry.unit_id,
                price: entry.price,
              })),
            )
          : undefined;

      // Transform modalities for API (default to text/text if not set)
        // Note: Modalities removed from API type - not used in server

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
          setIsSubmitting(false);
        return;
      }

      // Transform voices for API (only if enabled, otherwise all voices)
        const enableVoices = formData["enableVoices"] as boolean | null | undefined;
        const voices = formData["voices"] as string[] | null | undefined;
        const apiVoices =
          enableVoices && voices && voices.length > 0 ? voices : null;

        const departmentIds = formData["departmentIds"] as string[] | null | undefined;
        const active = formData["active"] as boolean | null | undefined;
        const enableReasoningLevels = formData["enableReasoningLevels"] as boolean | null | undefined;
        const reasoning_levels = formData["reasoning_levels"] as string[] | null | undefined;
        const enableQualities = formData["enableQualities"] as boolean | null | undefined;
        const qualities = formData["qualities"] as string[] | null | undefined;

      if (isEditMode && modelId) {
        await handleUpdateModel({
          model_id: modelId,
            provider_id: provider_id!,
            name: name!,
            description: description!,
            active: active ?? true,
            value: value!,
            department_ids: departmentIds || null,
            base_url: customModel ? baseUrl || null : null,
            ...(apiTemperatureBounds ? { temperature_bounds: apiTemperatureBounds } : {}),
            ...(apiPricing ? { pricing: apiPricing } : {}),
            // modalities removed - not in API type
          reasoning_levels:
              enableReasoningLevels && reasoning_levels && reasoning_levels.length > 0
                ? reasoning_levels
              : null,
            voices: apiVoices,
          qualities:
              enableQualities && qualities && qualities.length > 0
                ? qualities
              : null,
        });
        resetFormAndState();
        toast.success("Model updated successfully!");
        router.push(`/engine/models`);
      } else {
        await handleCreateModel({
            provider_id: provider_id!,
            name: name!,
            description: description!,
            active: active ?? true,
            value: value!,
            department_ids: departmentIds || null,
            base_url: customModel ? baseUrl || null : null,
            ...(apiTemperatureBounds ? { temperature_bounds: apiTemperatureBounds } : {}),
            ...(apiPricing ? { pricing: apiPricing } : {}),
            // modalities removed - not in API type
          reasoning_levels:
              enableReasoningLevels && reasoning_levels && reasoning_levels.length > 0
                ? reasoning_levels
              : null,
            voices: apiVoices,
          qualities:
              enableQualities && qualities && qualities.length > 0
                ? qualities
              : null,
        });
        resetFormAndState();
        toast.success("Model created successfully!");
        router.push(`/engine/models`);
      }
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode && modelId ? "update" : "create"} model: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsSubmitting(false);
        throw error;
      }
    },
    [
      isEditMode,
      modelId,
      effectiveProfile?.id,
      handleUpdateModel,
      handleCreateModel,
      resetFormAndState,
      router,
    ]
  );

  // Reset success message (for GenericForm)
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "customUrl":
        return "Custom URL reset";
      case "provider":
        return "Provider reset";
      case "inputModalities":
        return "Input modalities reset";
      case "outputModalities":
        return "Output modalities reset";
      case "temperature":
        return "Temperature reset";
      case "pricing":
        return "Pricing reset";
      case "reasoning":
        return "Reasoning levels reset";
      case "voices":
        return "Voices reset";
      case "qualities":
        return "Qualities reset";
      default:
        return "Reset";
    }
  }, []);

  // Submit button config (for GenericForm)
  const submitButton = useMemo(
    () => ({
      backUrl: "/engine/models",
      backLabel: "Back",
      createLabel: "Create Model",
      updateLabel: "Update Model",
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
      // Get current form values with proper typing
      const name = (stepFormData["name"] as string | null | undefined) ?? "";
      const description = (stepFormData["description"] as string | null | undefined) ?? "";
      const value = (stepFormData["value"] as string | null | undefined) ?? "";
      const provider_id = (stepFormData["provider_id"] as string | null | undefined) ?? "";
      const active = (stepFormData["active"] as boolean | null | undefined) ?? true;
      const departmentIds = (stepFormData["departmentIds"] as string[] | null | undefined) || [];
      const customModel = (stepFormData["customModel"] as boolean | null | undefined) ?? false;
      const baseUrl = (stepFormData["baseUrl"] as string | null | undefined) ?? "";
      const enableTemperature = (stepFormData["enableTemperature"] as boolean | null | undefined) ?? false;
      const enablePricing = (stepFormData["enablePricing"] as boolean | null | undefined) ?? false;
      const enableVoices = (stepFormData["enableVoices"] as boolean | null | undefined) ?? false;
      const enableReasoningLevels = (stepFormData["enableReasoningLevels"] as boolean | null | undefined) ?? false;
      const enableQualities = (stepFormData["enableQualities"] as boolean | null | undefined) ?? false;
      const temperature_bounds = stepFormData["temperature_bounds"] as TemperatureBounds | null | undefined;
      const pricing = stepFormData["pricing"] as Record<string, { unit_id: string; price: number }[]> | null | undefined;
      const selectedPricingTypes = (stepFormData["selectedPricingTypes"] as string[] | null | undefined) || [];
      const modalities = (stepFormData["modalities"] as { input: string[]; output: string[] } | null | undefined) || { input: ["text"], output: ["text"] };
      const reasoning_levels = (stepFormData["reasoning_levels"] as string[] | null | undefined) || [];
      const voices = (stepFormData["voices"] as string[] | null | undefined) || [];
      const qualities = (stepFormData["qualities"] as string[] | null | undefined) || [];

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
                value: name,
                onChange: (value) => setStepFormData({ name: value || null }),
                placeholder: "New Model",
                defaultName: "New Model",
                required: true,
              }}
              resetFields={[
                "name",
                "description",
                "value",
                "departmentIds",
                "active",
                "customModel",
                "enableModalities",
                "enableTemperature",
                "enablePricing",
                "enableVoices",
                "enableReasoningLevels",
                "enableQualities",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-model-description"
                    value={description}
                  onChange={(e) =>
                      setStepFormData({
                        description: e.target.value || null,
                      })
                  }
                  placeholder="Enter a brief description"
                  rows={3}
                    disabled={isReadonly}
                  className={errors.description ? "border-destructive" : ""}
                />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  data-testid="input-model-value"
                    value={value}
                    onChange={(e) => setStepFormData({ value: e.target.value || null })}
                  placeholder="Enter model value identifier (e.g., gpt-4, gemini-pro)"
                  className={errors.value ? "border-destructive" : ""}
                    disabled={isReadonly}
                />
              {errors.value && (
                <p className="text-sm text-destructive">{errors.value}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Unique identifier for this model (used in API calls)
              </p>
            </div>

            {validDepartmentIds && validDepartmentIds.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                  <GenericPicker
                    items={departments.map((d) => ({
                      id: d.department_id ?? "",
                      name: d.name ?? "",
                      description: d.description ?? "",
                    }))}
                    itemIds={validDepartmentIds}
                      selectedIds={departmentIds}
                    onSelect={(ids) =>
                        setStepFormData({
                          departmentIds: ids.length > 0 ? ids : null,
                        })
                    }
                    getId={(dept: { id: string }) => dept.id}
                    getLabel={(dept: { name?: string | null }) => dept.name || ""}
                    getSearchText={(dept: { name?: string | null; description?: string | null }) =>
                      `${dept.name || ""} ${dept.description || ""}`
                    }
                    placeholder="All Departments"
                      disabled={isReadonly}
                    multiSelect={true}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                  />
              </div>
            )}

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
                      data-testid="switch-model-active"
                        checked={active}
                      onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                      }
                        disabled={isReadonly}
                    />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive models will not be available for selection
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="customModel"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                    Custom Model
                  </Label>
                    <Switch
                      id="customModel"
                      data-testid="switch-model-custom"
                        checked={customModel}
                      onCheckedChange={(checked) => {
                          setStepFormData({
                            customModel: checked,
                            ...(checked ? {} : { baseUrl: null }),
                          });
                        }}
                        disabled={isReadonly}
                      />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Use a custom base URL for this model
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="enable-temperature"
                      className="text-sm flex items-center gap-1.5"
                    >
                      <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                      Temperature
                    </Label>
                      <Switch
                        id="enable-temperature"
                        data-testid="switch-model-temperature"
                          checked={enableTemperature}
                        onCheckedChange={(checked) => {
                          if (checked) {
                              setStepFormData({
                              enableTemperature: true,
                                temperature_bounds: temperature_bounds || {
                                type: "range",
                                lower: 0.0,
                                upper: 1.0,
                              },
                              });
                          } else {
                              setStepFormData({
                              enableTemperature: false,
                                temperature_bounds: null,
                              });
                          }
                        }}
                          disabled={isReadonly}
                      />
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Configure temperature bounds for this model
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="enable-pricing"
                      className="text-sm flex items-center gap-1.5"
                    >
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      Pricing
                    </Label>
                      <Switch
                        id="enable-pricing"
                        data-testid="switch-model-pricing"
                          checked={enablePricing}
                        onCheckedChange={(checked) => {
                            setStepFormData({
                            enablePricing: checked,
                              pricing: checked ? pricing || {} : {},
                            selectedPricingTypes: checked
                                ? selectedPricingTypes || []
                              : [],
                            });
                        }}
                          disabled={isReadonly}
                      />
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Configure pricing for this model
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="enable-reasoning"
                      className="text-sm flex items-center gap-1.5"
                    >
                      <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                      Reasoning
                    </Label>
                      <Switch
                        id="enable-reasoning"
                        data-testid="switch-model-reasoning"
                          checked={enableReasoningLevels}
                        onCheckedChange={(checked) => {
                          if (checked) {
                              setStepFormData({
                              enableReasoningLevels: true,
                                reasoning_levels: reasoning_levels.length > 0 ? reasoning_levels : [],
                              });
                          } else {
                              setStepFormData({
                              enableReasoningLevels: false,
                                reasoning_levels: null,
                              });
                          }
                        }}
                          disabled={isReadonly}
                      />
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Select reasoning levels for this model
                  </p>
                </div>
              </div>
            </div>
                    </div>
            </StepCard>
          );

        case "customUrl":
          if (!customModel) return null;
            return (
            <CustomUrlStep
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              baseUrl={baseUrl}
              setStepFormData={setStepFormData}
              errors={errors}
              isSubmitting={isSubmitting}
              {...(onReset ? { onReset } : {})}
            />
          );

        case "provider":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["provider_id"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
                <ProviderCardGrid
                  providerMapping={providers.reduce((acc: Record<string, { name: string; description: string }>, p) => {
                    if (p.provider_id) {
                      acc[String(p.provider_id)] = { 
                        name: p.name ?? "", 
                        description: p.description ?? "" 
                      };
                    }
                    return acc;
                  }, {} as Record<string, { name: string; description: string }>)}
                  validProviderIds={providers.filter((p): p is typeof p & { provider_id: string } => !!p.provider_id).map((p) => String(p.provider_id))}
                selectedProviderId={provider_id || null}
                  onSelect={(providerId) => {
                  setStepFormData({ provider_id: providerId || null });
                  }}
                readonly={isReadonly}
                />
                {errors.provider_id && (
                <p className="text-sm text-destructive mt-2">
                    {errors.provider_id}
                  </p>
                )}
            </StepCard>
          );

        case "inputModalities":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["modalities"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
                <InputModalityCardGrid
                selectedIds={modalities.input || ["text"]}
                  onSelect={(ids) =>
                  setStepFormData({
                      modalities: {
                        input: ids.length > 0 ? ids : ["text"],
                      output: modalities.output || ["text"],
                      },
                  })
                  }
                readonly={isReadonly}
                />
            </StepCard>
          );

        case "outputModalities":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["modalities"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
                <OutputModalityCardGrid
                selectedIds={modalities.output || ["text"]}
                  onSelect={(ids) =>
                  setStepFormData({
                      modalities: {
                      input: modalities.input || ["text"],
                        output: ids.length > 0 ? ids : ["text"],
                      },
                  })
                }
                readonly={isReadonly}
              />
            </StepCard>
          );

        case "temperature":
          if (!enableTemperature) return null;
            return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["temperature_bounds", "enableTemperature"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
                  <TemperatureBoundsPicker
                    bounds={
                  temperature_bounds || {
                        type: "range",
                        lower: 0.0,
                        upper: 1.0,
                      }
                    }
                    onBoundsChange={(bounds) =>
                  setStepFormData({
                        temperature_bounds: bounds,
                  })
                }
                disabled={isReadonly}
              />
            </StepCard>
          );

        case "pricing":
          if (!enablePricing) return null;
            return (
              <>
              <StepCard
                stepStatus={stepStatus}
                stepNumber={stepNumber}
                stepTitle={stepTitle}
                stepDescription={stepDescription}
                isReadonly={isReadonly}
                isEditMode={isEditMode}
                resetFields={["pricing", "selectedPricingTypes", "enablePricing"]}
                {...(onReset ? { onReset } : {})}
                resetLabel="Reset"
              >
                    <PricingTypeCardGrid
                  selectedIds={selectedPricingTypes}
                      onSelect={(ids) => {
                    const newPricing = { ...pricing };
                          const newSelectedTypes = ids;

                          Object.keys(newPricing).forEach((type) => {
                            if (!newSelectedTypes.includes(type)) {
                              delete newPricing[type];
                            }
                          });

                          newSelectedTypes.forEach((type) => {
                            if (!newPricing[type]) {
                              newPricing[type] = [];
                            }
                          });

                    setStepFormData({
                            selectedPricingTypes: newSelectedTypes,
                            pricing: newPricing,
                        });
                      }}
                  readonly={isReadonly}
                    />
              </StepCard>

              {selectedPricingTypes.map((pricingType) => {
                const pricingEntries = pricing?.[pricingType] || [];
                  const selectedUnitIds = pricingEntries.map((e) => e.unit_id);
                  const typeLabel =
                    pricingType.charAt(0).toUpperCase() + pricingType.slice(1);

                  return (
                  <StepCard
                      key={pricingType}
                    stepStatus={pricingEntries.length > 0 ? "completed" : stepStatus}
                    stepNumber={stepNumber}
                    stepTitle={`${typeLabel} Pricing`}
                    stepDescription={`Configure pricing entries for ${pricingType} tokens`}
                    isReadonly={isReadonly}
                    isEditMode={isEditMode}
                    resetFields={["pricing"]}
                    {...(onReset ? { onReset } : {})}
                    resetLabel="Reset"
                  >
                        <UnitCardGrid
                          units={units}
                          selectedIds={selectedUnitIds}
                          onSelect={(unitIds) => {
                        const newPricing = { ...pricing };
                              if (!newPricing[pricingType]) {
                                newPricing[pricingType] = [];
                              }

                        const currentEntries = newPricing[pricingType] || [];
                              const currentUnitIds = new Set(
                                currentEntries.map((e) => e.unit_id),
                              );
                              const newUnitIds = new Set(unitIds);
                              const addedUnitIds = unitIds.filter(
                                (id) => !currentUnitIds.has(id),
                              );
                              const removedUnitIds = Array.from(
                                currentUnitIds,
                              ).filter((id) => !newUnitIds.has(id));

                              const updatedEntries = currentEntries.filter(
                                (e) => !removedUnitIds.includes(e.unit_id),
                              );

                              addedUnitIds.forEach((unitId) => {
                                updatedEntries.push({
                                  unit_id: unitId,
                                  price: 0.0,
                                });
                              });

                              newPricing[pricingType] = updatedEntries;

                        setStepFormData({
                                pricing: newPricing,
                            });
                          }}
                      readonly={isReadonly}
                          enablePriceEditing={true}
                          prices={Object.fromEntries(
                            pricingEntries.map((e) => [e.unit_id, e.price]),
                          )}
                          onPriceChange={(unitId, price) => {
                        const newPricing = { ...pricing };
                              if (!newPricing[pricingType]) {
                                newPricing[pricingType] = [];
                              }

                              const entries = newPricing[pricingType] || [];
                              const entryIndex = entries.findIndex(
                                (e) => e.unit_id === unitId,
                              );

                              if (entryIndex >= 0 && entries[entryIndex]) {
                                entries[entryIndex] = {
                                  unit_id: entries[entryIndex].unit_id,
                                  price,
                                };
                              } else {
                                entries.push({
                                  unit_id: unitId,
                                  price,
                                });
                              }

                              newPricing[pricingType] = entries;

                        setStepFormData({
                                pricing: newPricing,
                            });
                          }}
                        />
                  </StepCard>
                  );
                })}
              </>
            );

        case "reasoning":
          if (!modalities.output?.includes("text") || !enableReasoningLevels) return null;
            return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["reasoning_levels", "enableReasoningLevels"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
                  <ReasoningCardGrid
                selectedIds={reasoning_levels}
                    onSelect={(ids) =>
                  setStepFormData({
                        reasoning_levels: ids,
                  })
                }
                readonly={isReadonly}
              />
            </StepCard>
          );

        case "voices":
          if (
            !modalities.input?.includes("audio") ||
            !modalities.output?.includes("audio") ||
            !enableVoices
          )
            return null;
            return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["voices", "enableVoices"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                      <Label
                        htmlFor="enable-voices"
                        className="text-sm font-medium"
                      >
                        Enable Voice Selection
                      </Label>
                      <Switch
                        id="enable-voices"
                    checked={enableVoices}
                        onCheckedChange={(checked) => {
                          if (checked) {
                        setStepFormData({
                              enableVoices: true,
                          voices: voices.length > 0 ? voices : [],
                        });
                          } else {
                        setStepFormData({
                              enableVoices: false,
                          voices: null,
                        });
                          }
                        }}
                    disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Select specific voices for this model. If disabled or none
                      selected, all available voices are allowed.
                    </p>
                  </div>
              {enableVoices && (
                    <div className="pt-2">
                      <VoiceCardGrid
                    selectedIds={voices}
                        onSelect={(ids) =>
                      setStepFormData({
                            voices: ids.length > 0 ? ids : [],
                      })
                        }
                    readonly={isReadonly}
                      />
                    </div>
                  )}
            </StepCard>
          );

        case "qualities":
          if (
            (!modalities.output?.includes("image") &&
              !modalities.output?.includes("audio")) ||
            !enableQualities
          )
            return null;
            return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={["qualities", "enableQualities"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Image
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Label
                        htmlFor="enable-qualities"
                        className="text-sm font-medium"
                      >
                        Enable Qualities
                      </Label>
                      <Switch
                        id="enable-qualities"
                    checked={enableQualities}
                        onCheckedChange={(checked) => {
                          if (checked) {
                        setStepFormData({
                              enableQualities: true,
                          qualities: qualities.length > 0 ? qualities : [],
                        });
                          } else {
                        setStepFormData({
                              enableQualities: false,
                          qualities: null,
                        });
                          }
                        }}
                    disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Select specific quality levels for this model. If
                      disabled, all available quality levels are allowed.
                    </p>
                  </div>
              {enableQualities && (
                    <div className="pt-2">
                      <QualityCardGrid
                    selectedIds={qualities}
                        onSelect={(ids) =>
                      setStepFormData({ qualities: ids })
                        }
                    readonly={isReadonly}
                      />
                    </div>
                  )}
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      isReadonly,
      isEditMode,
      isSubmitting,
      isEditingBaseUrl,
      editingBaseUrlValue,
      dotsCount,
      dotsContainerRef,
      errors,
      validDepartmentIds,
      departments,
      providers,
      units,
      handleStartEditBaseUrl,
      handleSaveEditBaseUrl,
      handleCancelEditBaseUrl,
    ]
  );

  return (
    <div className="w-full p-6 space-y-8">
      <GenericForm
        nuqsParsers={
          modelSearchParamsClient as Record<string, Parser<unknown>>
        }
        steps={steps}
        getStepStatus={getStepStatus}
        formData={formData}
        setFormData={setFormData}
        serverData={modelData}
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
  );
}
