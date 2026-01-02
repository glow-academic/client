/**
 * Field.tsx
 * Used to create and manage fields
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
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Power } from "lucide-react";

// Type-only imports from server pages
import type {
  FieldDetailOut,
  UpdateFieldIn,
  UpdateFieldOut,
  PatchFieldDraftIn,
  PatchFieldDraftOut,
} from "@/app/(main)/management/fields/[fieldId]/page";
import type {
  CreateFieldIn,
  CreateFieldOut,
  FieldNewOut,
} from "@/app/(main)/management/fields/new/page";

export interface FieldProps {
  fieldId?: string;
  // For create mode: default field detail with options
  fieldDetailDefault?: FieldNewOut;
  // For edit mode: field detail with options
  fieldDetail?: FieldDetailOut;
  createFieldAction?: (input: CreateFieldIn) => Promise<CreateFieldOut>;
  updateFieldAction?: (input: UpdateFieldIn) => Promise<UpdateFieldOut>;
  patchFieldDraftAction?: (
    input: PatchFieldDraftIn
  ) => Promise<PatchFieldDraftOut>;
}

export default function Field({
  fieldId,
  fieldDetailDefault: serverFieldDetailDefault,
  fieldDetail: serverFieldDetail,
  createFieldAction,
  updateFieldAction,
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
    (
      data: typeof serverFieldDetail | typeof serverFieldDetailDefault
    ): string | null => {
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

  const fieldDetailId = React.useMemo(
    () => stabilizeServerProp(serverFieldDetail),
    [serverFieldDetail, stabilizeServerProp]
  );
  const fieldDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverFieldDetailDefault),
    [serverFieldDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerFieldDetailRef = React.useRef(serverFieldDetail);
  const latestServerFieldDetailDefaultRef = React.useRef(
    serverFieldDetailDefault
  );

  latestServerFieldDetailRef.current = serverFieldDetail;
  latestServerFieldDetailDefaultRef.current = serverFieldDetailDefault;

  // Use refs to track stable server props
  const stableFieldDetailRef = React.useRef<{
    data: typeof serverFieldDetail;
    id: string | null;
  }>({
    data: serverFieldDetail,
    id: fieldDetailId,
  });
  const stableFieldDetailDefaultRef = React.useRef<{
    data: typeof serverFieldDetailDefault;
    id: string | null;
  }>({
    data: serverFieldDetailDefault,
    id: fieldDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableFieldDetailRef.current.id !== fieldDetailId) {
      stableFieldDetailRef.current = {
        data: latestServerFieldDetailRef.current,
        id: fieldDetailId,
      };
    }
  }, [fieldDetailId]);

  React.useEffect(() => {
    if (stableFieldDetailDefaultRef.current.id !== fieldDetailDefaultId) {
      stableFieldDetailDefaultRef.current = {
        data: latestServerFieldDetailDefaultRef.current,
        id: fieldDetailDefaultId,
      };
    }
  }, [fieldDetailDefaultId]);

  const fieldDetail = stableFieldDetailRef.current.data;
  const fieldDetailDefault = stableFieldDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const fieldDataId = React.useMemo(() => {
    const data = isEditMode ? fieldDetail : fieldDetailDefault;
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
  }, [isEditMode, fieldDetail, fieldDetailDefault]);

  const stableFieldDataRef = React.useRef<{
    data: typeof fieldDetail | typeof fieldDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? fieldDetail : fieldDetailDefault,
    id: fieldDataId,
  });

  React.useEffect(() => {
    if (stableFieldDataRef.current.id !== fieldDataId) {
      stableFieldDataRef.current = {
        data: isEditMode ? fieldDetail : fieldDetailDefault,
        id: fieldDataId,
      };
    }
  }, [isEditMode, fieldDetail, fieldDetailDefault, fieldDataId]);

  const fieldData = stableFieldDataRef.current.data;

  // Get valid options from server data
  const validDepartmentIds = useMemo(() => {
    return (
      fieldDetail?.valid_department_ids ||
      fieldDetailDefault?.valid_department_ids ||
      []
    );
  }, [
    fieldDetail?.valid_department_ids,
    fieldDetailDefault?.valid_department_ids,
  ]);

  // Convert departments array to mapping for UI components
  const departmentMapping = useMemo(() => {
    const departments = fieldDetail?.departments || fieldDetailDefault?.departments || [];
    return Object.fromEntries(
      departments.map((dept) => [
        dept.department_id,
        { name: dept.name, description: dept.description || undefined }
      ])
    ) as Record<string, { name: string; description?: string }>;
  }, [fieldDetail?.departments, fieldDetailDefault?.departments]);

  const validParameterIds = useMemo(() => {
    return (
      fieldDetail?.valid_parameter_ids ||
      fieldDetailDefault?.valid_parameter_ids ||
      []
    );
  }, [
    fieldDetail?.valid_parameter_ids,
    fieldDetailDefault?.valid_parameter_ids,
  ]);

  // Convert parameters array to mapping for UI components
  const parameterMapping = useMemo(() => {
    const parameters = fieldDetail?.parameters || fieldDetailDefault?.parameters || [];
    return Object.fromEntries(
      parameters.map((param) => [
        param.parameter_id,
        { name: param.name, description: param.description || undefined }
      ])
    ) as Record<string, { name: string; description?: string }>;
  }, [fieldDetail?.parameters, fieldDetailDefault?.parameters]);

  // Inline parsers for URL-backed state
  const fieldSearchParamsClient = {
    draftId: parseAsString,
  } as const;

  // URL-backed state using nuqs
  const [urlParams, setUrlParams] = useQueryStates(fieldSearchParamsClient, {
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
    const data = isEditMode ? fieldDetail : fieldDetailDefault;
    if (!data) {
      const isSuperadmin = effectiveProfile?.role === "superadmin";
      const defaultDepartmentIds = getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId || null
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
      name: data.name || "New Field",
      description: data.description || "",
      active: data.active ?? true,
      departmentIds: data.department_ids || [],
      conditionalParameterIds: data.conditional_parameter_ids || [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    fieldDetail,
    fieldDetailDefault,
    fieldDetailId,
    fieldDetailDefaultId,
    draftId,
    urlDraftId,
    fieldDetailDefault?.name,
    fieldDetailDefault?.description,
    fieldDetailDefault?.department_ids,
    fieldDetailDefault?.conditional_parameter_ids,
    fieldDetail?.name,
    fieldDetail?.description,
    fieldDetail?.active,
    fieldDetail?.department_ids,
    fieldDetail?.conditional_parameter_ids,
    effectiveProfile?.role,
    effectiveProfile?.primaryDepartmentId,
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
    if (isEditMode && fieldDetail && fieldId) {
      setEntityMetadata({
        entityId: fieldId,
        entityName: fieldDetail.name,
        entityType: "field",
      });
    }

    return () => {
      if (fieldId) {
        clearEntityMetadata(fieldId);
      }
    };
  }, [
    isEditMode,
    fieldDetail,
    fieldId,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Readonly logic
  const isReadonly = useMemo(() => {
    if (!isEditMode || !fieldDetail) return false;
    return !fieldDetail.can_edit;
  }, [isEditMode, fieldDetail]);

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
    (serverData: FieldDetailOut | FieldNewOut, editMode: boolean) => {
      if (!editMode || !("field_id" in serverData)) {
        return {};
      }

      const fieldDetail = serverData as FieldDetailOut;
      const updates: Partial<
        Record<keyof typeof fieldSearchParamsClient, unknown>
      > = {};

      if (fieldDetail.name) updates["name"] = fieldDetail.name;
      if (fieldDetail.description)
        updates["description"] = fieldDetail.description;
      if (fieldDetail.active !== undefined) updates["active"] = fieldDetail.active;
      if (fieldDetail.department_ids)
        updates["departmentIds"] = fieldDetail.department_ids;
      if (fieldDetail.conditional_parameter_ids)
        updates["conditionalParameterIds"] = fieldDetail.conditional_parameter_ids;

      return updates;
    },
    []
  );

  // Submit handler
  const handleSubmit = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!formData["name"]) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      const finalData = {
        name: formData["name"] as string,
        description: (formData["description"] as string) || "",
        active: (formData["active"] as boolean) ?? true,
        department_ids: (formData["departmentIds"] as string[] | null | undefined) || null,
        conditional_parameter_ids: (formData["conditionalParameterIds"] as string[] | null | undefined) || null,
      };

      if (isEditMode) {
        if (!updateFieldAction) {
          throw new Error("updateFieldAction is required");
        }
        try {
          await updateFieldAction({
            body: { ...finalData, field_id: fieldId! },
          });
        toast.success("Field updated successfully!");
          router.push("/management/fields");
        } catch (error) {
          toast.error(
            `Failed to update field: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      } else {
        if (!createFieldAction) {
          throw new Error("createFieldAction is required");
        }
        try {
          await createFieldAction({ body: finalData });
        toast.success("Field created successfully!");
          router.push("/management/fields");
        } catch (error) {
          toast.error(
            `Failed to create field: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      }
    },
    [isEditMode, fieldId, updateFieldAction, createFieldAction, router]
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
                onFocus: (e) => {
                  if (e.target.value === "New Field") {
                    e.target.select();
                  }
                },
                onBlur: (e) => {
                  if (!e.target.value || e.target.value.trim() === "") {
                    setStepFormData({ name: "New Field" });
                  }
                },
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
                Field is read-only
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>
                  {fieldDetail?.department_ids?.length === 0
                    ? "This is a default field that cannot be edited. You can view the details but cannot make changes."
                    : "This field cannot be edited. You can view the details but cannot make changes."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
