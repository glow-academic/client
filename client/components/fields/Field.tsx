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
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Parameters } from "@/components/resources/Parameters";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useSaveContext } from "@/contexts/save-context";
import { useAiGeneration } from "@/hooks/use-ai-generation";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  type ResourceConfig,
  buildResourceActions,
  checkHasResourceIds,
  computeEffectiveFormState,
} from "@/lib/resources/action-builders";
import type { ServerToClientEvents } from "@/lib/ws/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type FieldGenerationCompletePayload = Parameters<
  ServerToClientEvents["field_generation_complete"]
>[0];

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

type FieldAiFormData = {
  name_resource?: FieldGenerationCompletePayload["name_resource"];
  description_resource?: FieldGenerationCompletePayload["description_resource"];
  flag_resource?: FieldGenerationCompletePayload["flag_resource"];
  department_resources?: FieldGenerationCompletePayload["department_resources"];
  conditional_parameter_resources?: FieldGenerationCompletePayload["conditional_parameter_resources"];
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
  const { profile, socket, isConnected, setSelectedDraftId } = useProfile();
  const { isAutosaveEnabled } = useSaveContext();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

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

  const groupId = fieldData?.group_id;

  const onAiComplete = useCallback((data: Record<string, unknown>) => {
    const aiUpdates: Partial<FieldAiFormData> = {};
    if (data["name_resource"]) {
      aiUpdates.name_resource = data[
        "name_resource"
      ] as FieldAiFormData["name_resource"];
    }
    if (data["description_resource"]) {
      aiUpdates.description_resource = data[
        "description_resource"
      ] as FieldAiFormData["description_resource"];
    }
    if (data["flag_resource"]) {
      aiUpdates.flag_resource = data[
        "flag_resource"
      ] as FieldAiFormData["flag_resource"];
    }
    if (data["department_resources"]) {
      aiUpdates.department_resources = data[
        "department_resources"
      ] as FieldAiFormData["department_resources"];
    }
    if (data["conditional_parameter_resources"]) {
      aiUpdates.conditional_parameter_resources = data[
        "conditional_parameter_resources"
      ] as FieldAiFormData["conditional_parameter_resources"];
    }

    const updates: Record<string, unknown> = {};
    const name = data["name_resource"] as { id?: string } | undefined;
    const description = data["description_resource"] as
      | { id?: string }
      | undefined;
    const flag = data["flag_resource"] as
      | { flag_option_id?: string }
      | undefined;

    if (name?.id) updates["name_id"] = name.id;
    if (description?.id) updates["description_id"] = description.id;
    if (flag?.flag_option_id) updates["active_flag_id"] = flag.flag_option_id;

    return {
      aiUpdates,
      formStateUpdates: updates,
      formStateUpdater: (prev: Record<string, unknown>) => {
        const next = { ...prev, ...updates };

        const departmentResources = data["department_resources"] as
          | Array<{ department_id?: string }>
          | undefined;
        if (departmentResources?.length) {
          const existing = new Set((next["department_ids"] as string[]) ?? []);
          departmentResources.forEach((d) => {
            if (d.department_id) existing.add(d.department_id);
          });
          next["department_ids"] = Array.from(existing);
        }

        const conditionalResources = data[
          "conditional_parameter_resources"
        ] as Array<{ parameter_id?: string }> | undefined;
        if (conditionalResources?.length) {
          const existing = new Set(
            (next["conditional_parameter_ids"] as string[]) ?? [],
          );
          conditionalResources.forEach((p) => {
            if (p.parameter_id) existing.add(p.parameter_id);
          });
          next["conditional_parameter_ids"] = Array.from(existing);
        }

        return next;
      },
    };
  }, []);

  const {
    setGeneratingResources,
    isGenerating,
    aiFormData,
    clearAiResource,
  } = useAiGeneration<FieldResourceType, FieldAiFormData>({
    socket,
    isConnected,
    artifactType: "field",
    groupId,
    eventPrefix: "field_generation",
    validResourceTypes: [
      "names",
      "descriptions",
      "flags",
      "departments",
      "conditional_parameters",
    ],
    onComplete: onAiComplete,
    setFormState,
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
        ...buildResourceActions(FIELD_RESOURCES, {
          formState: formStateRef.current,
          referenceState: lastPatchedFormStateRef.current as Record<
            string,
            unknown
          > | null,
          flushResults: (flushResults ?? {}) as Record<string, unknown>,
          entityData: stableFieldData as Record<string, unknown> | null,
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
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }

      let draftIdToUse =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!draftIdToUse) {
        draftIdToUse = await flushAllAndSave();
      }
      if (!draftIdToUse) {
        toast.error("Please save a draft before generating with AI");
        return;
      }

      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });

      socket.emit("field_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftIdToUse,
        field_id: fieldId || null,
      });
    },
    [fieldId, flushAllAndSave, formDataRef, isConnected, setGeneratingResources, socket],
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

  const resourceLabels = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      conditional_parameters: "Conditional Parameters",
    }),
    [],
  );

  const { handleOpenStepCardModal, modalProps } = useGenerationModal<FieldResourceType>({
    stepResources,
    resourceLabels,
    canRegenerate,
    onGenerate: handleGenerateResources,
    isGenerating,
  });

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

  useEffect(() => {
    if (!isEditMode || !fieldId) return;
    const name = stableFieldData?.names?.resource?.name;
    if (!name) return;
    setEntityMetadata({
      entityId: fieldId,
      entityName: name,
      entityType: "parameter",
    });
    return () => clearEntityMetadata();
  }, [
    clearEntityMetadata,
    fieldId,
    isEditMode,
    setEntityMetadata,
    stableFieldData?.names?.resource?.name,
  ]);

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

    await saveFieldAction({
      body: {
        group_id: stableFieldData.group_id,
        input_field_id: isEditMode && fieldId ? fieldId : null,
        ...buildResourceActions(FIELD_RESOURCES, {
          formState: effectiveFormState,
          referenceState: lastPatchedFormStateRef.current as Record<
            string,
            unknown
          > | null,
          flushResults: flushResults as Record<string, unknown>,
          entityData: stableFieldData as Record<string, unknown>,
        }),
      } as SaveFieldIn["body"],
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
                group_id={stableFieldData?.group_id ?? null}
                required={stableFieldData?.names?.required ?? false}
                showAiGenerate={stableFieldData?.names?.show_ai_generate ?? false}
                create_tool_id={stableFieldData?.names?.create_tool_id ?? null}
                link_tool_id={stableFieldData?.names?.link_tool_id ?? null}
                onGenerate={() => handleGenerateResources(["names"])}
                isGenerating={isGenerating("names")}
                createNamesAction={createNamesAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.names}
                aiResource={aiFormData.name_resource}
                onAccept={() => clearAiResource("name_resource")}
                onReject={() => clearAiResource("name_resource")}
              />
            }
            actions={
              stableFieldData?.basic_show_ai_generate ? (
                <StepCardAiButton
                  stepId="basic"
                  resourceTypes={stepResources.basic}
                  canRegenerate={canRegenerate}
                  isGenerating={isGenerating}
                  onOpenModal={handleOpenStepCardModal}
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
                group_id={stableFieldData?.group_id ?? null}
                showAiGenerate={
                  stableFieldData?.descriptions?.show_ai_generate ?? false
                }
                create_tool_id={
                  stableFieldData?.descriptions?.create_tool_id ?? null
                }
                link_tool_id={stableFieldData?.descriptions?.link_tool_id ?? null}
                onGenerate={() => handleGenerateResources(["descriptions"])}
                isGenerating={isGenerating("descriptions")}
                createDescriptionsAction={createDescriptionsAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks.descriptions}
                searchTerm={descriptionSearch}
                onSearchChange={(term: string) =>
                  setFormData({ descriptionSearch: term || null })
                }
                aiResource={aiFormData.description_resource}
                onAccept={() => clearAiResource("description_resource")}
                onReject={() => clearAiResource("description_resource")}
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
                group_id={stableFieldData?.group_id ?? null}
                link_tool_id={stableFieldData?.departments?.link_tool_id ?? null}
                showAiGenerate={
                  stableFieldData?.departments?.show_ai_generate ?? false
                }
                onGenerate={() => handleGenerateResources(["departments"])}
                isGenerating={isGenerating("departments")}
                aiDepartmentResources={aiFormData.department_resources}
                onAccept={() => clearAiResource("department_resources")}
                onReject={() => clearAiResource("department_resources")}
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
                link_tool_id={stableFieldData?.flags?.link_tool_id ?? null}
                showAiGenerate={stableFieldData?.flags?.show_ai_generate ?? false}
                onGenerate={() => handleGenerateResources(["flags"])}
                isGenerating={isGenerating("flags")}
                aiFlagResources={
                  aiFormData.flag_resource?.flag_option_id
                    ? [
                        {
                          id: aiFormData.flag_resource.flag_option_id,
                          key: aiFormData.flag_resource.key ?? null,
                        },
                      ]
                    : null
                }
                onAccept={() => clearAiResource("flag_resource")}
                onReject={() => clearAiResource("flag_resource")}
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
                onOpenModal={handleOpenStepCardModal}
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
            group_id={stableFieldData?.group_id ?? null}
            link_tool_id={
              stableFieldData?.conditional_parameters?.link_tool_id ?? null
            }
            showAiGenerate={
              stableFieldData?.conditional_parameters?.show_ai_generate ?? false
            }
            onGenerate={() => handleGenerateResources(["conditional_parameters"])}
            isGenerating={isGenerating("conditional_parameters")}
            searchTerm={conditionalParameterSearch}
            showSelectedFilter={conditionalParameterShowSelected}
            aiParameterResources={
              aiFormData.conditional_parameter_resources?.map((p) => ({
                parameter_id: p.parameter_id,
                name: p.name,
              })) ?? null
            }
            onAccept={() => clearAiResource("conditional_parameter_resources")}
            onReject={() => clearAiResource("conditional_parameter_resources")}
          />
        </StepCard>
      );
    },
    [
      aiFormData.conditional_parameter_resources,
      aiFormData.department_resources,
      aiFormData.description_resource,
      aiFormData.flag_resource,
      aiFormData.name_resource,
      canRegenerate,
      clearAiResource,
      createDescriptionsAction,
      createNamesAction,
      disabled,
      formState.active_flag_id,
      formState.conditional_parameter_ids,
      formState.department_ids,
      formState.description_id,
      formState.name_id,
      handleGenerateResources,
      handleOpenStepCardModal,
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

        <GenerateRegenerateModal {...modalProps} />
      </div>
    </TooltipProvider>
  );
}

export default FieldComponent;
