"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { ConditionalParameters } from "@/components/resources/ConditionalParameters";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateFieldIn = InputOf<"/field/create", "post">;
type CreateFieldOut = OutputOf<"/field/create", "post">;
type UpdateFieldIn = InputOf<"/field/update", "post">;
type UpdateFieldOut = OutputOf<"/field/update", "post">;
type PatchFieldDraftIn = InputOf<"/field/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/field/draft", "patch">;

type FieldData = OutputOf<"/field/get", "post">;

type FieldResourceType =
  | "names"
  | "descriptions"
  | "flags"
  | "departments"
  | "conditional_parameters";

type FieldFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  conditional_parameter_ids: string[];
  pending_ids: string[];
};

const VALID_RESOURCE_TYPES: FieldResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "conditional_parameters",
];

const FIELD_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: "department_ids",
    type: "multi",
  },
  {
    key: "conditional_parameters",
    formKey: "conditional_parameter_ids",
    flushKey: "conditional_parameter_ids",
    type: "multi",
  },
];

export interface FieldProps {
  fieldId?: string;
  mode?: "create" | "edit";
  fieldData?: FieldData;
  createFieldAction?: (input: CreateFieldIn) => Promise<CreateFieldOut>;
  updateFieldAction?: (input: UpdateFieldIn) => Promise<UpdateFieldOut>;
  patchFieldDraftAction?: (
    input: PatchFieldDraftIn,
  ) => Promise<PatchFieldDraftOut>;
}

function FieldComponent({
  fieldId,
  mode = fieldId ? "edit" : "create",
  fieldData,
  createFieldAction,
  updateFieldAction,
  patchFieldDraftAction,
}: FieldProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!fieldId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());

  const fieldDataRef = useRef(fieldData);
  useEffect(() => {
    fieldDataRef.current = fieldData;
  }, [fieldData]);

  const stableFieldData = useMemo(() => {
    if (!fieldData) return null;
    return {
      names: fieldData.names,
      descriptions: fieldData.descriptions,
      flags: fieldData.flags,
      departments: fieldData.departments,
      conditional_parameters: fieldData.conditional_parameters,
      basic_show_ai_generate: fieldData.basic_show_ai_generate ?? false,
      show_ai_generate: fieldData.show_ai_generate ?? false,
      group_id: fieldData.group_id,
    };
  }, [
    fieldData?.names,
    fieldData?.descriptions,
    fieldData?.flags,
    fieldData?.departments,
    fieldData?.conditional_parameters,
    fieldData?.basic_show_ai_generate,
    fieldData?.show_ai_generate,
    fieldData?.group_id,
  ]);

  const getInitialFormState = useCallback((): FieldFormState => {
    const data = fieldDataRef.current;
    if (!data) {
      return {
        name_id: null,
        name: null,
        description_id: null,
        description: null,
        active_flag_id: null,
        department_ids: [],
        conditional_parameter_ids: [],
        pending_ids: [],
      };
    }

    return {
      name_id: data.names?.find((item) => item.selected)?.id ?? null,
      name: null,
      description_id: data.descriptions?.find((item) => item.selected)?.id ?? null,
      description: null,
      active_flag_id:
        data.flags?.find((item) => item.selected)?.flag_option_id ?? null,
      department_ids:
        (data.departments?.filter((item) => item.selected) ?? [])
          .map((item) => item.department_id)
          .filter((id): id is string => !!id),
      conditional_parameter_ids:
        (data.conditional_parameters?.filter((item) => item.selected) ?? [])
          .map((item) => item.parameter_id)
          .filter((id): id is string => !!id),
      pending_ids:
        data.pending_ids?.filter((id): id is string => !!id) ?? [],
    };
  }, []);

  const [formState, setFormState] = useState<FieldFormState>(getInitialFormState);

  useEffect(() => {
    const nextState = getInitialFormState();
    setFormState((prev) =>
      JSON.stringify(prev) === JSON.stringify(nextState) ? prev : nextState,
    );
  }, [getInitialFormState]);

  const formStateRef = useRef<Record<string, unknown>>(
    formState as Record<string, unknown>,
  );
  useEffect(() => {
    formStateRef.current = formState as Record<string, unknown>;
  }, [formState]);

  const lastPatchedFormStateRef = useRef<Record<string, unknown> | null>(null);
  const patchActionRef = useRef<
    | ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);

  useEffect(() => {
    if (!patchFieldDraftAction) {
      patchActionRef.current = undefined;
      return;
    }

    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchFieldDraftAction({
        body: payload,
      } as PatchFieldDraftIn);

      const formStateFromServer = result?.form_state;
      if (formStateFromServer) {
        setFormState((prev) => ({
          ...prev,
          name_id: formStateFromServer.name_id ?? prev.name_id,
          name:
            formStateFromServer.name !== undefined
              ? formStateFromServer.name
              : formStateFromServer.name_id
                ? null
                : prev.name,
          description_id:
            formStateFromServer.description_id ?? prev.description_id,
          description:
            formStateFromServer.description !== undefined
              ? formStateFromServer.description
              : formStateFromServer.description_id
                ? null
                : prev.description,
          active_flag_id:
            formStateFromServer.active_flag_id ??
            formStateFromServer.flag_id ??
            prev.active_flag_id,
          department_ids:
            formStateFromServer.department_ids ?? prev.department_ids,
          conditional_parameter_ids:
            formStateFromServer.conditional_parameter_ids ??
            prev.conditional_parameter_ids,
          pending_ids: formStateFromServer.pending_ids ?? prev.pending_ids,
        }));
      }

      return result;
    };
  }, [patchFieldDraftAction]);

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const currentFormState = formStateRef.current as unknown as FieldFormState;
      const payload: Record<string, unknown> = {
        draft_id: inputDraftId || null,
        input_draft_id: inputDraftId || null,
        ...buildDraftPayload(FIELD_RESOURCES, {
          formState: currentFormState as unknown as Record<string, unknown>,
          referenceState: lastPatchedFormStateRef.current,
          flushResults: flushResults ?? {},
        }),
        pending_ids:
          currentFormState.pending_ids.length > 0
            ? currentFormState.pending_ids
            : null,
      };

      if (currentFormState.name != null) {
        payload["name"] = currentFormState.name;
        delete payload["name_id"];
      }
      if (currentFormState.description != null) {
        payload["description"] = currentFormState.description;
        delete payload["description_id"];
      }

      return payload;
    },
    [],
  );

  const hasResourceIds = checkHasResourceIds(
    FIELD_RESOURCES,
    formState as unknown as Record<string, unknown>,
  );

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    formDataRef,
  } = useDraftLifecycle({
    formStateKey,
    patchActionRef,
    isAutosaveEnabled,
    buildPatchPayload,
    setSelectedDraftId,
    hasResourceIds,
    flushRegistryRef: emptyFlushRegistryRef,
    formStateRef,
    onPatchSuccess: () => {
      lastPatchedFormStateRef.current = {
        ...(formStateRef.current as Record<string, unknown>),
      };
    },
  });

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "field",
    validResourceTypes: VALID_RESOURCE_TYPES as string[],
  });

  const handleGenerateResources = useCallback(
    async (resourceTypes: FieldResourceType[], userInstructions?: string) => {
      let draftId = (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftId) {
        draftId = await flushAllAndSave();
      }
      if (!draftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes, {
        draft_id: draftId,
        artifact_id: fieldId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [fieldId, flushAllAndSave, formDataRef, generate],
  );

  const canRegenerate = useCallback(
    (resourceType: FieldResourceType) => {
      if (!stableFieldData) return false;
      switch (resourceType) {
        case "names":
          return (
            stableFieldData.names?.find((item) => item.selected)?.generated ?? false
          );
        case "descriptions":
          return (
            stableFieldData.descriptions?.find((item) => item.selected)
              ?.generated ?? false
          );
        case "flags":
          return (
            stableFieldData.flags?.filter((item) => item.selected).some(
              (item) => item.generated,
            ) ?? false
          );
        case "departments":
          return (
            stableFieldData.departments?.filter((item) => item.selected).some(
              (item) => item.generated,
            ) ?? false
          );
        case "conditional_parameters":
          return (
            stableFieldData.conditional_parameters
              ?.filter((item) => item.selected)
              .some((item) => item.generated) ?? false
          );
      }
    },
    [stableFieldData],
  );

  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as FieldResourceType),
    [canRegenerate],
  );
  const isGeneratingForStepCard = useCallback(
    (resourceType: string) => isGenerating(resourceType as FieldResourceType),
    [isGenerating],
  );

  const fieldSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      descriptionSearch: parseAsString,
      conditionalParameterSearch: parseAsString,
      conditionalParameterShowSelected: parseAsBoolean,
    }),
    [],
  );

  const disabled = useMemo(() => fieldData?.can_edit === false, [fieldData?.can_edit]);

  const handleSubmit = useCallback(async () => {
    const current = formStateRef.current as unknown as FieldFormState;

    if (!current.name_id && !current.name?.trim()) {
      toast.error("Field name is required");
      throw new Error("Field name is required");
    }

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      throw new Error("Profile not loaded");
    }

    if (isEditMode && fieldId) {
      if (!updateFieldAction) {
        toast.error("Update action not available");
        throw new Error("Update action not available");
      }
      await updateFieldAction({
        body: {
          fields: [
            {
              field_id: fieldId,
              ...(current.name_id ? { name_id: current.name_id } : {}),
              ...(current.name ? { name: current.name } : {}),
              ...(current.description_id
                ? { description_id: current.description_id }
                : {}),
              ...(current.description ? { description: current.description } : {}),
              ...(current.active_flag_id ? { active_flag_id: current.active_flag_id } : {}),
              ...(current.department_ids.length > 0
                ? { department_ids: current.department_ids }
                : {}),
              ...(current.conditional_parameter_ids.length > 0
                ? { conditional_parameter_ids: current.conditional_parameter_ids }
                : {}),
            },
          ],
        },
      } as UpdateFieldIn);
    } else {
      if (!createFieldAction) {
        toast.error("Create action not available");
        throw new Error("Create action not available");
      }
      await createFieldAction({
        body: {
          fields: [
            {
              ...(current.name_id ? { name_id: current.name_id } : {}),
              ...(current.name ? { name: current.name } : {}),
              ...(current.description_id
                ? { description_id: current.description_id }
                : {}),
              ...(current.description ? { description: current.description } : {}),
              ...(current.active_flag_id ? { active_flag_id: current.active_flag_id } : {}),
              ...(current.department_ids.length > 0
                ? { department_ids: current.department_ids }
                : {}),
              ...(current.conditional_parameter_ids.length > 0
                ? { conditional_parameter_ids: current.conditional_parameter_ids }
                : {}),
            },
          ],
        },
      } as CreateFieldIn);
    }

    toast.success(`Field ${isEditMode ? "updated" : "created"} successfully`);
    router.push("/management/fields");
  }, [
    createFieldAction,
    fieldId,
    isEditMode,
    profile?.id,
    router,
    updateFieldAction,
  ]);

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name?.trim();

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "conditional":
          if (!hasName) return "pending";
          return formState.conditional_parameter_ids.length > 0
            ? "completed"
            : "active";
        default:
          return "pending";
      }
    },
    [formState.conditional_parameter_ids.length, formState.name, formState.name_id],
  );

  const stepResources: Record<string, FieldResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments"],
      conditional: ["conditional_parameters"],
      all: VALID_RESOURCE_TYPES,
    }),
    [],
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        void handleGenerateResources(resources);
      }
    },
    [handleGenerateResources, stepResources],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the field name, description, departments, and active status.",
        resetFields: ["name_id", "description_id", "active_flag_id", "department_ids"],
      },
      {
        id: "conditional",
        title: "Conditional Parameters",
        description: "Choose parameters shown when this field is selected.",
        resetFields: [
          "conditional_parameter_ids",
          "conditionalParameterSearch",
          "conditionalParameterShowSelected",
        ],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "active_flag_id",
      "department_ids",
      "conditional_parameter_ids",
      "pending_ids",
    ],
    [],
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "conditional":
        return "Conditional parameters reset";
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
            name: null,
            description_id: null,
            description: null,
            active_flag_id: null,
            department_ids: [],
          };
        case "conditional":
          return {
            ...prev,
            conditional_parameter_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/management/fields",
      backLabel: "Back",
      createLabel: "Create Field",
      updateLabel: "Update Field",
    }),
    [],
  );

  const renderStep = useCallback(
    ({
      stepId,
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
      formData,
      setFormData,
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
        case "basic": {
          const descriptionSearch =
            (formData["descriptionSearch"] as string | null | undefined) || "";

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
                  name_id={formState.name_id}
                  name_resource={fieldData?.names?.find((item) => item.selected) ?? null}
                  show_name={true}
                  names={fieldData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId, name: null }))
                  }
                  onNameChange={(name) =>
                    setFormState((prev) => ({ ...prev, name, name_id: null }))
                  }
                  placeholder="e.g., Learning Style"
                  defaultName="New Field"
                  required={true}
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              actions={
                stepResources["basic"]?.length &&
                fieldData?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id}
                  description_resource={
                    fieldData?.descriptions?.find((item) => item.selected) ?? null
                  }
                  show_description={true}
                  descriptions={fieldData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({
                      ...prev,
                      description_id: descriptionId,
                      description: null,
                    }))
                  }
                  onDescriptionChange={(description) =>
                    setFormState((prev) => ({
                      ...prev,
                      description,
                      description_id: null,
                    }))
                  }
                  label="Description"
                  placeholder="Enter a brief description (optional)"
                  required={false}
                  rows={3}
                  searchTerm={descriptionSearch}
                  onSearchChange={(term) =>
                    setFormData({ descriptionSearch: term || null })
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                />

                <Departments
                  department_ids={formState.department_ids}
                  department_resources={
                    fieldData?.departments?.filter((item) => item.selected) ?? []
                  }
                  show_departments={true}
                  departments={fieldData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  required={false}
                />

                <Flags
                  flags={fieldData?.flags ?? []}
                  flag_id={formState.active_flag_id}
                  show_flags={true}
                  columns={1}
                  label="Active"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({ ...prev, active_flag_id: flagId }))
                  }
                />
              </div>
            </StepCard>
          );
        }

        case "conditional": {
          const conditionalParameterSearch =
            (formData["conditionalParameterSearch"] as string | null | undefined) ||
            "";
          const conditionalParameterShowSelected =
            (formData["conditionalParameterShowSelected"] as boolean | null | undefined) ??
            false;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={conditionalParameterSearch}
              onSearchChange={(term) =>
                setFormData({ conditionalParameterSearch: term || null })
              }
              searchPlaceholder="Search conditional parameters..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: conditionalParameterShowSelected,
                  onChange: (value: boolean) =>
                    setFormData({ conditionalParameterShowSelected: value || null }),
                },
              ]}
              actions={
                stepResources["conditional"]?.length &&
                fieldData?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="conditional"
                    resourceTypes={stepResources["conditional"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <ConditionalParameters
                conditional_parameter_ids={formState.conditional_parameter_ids}
                conditional_parameter_resources={
                  fieldData?.conditional_parameters?.filter((item) => item.selected) ?? []
                }
                show_conditional_parameters={true}
                conditional_parameters={fieldData?.conditional_parameters ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    conditional_parameter_ids: ids,
                  }))
                }
                showAiGenerate={fieldData?.show_ai_generate ?? false}
                onGenerate={() => handleGenerateResources(["conditional_parameters"])}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      canRegenerateForStepCard,
      disabled,
      fieldData?.basic_show_ai_generate,
      fieldData?.conditional_parameters,
      fieldData?.departments,
      fieldData?.descriptions,
      fieldData?.flags,
      fieldData?.names,
      fieldData?.show_ai_generate,
      formState.active_flag_id,
      formState.conditional_parameter_ids,
      formState.department_ids,
      formState.description_id,
      formState.name_id,
      handleDirectStepGenerate,
      handleGenerateResources,
      isAutosaveEnabled,
      isEditMode,
      isGeneratingForStepCard,
      stepResources,
    ],
  );

  const handleFormDataChange = useCallback(
    (fd: Record<string, unknown>) => {
      onFormDataChange(fd);
      setFormState((prev) => ({
        ...prev,
        name_id: (fd["name_id"] as string | undefined) ?? prev.name_id,
        description_id:
          (fd["description_id"] as string | undefined) ?? prev.description_id,
        active_flag_id:
          (fd["active_flag_id"] as string | undefined) ?? prev.active_flag_id,
        department_ids:
          (fd["department_ids"] as string[] | undefined) ?? prev.department_ids,
        conditional_parameter_ids:
          (fd["conditional_parameter_ids"] as string[] | undefined) ??
          prev.conditional_parameter_ids,
        pending_ids:
          (fd["pending_ids"] as string[] | undefined) ?? prev.pending_ids,
      }));
    },
    [onFormDataChange],
  );

  return (
    <TooltipProvider>
      <div className="w-full space-y-8 p-6" data-page={`field-${isEditMode ? "edit" : "new"}`}>
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={fieldData?.disabled_reason ?? null}
          entityType="field"
        />

        <GenericForm
          nuqsParsers={fieldSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={fieldData}
          formFieldKeys={formFieldKeys}
          onReset={handleReset}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={disabled}
          isEditMode={isEditMode}
          renderStep={renderStep}
          onFormDataChange={handleFormDataChange}
          registerSetFormData={(setter) => {
            setUrlFormDataRef.current = setter;
          }}
        />
      </div>
    </TooltipProvider>
  );
}

export default FieldComponent;
