/**
 * Field.tsx
 * Section-first field editor with persona-parity draft/generation flow.
 */
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
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Parameters } from "@/components/resources/Parameters";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  type ResourceConfig,
  buildDraftPayload,
  checkHasResourceIds,
  computeEffectiveFormState,
} from "@/lib/resources/action-builders";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type SaveFieldIn = InputOf<"/api/v4/artifacts/fields/save", "post">;
type SaveFieldOut = OutputOf<"/api/v4/artifacts/fields/save", "post">;
type PatchFieldDraftIn = InputOf<"/api/v4/artifacts/fields/draft", "patch">;
type PatchFieldDraftOut = OutputOf<"/api/v4/artifacts/fields/draft", "patch">;
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

type FieldData = OutputOf<"/api/v4/artifacts/fields/get", "post">;

type FieldResourceType =
  | "names"
  | "descriptions"
  | "flags"
  | "departments"
  | "conditional_parameters";

type FieldFormState = {
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  conditional_parameter_ids: string[];
};

type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
};

export interface FieldProps {
  fieldId?: string;
  fieldData?: FieldData;
  saveFieldAction?: (input: SaveFieldIn) => Promise<SaveFieldOut>;
  patchFieldDraftAction?: (
    input: PatchFieldDraftIn,
  ) => Promise<PatchFieldDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn,
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn,
  ) => Promise<CreateDraftDescriptionsOut>;
}

const FLUSH_KEYS = ["names", "descriptions"] as const;

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
    flushKey: null,
    type: "multi",
  },
  {
    key: "conditional_parameters",
    formKey: "conditional_parameter_ids",
    flushKey: null,
    type: "multi",
  },
];

function FieldComponent({
  fieldId,
  fieldData,
  saveFieldAction,
  patchFieldDraftAction,
  createNamesAction,
  createDescriptionsAction,
}: FieldProps) {
  const router = useRouter();
  const isEditMode = !!fieldId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();

  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  const stableFieldData = useMemo(() => {
    if (!fieldData) return null;
    return {
      names: fieldData.names,
      descriptions: fieldData.descriptions,
      flags: fieldData.flags,
      departments: fieldData.departments,
      conditional_parameters: fieldData.conditional_parameters,
      group_id: fieldData.group_id,
      basic_show_ai_generate: fieldData.basic_show_ai_generate ?? false,
      can_edit: fieldData.can_edit ?? true,
      disabled_reason: fieldData.disabled_reason,
    };
  }, [fieldData]);

  const getInitialFormState = useCallback((): FieldFormState => {
    if (!stableFieldData) {
      return {
        name_id: null,
        description_id: null,
        active_flag_id: null,
        department_ids: [],
        conditional_parameter_ids: [],
      };
    }

    return {
      name_id: stableFieldData.names?.resource?.id ?? null,
      description_id: stableFieldData.descriptions?.resource?.id ?? null,
      active_flag_id: stableFieldData.flags?.resource?.flag_option_id ?? null,
      department_ids: (stableFieldData.departments?.current ?? [])
        .map((d) => d.department_id)
        .filter(Boolean) as string[],
      conditional_parameter_ids: (
        stableFieldData.conditional_parameters?.current ?? []
      )
        .map((p) => p.parameter_id)
        .filter(Boolean) as string[],
    };
  }, [stableFieldData]);

  const [formState, setFormState] = useState<FieldFormState>(getInitialFormState);

  const formStateRef = useRef<Record<string, unknown>>(
    formState as unknown as Record<string, unknown>,
  );
  useEffect(() => {
    formStateRef.current = formState as unknown as Record<string, unknown>;
  }, [formState]);

  const lastPatchedFormStateRef = useRef<FieldFormState | null>(
    getInitialFormState(),
  );

  useEffect(() => {
    const nextState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== nextState.name_id ||
        prev.description_id !== nextState.description_id ||
        prev.active_flag_id !== nextState.active_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(nextState.department_ids) ||
        JSON.stringify(prev.conditional_parameter_ids) !==
          JSON.stringify(nextState.conditional_parameter_ids)
      ) {
        lastPatchedFormStateRef.current = nextState;
        return nextState;
      }
      return prev;
    });
  }, [getInitialFormState]);

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "field",
    validResourceTypes: [
      "names",
      "descriptions",
      "flags",
      "departments",
      "conditional_parameters",
    ] as string[],
  });

  const canRegenerate = useCallback(
    (resourceType: FieldResourceType): boolean => {
      if (!stableFieldData) return false;
      switch (resourceType) {
        case "names":
          return stableFieldData.names?.resource?.generated ?? false;
        case "descriptions":
          return stableFieldData.descriptions?.resource?.generated ?? false;
        case "flags":
          return stableFieldData.flags?.resource?.generated ?? false;
        case "departments":
          return (
            stableFieldData.departments?.current?.some((d) => d.generated) ?? false
          );
        case "conditional_parameters":
          return (
            stableFieldData.conditional_parameters?.current?.some(
              (p) => p.generated,
            ) ?? false
          );
      }
    },
    [stableFieldData],
  );

  const patchActionRef = useRef<
    | ((
        payload: Record<string, unknown>,
      ) => Promise<{ draft_id?: string | null; new_version?: number | null }>)
    | undefined
  >(undefined);

  useEffect(() => {
    if (!patchFieldDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) => {
      return patchFieldDraftAction({
        body: payload as PatchFieldDraftIn["body"],
      });
    };
  }, [patchFieldDraftAction]);

  const formStateKey = useMemo(
    () =>
      JSON.stringify({
        name_id: formState.name_id,
        description_id: formState.description_id,
        active_flag_id: formState.active_flag_id,
        department_ids: formState.department_ids,
        conditional_parameter_ids: formState.conditional_parameter_ids,
      }),
    [
      formState.name_id,
      formState.description_id,
      formState.active_flag_id,
      formState.department_ids,
      formState.conditional_parameter_ids,
    ],
  );

  const hasResourceIds = checkHasResourceIds(
    FIELD_RESOURCES,
    formState as unknown as Record<string, unknown>,
  );

  const buildPatchPayload = useCallback(
    (
      draftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>,
    ) => {
      return {
        input_draft_id: draftId || null,
        group_id: stableFieldData?.group_id ?? null,
        ...buildDraftPayload(FIELD_RESOURCES, {
          formState: formStateRef.current,
          referenceState: lastPatchedFormStateRef.current as unknown as Record<
            string,
            unknown
          > | null,
          flushResults: (flushResults ?? {}) as Record<string, unknown>,
        }),
        expected_version: expectedVersion,
      };
    },
    [stableFieldData],
  );

  const onPatchSuccess = useCallback(() => {
    lastPatchedFormStateRef.current = {
      ...(formStateRef.current as unknown as FieldFormState),
    };
  }, []);

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
    serverDraftVersion: fieldData?.draft_version ?? null,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
    onPatchSuccess,
  });

  const handleGenerateResources = useCallback(
    async (resourceTypes: FieldResourceType[], userInstructions?: string) => {
      let draftIdToUse =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftIdToUse) {
        draftIdToUse = await flushAllAndSave();
      }
      if (!draftIdToUse) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftIdToUse,
        artifact_id: fieldId || null,
      });
    },
    [fieldId, flushAllAndSave, formDataRef, generate],
  );

  const stepResources = useMemo(
    () => ({
      basic: [
        "names",
        "descriptions",
        "flags",
        "departments",
      ] as FieldResourceType[],
      conditional: ["conditional_parameters"] as FieldResourceType[],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "conditional_parameters",
      ] as FieldResourceType[],
    }),
    [],
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        handleGenerateResources(resources);
      }
    },
    [stepResources, handleGenerateResources],
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

  const disabled = useMemo(() => !fieldData?.can_edit, [fieldData?.can_edit]);

  const handleSubmit = useCallback(async () => {
    if (!profile?.id) {
      throw new Error("Profile not loaded");
    }
    if (!saveFieldAction) {
      throw new Error("Save action unavailable");
    }
    if (!stableFieldData?.group_id) {
      throw new Error("Group ID missing");
    }

    if (stableFieldData.names?.required && !formState.name_id) {
      throw new Error("Field name is required");
    }
    if (stableFieldData.departments?.required && formState.department_ids.length === 0) {
      throw new Error("Department is required");
    }
    if (
      stableFieldData.conditional_parameters?.required &&
      formState.conditional_parameter_ids.length === 0
    ) {
      throw new Error("Conditional parameter is required");
    }

    const flushResults = await flushAllResources();
    const effectiveFormState = computeEffectiveFormState(
      FIELD_RESOURCES,
      formState as unknown as Record<string, unknown>,
      flushResults as Record<string, unknown>,
    );

    const efs = effectiveFormState as Record<string, unknown>;
    await saveFieldAction({
      body: {
        input_field_id: isEditMode && fieldId ? fieldId : null,
        name_id: efs["name_id"] as string,
        description_id: (efs["description_id"] as string) ?? null,
        flag_id: (efs["active_flag_id"] as string) ?? null,
        department_ids: (efs["department_ids"] as string[])?.length
          ? (efs["department_ids"] as string[])
          : null,
        conditional_parameter_ids: (
          efs["conditional_parameter_ids"] as string[]
        )?.length
          ? (efs["conditional_parameter_ids"] as string[])
          : null,
      },
    });

    toast.success(`Field ${isEditMode ? "updated" : "created"} successfully`);
    router.push("/management/fields");
  }, [
    fieldId,
    flushAllResources,
    formState,
    isEditMode,
    profile?.id,
    router,
    saveFieldAction,
    stableFieldData,
  ]);

  const handleReset = useCallback((stepId: string) => {
    setFormState((prev) => {
      if (stepId === "basic") {
        return {
          ...prev,
          name_id: null,
          description_id: null,
          active_flag_id: null,
          department_ids: [],
        };
      }
      if (stepId === "conditional") {
        return {
          ...prev,
          conditional_parameter_ids: [],
        };
      }
      return prev;
    });
  }, []);

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set field name, description, departments, and active state.",
      },
      {
        id: "conditional",
        title: "Conditional Parameters",
        description: "Attach parameters shown when this field is selected.",
      },
    ],
    [],
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formState.name_id;
      if (stepId === "basic") return hasName ? "completed" : "active";
      if (!hasName) return "pending";
      if (stepId === "conditional") {
        return formState.conditional_parameter_ids.length > 0
          ? "completed"
          : "active";
      }
      return "pending";
    },
    [formState.conditional_parameter_ids.length, formState.name_id],
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
      }));
    },
    [onFormDataChange],
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
      stepStatus: StepStatus;
      stepTitle: string;
      stepDescription: string;
      stepNumber: number;
      isOptional: boolean;
      formData: Record<string, unknown>;
      setFormData: (updates: Partial<Record<string, unknown>>) => void;
      onReset?: () => void;
    }) => {
      if (stepId === "basic") {
        const descriptionSearch =
          (formData["descriptionSearch"] as string | undefined) ?? "";

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
                name_resource={stableFieldData?.names?.resource}
                show_name={stableFieldData?.names?.show ?? true}
                name_suggestions={stableFieldData?.names?.suggestions ?? []}
                names={stableFieldData?.names?.resources ?? []}
                disabled={disabled}
                onNameIdChange={(name_id) =>
                  setFormState((prev) => ({ ...prev, name_id }))
                }

                required={stableFieldData?.names?.required ?? false}
                showAiGenerate={stableFieldData?.names?.show_ai_generate ?? false}
                create_tool_id={stableFieldData?.names?.create_tool_id ?? null}
                onGenerate={() => handleGenerateResources(["names"])}
                createNamesAction={createNamesAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.names}
              />
            }
            actions={
              stableFieldData?.basic_show_ai_generate ? (
                <StepCardAiButton
                  stepId="basic"
                  resourceTypes={stepResources.basic}
                  canRegenerate={canRegenerate}
                  isGenerating={isGenerating}
                  onOpenModal={handleDirectStepGenerate}
                  disabled={disabled}
                />
              ) : undefined
            }
            {...(onReset ? { onReset } : {})}
          >
            <div className="space-y-4">
              <Descriptions
                description_id={formState.description_id}
                description_resource={stableFieldData?.descriptions?.resource}
                show_description={stableFieldData?.descriptions?.show ?? true}
                description_suggestions={
                  stableFieldData?.descriptions?.suggestions ?? []
                }
                descriptions={stableFieldData?.descriptions?.resources ?? []}
                disabled={disabled}
                onDescriptionIdChange={(description_id) =>
                  setFormState((prev) => ({ ...prev, description_id }))
                }
                required={stableFieldData?.descriptions?.required ?? false}

                showAiGenerate={
                  stableFieldData?.descriptions?.show_ai_generate ?? false
                }
                create_tool_id={
                  stableFieldData?.descriptions?.create_tool_id ?? null
                }
                onGenerate={() => handleGenerateResources(["descriptions"])}
                createDescriptionsAction={createDescriptionsAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.descriptions}
                searchTerm={descriptionSearch}
                onSearchChange={(term: string) =>
                  setFormData({ descriptionSearch: term || null })
                }
              />

              <Departments
                department_ids={formState.department_ids}
                department_resources={stableFieldData?.departments?.current ?? []}
                show_departments={stableFieldData?.departments?.show ?? false}
                department_suggestions={
                  stableFieldData?.departments?.suggestions ?? []
                }
                departments={stableFieldData?.departments?.resources ?? []}
                disabled={disabled}
                onChange={(department_ids) =>
                  setFormState((prev) => ({ ...prev, department_ids }))
                }
                required={stableFieldData?.departments?.required ?? false}

                showAiGenerate={
                  stableFieldData?.departments?.show_ai_generate ?? false
                }
                onGenerate={() => handleGenerateResources(["departments"])}
              />

              <Flags
                mode="single"
                flag_id={formState.active_flag_id}
                flags={stableFieldData?.flags?.resources ?? []}
                show_flags={stableFieldData?.flags?.show ?? false}
                disabled={disabled}
                onChange={(active_flag_id) =>
                  setFormState((prev) => ({ ...prev, active_flag_id }))
                }
                showAiGenerate={stableFieldData?.flags?.show_ai_generate ?? false}
                onGenerate={() => handleGenerateResources(["flags"])}
              />
            </div>
          </StepCard>
        );
      }

      const conditionalParameterSearch =
        (formData["conditionalParameterSearch"] as string | undefined) ?? "";
      const conditionalParameterShowSelected =
        (formData["conditionalParameterShowSelected"] as boolean | undefined) ??
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
          onSearchChange={(term: string) =>
            setFormData({ conditionalParameterSearch: term || null })
          }
          searchPlaceholder="Search conditional parameters..."
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
            (stableFieldData?.conditional_parameters?.show_ai_generate ?? false) ? (
              <StepCardAiButton
                stepId="conditional"
                resourceTypes={stepResources.conditional}
                canRegenerate={canRegenerate}
                isGenerating={isGenerating}
                onOpenModal={handleDirectStepGenerate}
                disabled={disabled}
              />
            ) : undefined
          }
          {...(onReset ? { onReset } : {})}
        >
          <Parameters
            parameter_ids={formState.conditional_parameter_ids}
            parameter_resources={
              stableFieldData?.conditional_parameters?.current ?? []
            }
            show_parameters={stableFieldData?.conditional_parameters?.show ?? false}
            parameter_suggestions={
              stableFieldData?.conditional_parameters?.suggestions ?? []
            }
            parameters={stableFieldData?.conditional_parameters?.resources ?? []}
            disabled={disabled}
            onChange={(conditional_parameter_ids) =>
              setFormState((prev) => ({ ...prev, conditional_parameter_ids }))
            }
            required={stableFieldData?.conditional_parameters?.required ?? false}
            showAiGenerate={
              stableFieldData?.conditional_parameters?.show_ai_generate ?? false
            }
            onGenerate={() => handleGenerateResources(["conditional_parameters"])}
            searchTerm={conditionalParameterSearch}
            showSelectedFilter={conditionalParameterShowSelected}
          />
        </StepCard>
      );
    },
    [
      canRegenerate,
      createDescriptionsAction,
      createNamesAction,
      disabled,
      formState.active_flag_id,
      formState.conditional_parameter_ids,
      formState.department_ids,
      formState.description_id,
      formState.name_id,
      handleGenerateResources,
      handleDirectStepGenerate,
      isAutosaveEnabled,
      isEditMode,
      isGenerating,
      registerFlushCallbacks.descriptions,
      registerFlushCallbacks.names,
      stableFieldData,
      stepResources.basic,
      stepResources.conditional,
    ],
  );

  const submitButton = useMemo(
    () => ({
      backUrl: "/management/fields",
      backLabel: "Back",
      createLabel: "Create Field",
      updateLabel: "Update Field",
    }),
    [],
  );

  return (
    <TooltipProvider>
      <div className="w-full p-6 space-y-8" data-page={`field-${isEditMode ? "edit" : "new"}`}>
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
          formFieldKeys={[
            "name_id",
            "description_id",
            "active_flag_id",
            "department_ids",
            "conditional_parameter_ids",
          ]}
          onReset={handleReset}
          resetSuccessMessage={(stepId) =>
            stepId === "basic"
              ? "Basic information reset"
              : "Conditional parameters reset"
          }
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
