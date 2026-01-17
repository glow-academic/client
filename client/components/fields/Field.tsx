/**
 * Field.tsx
 * Used to create and manage fields
 * Updated to use unified get/save endpoints following Persona.tsx pattern
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { StepCard } from "@/components/common/forms/StepCard";
import { ParameterCardGrid } from "@/components/common/parameters/ParameterCardGrid";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Power } from "lucide-react";
import type { InputOf, OutputOf } from "@/lib/api/types";

// Types defined inline using InputOf/OutputOf
type GetFieldIn = InputOf<"/api/v4/fields/get", "post">;
type GetFieldOut = OutputOf<"/api/v4/fields/get", "post">;
type SaveFieldIn = InputOf<"/api/v4/fields/save", "post">;
type SaveFieldOut = OutputOf<"/api/v4/fields/save", "post">;
type PatchFieldDraftIn = InputOf<"/api/v4/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v4/fields/draft", "patch">;

type FieldData = GetFieldOut;

export interface FieldProps {
  fieldId?: string;
  // Unified field data (works for both new and edit modes)
  fieldData?: FieldData;
  saveFieldAction?: (input: SaveFieldIn) => Promise<SaveFieldOut>;
  patchFieldDraftAction?: (
    input: PatchFieldDraftIn
  ) => Promise<PatchFieldDraftOut>;
}

export default function Field({
  fieldId,
  fieldData: serverFieldData,
  saveFieldAction,
  patchFieldDraftAction,
}: FieldProps) {
  const searchParams = useSearchParams();
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const router = useRouter();
  const isEditMode = !!fieldId;

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = React.useCallback(
    (data: typeof serverFieldData): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("field_id" in data && data.field_id) {
          return `field_id:${String(data.field_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("valid_department_ids" in data) {
          keyFields["valid_department_ids"] = Array.isArray(
            data["valid_department_ids"]
          )
            ? data["valid_department_ids"].sort().join(",")
            : data["valid_department_ids"];
        }
        if ("valid_parameter_ids" in data) {
          keyFields["valid_parameter_ids"] = Array.isArray(
            data["valid_parameter_ids"]
          )
            ? data["valid_parameter_ids"].sort().join(",")
            : data["valid_parameter_ids"];
        }
        const sortedKeys = Object.keys(keyFields).sort();
        const hash = sortedKeys
          .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
          .join("|");
        return `new:${hash.length}:${hash.slice(0, 100)}`;
      }
      return String(data);
    },
    []
  );

  const fieldDataId = React.useMemo(
    () => stabilizeServerProp(serverFieldData),
    [serverFieldData, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerFieldDataRef = React.useRef(serverFieldData);
  latestServerFieldDataRef.current = serverFieldData;

  // Use refs to track stable server props
  const stableFieldDataRef = React.useRef<{
    data: typeof serverFieldData;
    id: string | null;
  }>({
    data: serverFieldData,
    id: fieldDataId,
  });

  React.useEffect(() => {
    if (stableFieldDataRef.current.id !== fieldDataId) {
      stableFieldDataRef.current = {
        data: latestServerFieldDataRef.current,
        id: fieldDataId,
      };
    }
  }, [fieldDataId]);

  const fieldData = stableFieldDataRef.current.data;

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      // TODO: Implement generation logic for fields
      // For now, check if generation capability exists
      if (fieldData?.general_agent_id) {
        // When generation is implemented, trigger it here
        // handleGenerateResources([...]);
        toast.info("Generation not yet implemented for fields");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [fieldData?.general_agent_id]);

  // Get valid options from server data
  const validDepartmentIds = useMemo(() => {
    return fieldData?.valid_department_ids || [];
  }, [fieldData?.valid_department_ids]);

  // Convert departments array to mapping for UI components
  const departmentMapping = useMemo(() => {
    const departments = fieldData?.departments || [];
    return Object.fromEntries(
      departments.map((dept) => [
        dept.department_id,
        { name: dept.name, description: dept.description || undefined }
      ])
    ) as Record<string, { name: string; description?: string }>;
  }, [fieldData?.departments]);

  const validParameterIds = useMemo(() => {
    return fieldData?.valid_parameter_ids || [];
  }, [fieldData?.valid_parameter_ids]);

  // Convert parameters array to mapping for UI components
  const parameterMapping = useMemo(() => {
    const parameters = fieldData?.parameters || [];
    return Object.fromEntries(
      parameters.map((param) => [
        param.parameter_id,
        { name: param.name, description: param.description || undefined }
      ])
    ) as Record<string, { name: string; description?: string }>;
  }, [fieldData?.parameters]);

  // Inline parsers for URL-backed state
  const fieldSearchParamsClient = {
    draftId: parseAsString,
  } as const;

  // URL-backed state using nuqs
  const [urlParams] = useQueryStates(fieldSearchParamsClient, {
    history: "replace",
    shallow: true,
  });

  // Get draftId from URL
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Draft state type
  type DraftState = {
    name: string;
    description: string;
    active: boolean;
    departmentIds: string[];
    conditionalParameterIds: string[];
  };

  // Initialize draft state from server data
  const initialDraftState = useMemo((): DraftState => {
    if (!fieldData) {
      const isSuperadmin = effectiveProfile?.role === "superadmin";
      const defaultDepartmentIds = getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id || null
      );
      return {
        name: "New Field",
        description: "",
        active: true,
        departmentIds: defaultDepartmentIds,
        conditionalParameterIds: [],
      };
    }

    // If draftId exists, server should have merged draft payload into data
    return {
      name: fieldData.name || "New Field",
      description: fieldData.description || "",
      active: fieldData.active ?? true,
      departmentIds: fieldData.department_ids || [],
      conditionalParameterIds: fieldData.conditional_parameter_ids || [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fieldData,
    fieldDataId,
    draftId,
    urlDraftId,
    fieldData?.name,
    fieldData?.description,
    fieldData?.active,
    fieldData?.department_ids,
    fieldData?.conditional_parameter_ids,
    effectiveProfile?.role,
    effectiveProfile?.primary_department_id,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes
  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    if (currentStateStr !== newStateStr) {
      // Check if new state is "empty" but current state has content
      const newStateIsEmpty =
        (!initialDraftState.name || initialDraftState.name.trim() === "") &&
        (initialDraftState.departmentIds?.length || 0) === 0;

      setDraftState((currentDraftState) => {
        const currentStateHasContent =
          (currentDraftState.name?.trim() || "").length > 0 ||
          (currentDraftState.departmentIds?.length || 0) > 0;

        // Prevent overwriting with empty values if current state has content
        // BUT: Always update boolean fields from initialDraftState
        if (newStateIsEmpty && currentStateHasContent) {
          return {
            ...currentDraftState,
            active: initialDraftState.active,
          };
        }

        return initialDraftState;
      });

      prevInitialDraftStateRef.current = newStateStr;
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
    patchDraftAction: patchFieldDraftAction
      ? async (input) => {
          const result = await patchFieldDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: input.body.patch as Record<string, unknown>,
              expected_version: input.body.expected_version,
            } as PatchFieldDraftIn["body"],
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

  // Merge draftState with urlParams for formData
  const formData = useMemo(() => {
    return {
      ...draftState,
    } as Record<string, unknown>;
  }, [draftState]);

  // Wrapper for setFormData that updates draftState
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (
          key === "name" ||
          key === "description" ||
          key === "active" ||
          key === "departmentIds" ||
          key === "conditionalParameterIds"
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

  // Set breadcrumb metadata
  useEffect(() => {
    if (isEditMode && fieldData && fieldId && fieldData.name) {
      setEntityMetadata({
        entityId: fieldId,
        entityName: fieldData.name,
        entityType: "parameter", // Using "parameter" as closest match since "field" not in allowed types
      });
    }

    return () => {
      if (fieldId) {
        clearEntityMetadata(fieldId);
      }
    };
  }, [
    isEditMode,
    fieldData,
    fieldId,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Disabled logic based on can_edit flag - standardized for all resource components
  // Check can_edit in both new and edit modes to show disabled_reason when agents are missing
  const disabled = useMemo(() => {
    if (!fieldData) return false;
    return !fieldData.can_edit;
  }, [fieldData]);

  // Readonly logic (for backward compatibility)
  const isReadonly = disabled;

  // Steps configuration
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the field name, description, departments, and active status.",
        resetFields: ["name", "description", "active", "departmentIds"],
      },
      {
        id: "conditionalParameters",
        title: "Conditional Parameters",
        description:
          "Select parameters to show when this field is selected (enables parameter chaining).",
        resetFields: ["conditionalParameterIds"],
      },
    ],
    []
  );

  // Step status calculation
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(formData["name"] as string | null | undefined)?.trim();

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "conditionalParameters":
          if (!hasName) return "pending";
          const hasParameters =
            ((formData["conditionalParameterIds"] as string[] | null | undefined)
              ?.length || 0) > 0;
          return hasParameters ? "completed" : "active";
        default:
          return "pending";
      }
    },
    []
  );

  // Form initialization from server data
  const initializeForm = useCallback(
    (serverData: unknown, isEditMode: boolean): Partial<Record<string, unknown>> => {
      if (!isEditMode || !serverData || typeof serverData !== "object" || !("field_id" in serverData)) {
        return {};
      }

      const fieldData = serverData as FieldData;
      const updates: Partial<Record<string, unknown>> = {};

      if (fieldData.name) updates["name"] = fieldData.name;
      if (fieldData.description)
        updates["description"] = fieldData.description;
      if (fieldData.active !== undefined) updates["active"] = fieldData.active;
      if (fieldData.department_ids && Array.isArray(fieldData.department_ids))
        updates["departmentIds"] = fieldData.department_ids;
      if (fieldData.conditional_parameter_ids && Array.isArray(fieldData.conditional_parameter_ids))
        updates["conditionalParameterIds"] = fieldData.conditional_parameter_ids;

      return updates;
    },
    []
  );

  // Submit handler - uses unified save endpoint
  const handleSubmit = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!formData["name"]) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      if (!saveFieldAction) {
        throw new Error("saveFieldAction is required");
      }

      // Ensure profileId exists - required for API calls
      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      const finalData = {
        name: formData["name"] as string,
        description: (formData["description"] as string) || "",
        active: (formData["active"] as boolean) ?? true,
        department_ids: (formData["departmentIds"] as string[] | null | undefined) ?? [],
        conditional_parameter_ids: (formData["conditionalParameterIds"] as string[] | null | undefined) ?? [],
        input_field_id: isEditMode && fieldId ? fieldId : null,
      };

      try {
        await saveFieldAction({
          body: finalData,
        });
        toast.success(
          `Field ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/management/fields");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} field: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [isEditMode, fieldId, effectiveProfile?.id, saveFieldAction, router]
  );

  // Render step
  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData: stepFormData,
      setFormData: setStepFormData,
    }: {
      stepId: string;
      stepStatus: StepStatus;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
    }) => {
      switch (stepId) {
        case "basic": {
          const name = (stepFormData["name"] as string | null | undefined) || "";
          const description =
            (stepFormData["description"] as string | null | undefined) || "";
          const active = (stepFormData["active"] as boolean | null | undefined) ?? true;
          const departmentIds =
            (stepFormData["departmentIds"] as string[] | null | undefined) || [];

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
                onChange: (value) => setStepFormData({ name: value }),
                placeholder: "New Field",
              }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    data-testid="input-field-description"
                    value={description}
                    onChange={(e) =>
                      setStepFormData({ description: e.target.value })
                    }
                    placeholder="Enter a brief description (optional)"
                    rows={3}
                    disabled={isReadonly}
                  />
                </div>

                {/* Department Selection */}
                {validDepartmentIds && validDepartmentIds.length > 1 ? (
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <GenericPicker
                      items={departmentMapping}
                      itemIds={validDepartmentIds}
                      selectedIds={departmentIds}
                      onSelect={(ids) => setStepFormData({ departmentIds: ids })}
                      getId={(dept) => {
                        const entry = Object.entries(departmentMapping).find(
                          ([, v]) => v === dept
                        );
                        return entry ? entry[0] : "";
                      }}
                      getLabel={(dept) =>
                        (dept["name"] as string | undefined) || ""
                      }
                      getSearchText={(dept) =>
                        `${dept["name"]} ${dept["description"] || ""}`
                      }
                      placeholder="All Departments"
                      disabled={isReadonly}
                      multiSelect={true}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                  </div>
                ) : null}

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
                        data-testid="switch-field-active"
                        checked={active}
                        onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                        }
                        disabled={isReadonly}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Inactive fields will not be available for selection
                    </p>
                  </div>
                </div>
              </div>
            </StepCard>
          );
        }

        case "conditionalParameters": {
          const conditionalParameterIds =
            (stepFormData["conditionalParameterIds"] as string[] | null | undefined) || [];

          if (!validParameterIds || validParameterIds.length === 0) {
            return null;
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <ParameterCardGrid
                parameterMapping={parameterMapping}
                validParameterIds={validParameterIds}
                selectedParameterIds={conditionalParameterIds}
                onSelect={(ids) =>
                  setStepFormData({ conditionalParameterIds: ids })
                }
                readonly={isReadonly}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      isReadonly,
      isEditMode,
      validDepartmentIds,
      departmentMapping,
      validParameterIds,
      parameterMapping,
    ]
  );

  return (
    <div
      className="w-full p-6 space-y-8"
      data-page={`field-${isEditMode ? "edit" : "new"}`}
    >
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={fieldData?.disabled_reason ?? null}
        entityType="field"
      />

      <GenericForm
        nuqsParsers={
          fieldSearchParamsClient as Record<string, Parser<unknown>>
        }
        steps={steps}
        getStepStatus={getStepStatus}
        formData={formData}
        setFormData={setFormData}
        serverData={fieldData}
        initializeForm={initializeForm}
        formFieldKeys={["name", "description", "active", "departmentIds", "conditionalParameterIds"]}
        resetSuccessMessage={(stepId) => {
          if (stepId === "basic") return "Basic information reset";
          if (stepId === "conditionalParameters") return "Conditional parameters reset";
          return `${stepId} reset`;
        }}
        onSubmit={handleSubmit}
        submitButton={{
          createLabel: "Create Field",
          updateLabel: "Update Field",
          backUrl: "/management/fields",
          backLabel: "Back",
        }}
        isReadonly={isReadonly}
        isEditMode={isEditMode}
        renderStep={renderStep}
      />
    </div>
  );
}
