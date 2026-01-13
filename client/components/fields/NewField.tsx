/**
 * NewField.tsx
 * Separate component for field creation (maintains compatibility)
 * Uses unified get/save endpoints following Persona.tsx patterns
 * @AshokSaravanan222 & @siladiea
 * 01/13/2026
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsString, type Parser } from "nuqs";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { useProfile } from "@/contexts/profile-context";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getDefaultDepartmentIds } from "@/utils/department-picker-helpers";
import { Power } from "lucide-react";

// Types defined inline using InputOf/OutputOf
type GetFieldIn = InputOf<"/api/v4/fields/get", "post">;
type GetFieldOut = OutputOf<"/api/v4/fields/get", "post">;
type SaveFieldIn = InputOf<"/api/v4/fields/save", "post">;
type SaveFieldOut = OutputOf<"/api/v4/fields/save", "post">;
type PatchFieldDraftIn = InputOf<"/api/v4/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v4/fields/draft", "patch">;

type FieldData = GetFieldOut;

export interface NewFieldProps {
  // Unified field data (for new mode, field_id will be null)
  fieldData?: FieldData;
  saveFieldAction?: (input: SaveFieldIn) => Promise<SaveFieldOut>;
  patchFieldDraftAction?: (
    input: PatchFieldDraftIn
  ) => Promise<PatchFieldDraftOut>;
}

function NewFieldComponent({
  fieldData: serverFieldData,
  saveFieldAction,
  patchFieldDraftAction,
}: NewFieldProps) {
  const router = useRouter();
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();

  // Use ref to store fieldData to prevent callback recreation on every render
  const fieldDataRef = React.useRef(serverFieldData);
  React.useEffect(() => {
    fieldDataRef.current = serverFieldData;
  }, [serverFieldData]);

  // Memoize fieldData fields used in renderStep to prevent callback recreation
  const stableFieldDataFields = React.useMemo(() => {
    if (!serverFieldData) return null;
    return {
      field_id: serverFieldData.field_id,
      name: serverFieldData.name,
      description: serverFieldData.description,
      active: serverFieldData.active,
      department_ids: serverFieldData.department_ids,
      conditional_parameter_ids: serverFieldData.conditional_parameter_ids,
      departments: serverFieldData.departments,
      valid_department_ids: serverFieldData.valid_department_ids,
      parameters: serverFieldData.parameters,
      valid_parameter_ids: serverFieldData.valid_parameter_ids,
      can_edit: serverFieldData.can_edit,
      disabled_reason: serverFieldData.disabled_reason,
    };
  }, [
    serverFieldData?.field_id,
    serverFieldData?.name,
    serverFieldData?.description,
    serverFieldData?.active,
    serverFieldData?.department_ids,
    serverFieldData?.conditional_parameter_ids,
    serverFieldData?.departments,
    serverFieldData?.valid_department_ids,
    serverFieldData?.parameters,
    serverFieldData?.valid_parameter_ids,
    serverFieldData?.can_edit,
    serverFieldData?.disabled_reason,
  ]);

  // URL-backed state using nuqs
  const fieldSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
    }),
    []
  );

  // Get draftId from GenericForm's URL state via bridge
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = React.useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);

  // Store formData from GenericForm to access search params
  const formDataRef = React.useRef<Record<string, unknown>>({});

  // Memoized callback to sync draftId from GenericForm
  const onFormDataChange = React.useCallback((fd: Record<string, unknown>) => {
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

  // Local form state
  const getInitialFormState = useCallback(() => {
    const data = fieldDataRef.current;
    if (!data) {
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
        conditionalParameterIds: [] as string[],
      };
    }
    return {
      name: data.name || "New Field",
      description: data.description || "",
      active: data.active ?? true,
      departmentIds: data.department_ids || [],
      conditionalParameterIds: data.conditional_parameter_ids || [],
    };
  }, [effectiveProfile?.role, effectiveProfile?.primary_department_id]);

  const [formState, setFormState] = useState(getInitialFormState);

  // Update form state when server data changes
  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name !== newState.name ||
        prev.description !== newState.description ||
        prev.active !== newState.active ||
        JSON.stringify(prev.departmentIds) !==
          JSON.stringify(newState.departmentIds) ||
        JSON.stringify(prev.conditionalParameterIds) !==
          JSON.stringify(newState.conditionalParameterIds)
      ) {
        return newState;
      }
      return prev;
    });
  }, [
    serverFieldData?.name,
    serverFieldData?.description,
    serverFieldData?.active,
    serverFieldData?.department_ids,
    serverFieldData?.conditional_parameter_ids,
    getInitialFormState,
  ]);

  // Use ref to stabilize patchFieldDraftAction
  const patchFieldDraftActionRef = React.useRef(patchFieldDraftAction);
  React.useEffect(() => {
    patchFieldDraftActionRef.current = patchFieldDraftAction;
  }, [patchFieldDraftAction]);

  // Draft change listener
  useEffect(() => {
    const hasData =
      formState.name ||
      formState.description ||
      formState.departmentIds.length > 0 ||
      formState.conditionalParameterIds.length > 0;

    if (!hasData || !patchFieldDraftActionRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchFieldDraftActionRef.current) return;
        await patchFieldDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            name: formState.name,
            description: formState.description,
            active: formState.active,
            department_ids: formState.departmentIds,
            conditional_parameter_ids: formState.conditionalParameterIds,
            expected_version: 0,
          },
        });
      } catch {
        // Failed to save draft - error already logged by API
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    draftId,
    formState.name,
    formState.description,
    formState.active,
    formState.departmentIds,
    formState.conditionalParameterIds,
  ]);

  // Disabled logic based on can_edit flag
  const disabled = useMemo(() => {
    if (!serverFieldData) return false;
    return !serverFieldData.can_edit;
  }, [serverFieldData]);

  // Get valid options from server data
  const validDepartmentIds = useMemo(() => {
    return serverFieldData?.valid_department_ids || [];
  }, [serverFieldData?.valid_department_ids]);

  const departmentMapping = useMemo(() => {
    const departments = serverFieldData?.departments || [];
    return Object.fromEntries(
      departments.map((dept) => [
        dept.department_id,
        { name: dept.name, description: dept.description || undefined },
      ])
    ) as Record<string, { name: string; description?: string }>;
  }, [serverFieldData?.departments]);

  const validParameterIds = useMemo(() => {
    return serverFieldData?.valid_parameter_ids || [];
  }, [serverFieldData?.valid_parameter_ids]);

  const parameterMapping = useMemo(() => {
    const parameters = serverFieldData?.parameters || [];
    return Object.fromEntries(
      parameters.map((param) => [
        param.parameter_id,
        { name: param.name, description: param.description || undefined },
      ])
    ) as Record<string, { name: string; description?: string }>;
  }, [serverFieldData?.parameters]);

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
            ((
              formData["conditionalParameterIds"] as string[] | null | undefined
            )?.length || 0) > 0;
          return hasParameters ? "completed" : "active";
        default:
          return "pending";
      }
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

      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      const finalData = {
        name: formData["name"] as string,
        description: (formData["description"] as string) || "",
        active: (formData["active"] as boolean) ?? true,
        department_ids:
          (formData["departmentIds"] as string[] | null | undefined) ?? [],
        conditional_parameter_ids:
          (formData["conditionalParameterIds"] as
            | string[]
            | null
            | undefined) ?? [],
        input_field_id: null, // Always null for new mode
      };

      try {
        await saveFieldAction({
          body: finalData,
        });
        toast.success("Field created successfully!");
        router.push("/management/fields");
      } catch (error) {
        toast.error(
          `Failed to create field: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    [effectiveProfile?.id, saveFieldAction, router]
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
      const currentFieldData = stableFieldDataFields;
      switch (stepId) {
        case "basic": {
          const name =
            (stepFormData["name"] as string | null | undefined) || "";
          const description =
            (stepFormData["description"] as string | null | undefined) || "";
          const active =
            (stepFormData["active"] as boolean | null | undefined) ?? true;
          const departmentIds =
            (stepFormData["departmentIds"] as string[] | null | undefined) ||
            [];

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={false}
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
                    disabled={disabled}
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
                      onSelect={(ids) =>
                        setStepFormData({ departmentIds: ids })
                      }
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
                      disabled={disabled}
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
                        disabled={disabled}
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
            (stepFormData["conditionalParameterIds"] as
              | string[]
              | null
              | undefined) || [];

          if (!validParameterIds || validParameterIds.length === 0) {
            return null;
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={false}
            >
              <ParameterCardGrid
                parameterMapping={parameterMapping}
                validParameterIds={validParameterIds}
                selectedParameterIds={conditionalParameterIds}
                onSelect={(ids) =>
                  setStepFormData({ conditionalParameterIds: ids })
                }
                readonly={disabled}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      disabled,
      validDepartmentIds,
      departmentMapping,
      validParameterIds,
      parameterMapping,
      stableFieldDataFields,
    ]
  );

  // Merge formState for formData
  const formData = useMemo(() => {
    return {
      ...formState,
    } as Record<string, unknown>;
  }, [formState]);

  // Wrapper for setFormData that updates formState
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      setFormState((prev) => {
        const updates: Partial<typeof prev> = {};
        if ("name" in resolvedUpdates)
          updates.name = resolvedUpdates.name as string;
        if ("description" in resolvedUpdates)
          updates.description = resolvedUpdates.description as string;
        if ("active" in resolvedUpdates)
          updates.active = resolvedUpdates.active as boolean;
        if ("departmentIds" in resolvedUpdates)
          updates.departmentIds = resolvedUpdates.departmentIds as string[];
        if ("conditionalParameterIds" in resolvedUpdates)
          updates.conditionalParameterIds =
            resolvedUpdates.conditionalParameterIds as string[];
        return { ...prev, ...updates };
      });
    },
    [formData]
  );

  return (
    <div className="w-full p-6 space-y-8" data-page="field-new">
      <ReadOnlyBanner
        disabled={disabled}
        disabledReason={serverFieldData?.disabled_reason ?? null}
        entityType="field"
      />

      <GenericForm
        nuqsParsers={fieldSearchParamsClient as Record<string, Parser<unknown>>}
        steps={steps}
        getStepStatus={getStepStatus}
        formData={formData}
        setFormData={setFormData}
        serverData={serverFieldData}
        formFieldKeys={[
          "name",
          "description",
          "active",
          "departmentIds",
          "conditionalParameterIds",
        ]}
        resetSuccessMessage={(stepId) => {
          if (stepId === "basic") return "Basic information reset";
          if (stepId === "conditionalParameters")
            return "Conditional parameters reset";
          return `${stepId} reset`;
        }}
        onSubmit={handleSubmit}
        submitButton={{
          createLabel: "Create Field",
          updateLabel: "Update Field",
          backUrl: "/management/fields",
          backLabel: "Back",
        }}
        isReadonly={disabled}
        isEditMode={false}
        renderStep={renderStep}
        onFormDataChange={onFormDataChange}
        registerSetFormData={(setter) => {
          setUrlFormDataRef.current = setter;
        }}
      />
    </div>
  );
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(NewFieldComponent, (prevProps, nextProps) => {
  // Compare fieldData by key fields, not object reference
  const prevKeyFields = {
    field_id: prevProps.fieldData?.field_id,
    name: prevProps.fieldData?.name,
    can_edit: prevProps.fieldData?.can_edit,
    department_ids: prevProps.fieldData?.department_ids,
    conditional_parameter_ids: prevProps.fieldData?.conditional_parameter_ids,
  };
  const nextKeyFields = {
    field_id: nextProps.fieldData?.field_id,
    name: nextProps.fieldData?.name,
    can_edit: nextProps.fieldData?.can_edit,
    department_ids: nextProps.fieldData?.department_ids,
    conditional_parameter_ids: nextProps.fieldData?.conditional_parameter_ids,
  };

  // Compare primitive props
  if (JSON.stringify(prevKeyFields) !== JSON.stringify(nextKeyFields)) {
    return false; // Props changed, re-render
  }

  // Compare function props by reference
  if (
    prevProps.saveFieldAction !== nextProps.saveFieldAction ||
    prevProps.patchFieldDraftAction !== nextProps.patchFieldDraftAction
  ) {
    return false; // Function props changed, re-render
  }

  // All props are equivalent, skip re-render
  return true;
});
