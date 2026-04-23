"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Fields } from "@/components/resources/Fields";
import { Flags, type FlagConfig } from "@/components/resources/Flags";
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
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateParameterIn = InputOf<"/parameter/create", "post">;
type CreateParameterOut = OutputOf<"/parameter/create", "post">;
type UpdateParameterIn = InputOf<"/parameter/update", "post">;
type UpdateParameterOut = OutputOf<"/parameter/update", "post">;
type PatchParameterDraftIn = InputOf<"/parameter/draft", "patch">;
type PatchParameterDraftOut = OutputOf<"/parameter/draft", "patch">;

type ParameterData = OutputOf<"/parameter/get", "post">;

type ParameterFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  active_flag_id: string | null;
  flag_ids: string[];
  department_ids: string[];
  field_ids: string[];
  pending_ids: string[];
};

const VALID_RESOURCE_TYPES: ResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "fields",
];

const PARAMETER_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: "department_ids",
    type: "multi",
  },
  {
    key: "parameter_fields",
    formKey: "field_ids",
    flushKey: "field_ids",
    type: "multi",
  },
];

export interface ParameterProps {
  parameterId?: string;
  mode?: "create" | "edit";
  parameterData?: ParameterData;
  createParameterAction?: (input: CreateParameterIn) => Promise<CreateParameterOut>;
  updateParameterAction?: (input: UpdateParameterIn) => Promise<UpdateParameterOut>;
  patchParameterDraftAction?: (
    input: PatchParameterDraftIn
  ) => Promise<PatchParameterDraftOut>;
}

function ParameterComponent({
  parameterId,
  mode = parameterId ? "edit" : "create",
  parameterData,
  createParameterAction,
  updateParameterAction,
  patchParameterDraftAction,
}: ParameterProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!parameterId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());

  const parameterSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      fieldSearch: parseAsString,
      fieldShowSelected: parseAsBoolean,
    }),
    []
  );

  const parameterDataRef = useRef(parameterData);
  useEffect(() => {
    parameterDataRef.current = parameterData;
  }, [parameterData]);

  const stableParameterDataFields = useMemo(() => {
    if (!parameterData) return null;
    return {
      names: parameterData.names,
      descriptions: parameterData.descriptions,
      flags: parameterData.flags,
      departments: parameterData.departments,
      parameter_fields: parameterData.parameter_fields,
      basic_show_ai_generate: parameterData.basic_show_ai_generate,
      fields_step_show_ai_generate: parameterData.fields_step_show_ai_generate,
    };
  }, [
    parameterData?.names,
    parameterData?.descriptions,
    parameterData?.flags,
    parameterData?.departments,
    parameterData?.parameter_fields,
    parameterData?.basic_show_ai_generate,
    parameterData?.fields_step_show_ai_generate,
  ]);

  const flagIdByKey = useMemo(() => {
    const map: Record<string, string> = {};
    (parameterData?.flags ?? []).forEach((flag) => {
      if (flag.key && flag.flag_option_id) {
        map[flag.key] = flag.flag_option_id;
      }
    });
    return map;
  }, [parameterData?.flags]);

  const getInitialFormState = useCallback((): ParameterFormState => {
    const data = parameterDataRef.current;
    const selectedFlags = data?.flags?.filter((flag) => flag.selected) ?? [];
    const selectedFlagIds = selectedFlags
      .map((flag) => flag.flag_option_id)
      .filter((id): id is string => !!id);

    if (!data) {
      return {
        name_id: null,
        name: null,
        description_id: null,
        description: null,
        active_flag_id: null,
        flag_ids: [],
        department_ids: [],
        field_ids: [],
        pending_ids: [],
      };
    }

    return {
      name_id: data.names?.find((item) => item.selected)?.id ?? null,
      name: null,
      description_id: data.descriptions?.find((item) => item.selected)?.id ?? null,
      description: null,
      active_flag_id:
        selectedFlags.find((flag) => flag.key === "active")?.flag_option_id ?? null,
      flag_ids: selectedFlagIds,
      department_ids:
        (data.departments?.filter((item) => item.selected) ?? [])
          .map((item) => item.department_id)
          .filter((id): id is string => !!id),
      field_ids:
        (data.parameter_fields?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      pending_ids: data.pending_ids ?? [],
    };
  }, []);

  const [formState, setFormState] = useState<ParameterFormState>(getInitialFormState);

  useEffect(() => {
    const nextState = getInitialFormState();
    setFormState((prev) =>
      JSON.stringify(prev) === JSON.stringify(nextState) ? prev : nextState
    );
  }, [getInitialFormState]);

  const formStateRef = useRef<Record<string, unknown>>(formState as Record<string, unknown>);
  useEffect(() => {
    formStateRef.current = formState as Record<string, unknown>;
  }, [formState]);


  const patchActionRef = useRef<
    | ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>)
    | undefined
  >(undefined);
  const lastPatchedFormStateRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!patchParameterDraftAction) {
      patchActionRef.current = undefined;
      return;
    }

    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchParameterDraftAction({
        body: payload,
      } as PatchParameterDraftIn);

      const formStateFromServer = result?.form_state;
      if (formStateFromServer) {
        const nextFlagIds = formStateFromServer.flag_ids ?? [];

        setFormState((prev) => {
          const next = {
            ...prev,
            name_id: formStateFromServer.name_id ?? prev.name_id,
            // Clear value fields only once the server has resolved them to
            // IDs — keeping the value would cause infinite re-saves (value
            // takes precedence → new resource → new id → repeat).
            name: formStateFromServer.name_id ? null : prev.name,
            description_id:
              formStateFromServer.description_id ?? prev.description_id,
            description: formStateFromServer.description_id
              ? null
              : prev.description,
            active_flag_id:
              flagIdByKey["active"] && nextFlagIds.includes(flagIdByKey["active"])
                ? flagIdByKey["active"]
                : null,
            flag_ids: nextFlagIds,
            department_ids: formStateFromServer.department_ids ?? prev.department_ids,
            field_ids: formStateFromServer.field_ids ?? prev.field_ids,
            pending_ids: formStateFromServer.pending_ids ?? prev.pending_ids,
          };
          // Only set the server-sync absorb flag when state actually changes.
          // If the server returned identical values, setting the flag would
          // let it stick until the next user action and silently swallow it.
          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            prev.description_id !== next.description_id ||
            prev.description !== next.description ||
            prev.active_flag_id !== next.active_flag_id ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
            JSON.stringify(prev.field_ids) !== JSON.stringify(next.field_ids) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }

      return result;
    };
  }, [flagIdByKey, patchParameterDraftAction]);

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      flushResults?: Record<string, unknown>
    ): Record<string, unknown> => {
      const currentFormState: ParameterFormState =
        formStateRef.current as unknown as ParameterFormState;
      const effectiveFlags = currentFormState.flag_ids;
      const referenceState = lastPatchedFormStateRef.current as
        | (ParameterFormState & Record<string, unknown>)
        | null;
      const referenceFlags = referenceState?.flag_ids ?? [];
      const flagsChanged =
        JSON.stringify(effectiveFlags) !== JSON.stringify(referenceFlags);

      const payload: Record<string, unknown> = {
        draft_id: inputDraftId || null,
        input_draft_id: inputDraftId || null,
        ...buildDraftPayload(PARAMETER_RESOURCES, {
          formState: currentFormState as unknown as Record<string, unknown>,
          referenceState,
          flushResults: flushResults ?? {},
        }),
        ...(flagsChanged
          ? { flag_ids: effectiveFlags.length > 0 ? effectiveFlags : null }
          : {}),
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
    []
  );

  const hasResourceIds =
    checkHasResourceIds(
      PARAMETER_RESOURCES,
      formState as unknown as Record<string, unknown>
    ) || formState.flag_ids.length > 0;

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((nameId: string | null) => {
    setFormState((prev) => ({ ...prev, name_id: nameId, name: null }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name, name_id: null }));
  }, []);

  const handleDescriptionIdChange = useCallback((descriptionId: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: descriptionId,
      description: null,
    }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({
      ...prev,
      description,
      description_id: null,
    }));
  }, []);

  const {
    setUrlFormDataRef,
    onFormDataChange,
    flushAllAndSave,
    serverSyncPendingRef,
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
    artifactType: "parameter",
    validResourceTypes: VALID_RESOURCE_TYPES,
  });

  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
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
        artifact_id: parameterId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [flushAllAndSave, formDataRef, generate, parameterId]
  );

  const canRegenerate = useCallback(
    (resourceType: ResourceType) => {
      if (!stableParameterDataFields) return false;
      switch (resourceType) {
        case "names":
          return (
            stableParameterDataFields.names?.find((item) => item.selected)?.generated ??
            false
          );
        case "descriptions":
          return (
            stableParameterDataFields.descriptions?.find((item) => item.selected)
              ?.generated ?? false
          );
        case "flags":
          return (
            stableParameterDataFields.flags?.filter((item) => item.selected).some(
              (item) => item.generated
            ) ?? false
          );
        case "departments":
          return (
            stableParameterDataFields.departments
              ?.filter((item) => item.selected)
              .some((item) => item.generated) ?? false
          );
        case "fields":
          return (
            stableParameterDataFields.parameter_fields
              ?.filter((item) => item.selected)
              .some((item) => item.generated) ?? false
          );
        default:
          return false;
      }
    },
    [stableParameterDataFields]
  );

  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as ResourceType),
    [canRegenerate]
  );
  const isGeneratingForStepCard = useCallback(
    (resourceType: string) => isGenerating(resourceType as ResourceType),
    [isGenerating]
  );

  const selectedFieldResources = useMemo(
    () =>
      (parameterData?.parameter_fields?.filter((item) => item.selected) ?? []).map(
        (item) => ({
          field_id: item.id ?? null,
          name: item.name ?? null,
          description: item.description ?? null,
          generated: item.generated ?? null,
        })
      ),
    [parameterData?.parameter_fields]
  );

  const allFieldResources = useMemo(
    () =>
      (parameterData?.parameter_fields ?? []).map((item) => ({
        field_id: item.id ?? null,
        name: item.name ?? null,
        description: item.description ?? null,
        generated: item.generated ?? null,
        suggested: item.suggested ?? null,
        pending: item.pending ?? null,
      })),
    [parameterData?.parameter_fields]
  );

  const disabled = useMemo(() => parameterData?.can_edit === false, [parameterData?.can_edit]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      const current = formStateRef.current as unknown as ParameterFormState;
      const effectiveFlags = current.flag_ids;

      if (!current.name_id && !current.name?.trim()) {
        toast.error("Parameter name is required");
        throw new Error("Parameter name is required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (isEditMode && parameterId) {
        if (!updateParameterAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        await updateParameterAction({
          body: {
            parameters: [
              {
                id: parameterId,
                ...(current.name_id ? { name_id: current.name_id } : {}),
                ...(current.name ? { name: current.name } : {}),
                ...(current.description_id
                  ? { description_id: current.description_id }
                  : {}),
                ...(current.description ? { description: current.description } : {}),
                ...(effectiveFlags.length > 0 ? { flag_ids: effectiveFlags } : {}),
                ...(current.department_ids.length > 0
                  ? { department_ids: current.department_ids }
                  : {}),
                ...(current.field_ids.length > 0
                  ? { field_ids: current.field_ids }
                  : {}),
              },
            ],
          },
        } as UpdateParameterIn);
      } else {
        if (!createParameterAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        await createParameterAction({
          body: {
            parameters: [
              {
                ...(current.name_id ? { name_id: current.name_id } : {}),
                ...(current.name ? { name: current.name } : {}),
                ...(current.description_id
                  ? { description_id: current.description_id }
                  : {}),
                ...(current.description ? { description: current.description } : {}),
                ...(effectiveFlags.length > 0 ? { flag_ids: effectiveFlags } : {}),
                ...(current.department_ids.length > 0
                  ? { department_ids: current.department_ids }
                  : {}),
                ...(current.field_ids.length > 0
                  ? { field_ids: current.field_ids }
                  : {}),
              },
            ],
          },
        } as CreateParameterIn);
      }

      toast.success(`Parameter ${isEditMode ? "updated" : "created"} successfully`);
      router.push("/management/parameters");
    },
    [
      createParameterAction,
      isEditMode,
      parameterId,
      profile?.id,
      router,
      updateParameterAction,
    ]
  );

  const getStepStatus = useCallback(
    (_stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name?.trim();
      const hasFields = formState.field_ids.length > 0;

      switch (_stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "fields":
          if (!hasName) return "pending";
          return hasFields ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState]
  );

  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "departments", "flags"],
      fields: ["fields"],
      all: ["names", "descriptions", "flags", "departments", "fields"],
    }),
    []
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        void handleGenerateResources(resources);
      }
    },
    [handleGenerateResources, stepResources]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the parameter name, description, departments, scope, and active status.",
        resetFields: ["name_id", "description_id", "department_ids", "flag_ids"],
      },
      {
        id: "fields",
        title: "Fields",
        description: "Select fields to include in this parameter.",
        resetFields: ["field_ids", "fieldSearch", "fieldShowSelected"],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "active_flag_id",
      "flag_ids",
      "department_ids",
      "field_ids",
      "pending_ids",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "fields":
        return "Fields reset";
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
            flag_ids: [],
            department_ids: [],
          };
        case "fields":
          return {
            ...prev,
            field_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/management/parameters",
      backLabel: "Back",
      createLabel: "Create Parameter",
      updateLabel: "Update Parameter",
    }),
    []
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
                  name_id={formState.name_id}
                  name_resource={
                    parameterData?.names?.find((item) => item.selected) ?? null
                  }
                  show_name={true}
                  names={parameterData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  placeholder="e.g., Student Age"
                  defaultName="New Parameter"
                  required={true}
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              resetFields={["name_id", "description_id", "department_ids", "active_flag_id"]}
              actions={
                stepResources["basic"]?.length &&
                parameterData?.basic_show_ai_generate ? (
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
                    parameterData?.descriptions?.find((item) => item.selected) ?? null
                  }
                  show_description={true}
                  descriptions={parameterData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                  label="Description"
                  placeholder="Enter a brief description (optional)"
                  required={false}
                  rows={3}
                  isAutosaveEnabled={isAutosaveEnabled}
                />

                <Departments
                  department_ids={formState.department_ids}
                  department_resources={
                    parameterData?.departments?.filter((item) => item.selected) ?? []
                  }
                  show_departments={true}
                  departments={parameterData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  required={false}
                />

                <Flags
                  mode="multi"
                  flags={(parameterData?.flags ?? []) as unknown as FlagConfig[]}
                  flag_ids={Object.fromEntries(
                    Object.entries(flagIdByKey).map(([key, id]) => [
                      key,
                      formState.flag_ids.includes(id) ? id : null,
                    ])
                  )}
                  show_flags={(parameterData?.flags?.length ?? 0) > 0}
                  columns={2}
                  label="Flags"
                  disabled={disabled}
                  onChange={(key, flagId) =>
                    setFormState((prev) => {
                      const optionId = flagIdByKey[key];
                      // Drop any previously-enabled id for this key, then add
                      // the new one (null means disabled). Keeps flag_ids in
                      // sync with the server's single-id-per-key contract.
                      const nextFlagIds = prev.flag_ids.filter(
                        (id) => id !== optionId
                      );
                      if (flagId) nextFlagIds.push(flagId);
                      return {
                        ...prev,
                        active_flag_id:
                          key === "active"
                            ? flagId
                            : prev.active_flag_id,
                        flag_ids: Array.from(new Set(nextFlagIds)),
                      };
                    })
                  }
                />
              </div>
            </StepCard>
          );

        case "fields": {
          const fieldSearchTerm =
            (formData["fieldSearch"] as string | null | undefined) || "";
          const fieldShowSelected =
            (formData["fieldShowSelected"] as boolean | null | undefined) ?? false;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={fieldSearchTerm}
              onSearchChange={(term) => setFormData({ fieldSearch: term || null })}
              searchPlaceholder="Search fields..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: fieldShowSelected,
                  onChange: (value: boolean) =>
                    setFormData({ fieldShowSelected: value || null }),
                },
              ]}
              resetFields={["field_ids", "fieldSearch", "fieldShowSelected"]}
              actions={
                stepResources["fields"]?.length &&
                parameterData?.fields_step_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="fields"
                    resourceTypes={stepResources["fields"]}
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
              <Fields
                field_ids={formState.field_ids}
                field_resources={selectedFieldResources}
                show_fields={true}
                fields={allFieldResources}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, field_ids: ids }))
                }
                label="Fields"
                required={false}
                searchTerm={fieldSearchTerm}
                showSelectedFilter={fieldShowSelected}
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      allFieldResources,
      canRegenerateForStepCard,
      disabled,
      flagIdByKey,
      formState,
      handleDirectStepGenerate,
      handleGenerateResources,
      isAutosaveEnabled,
      isEditMode,
      isGeneratingForStepCard,
      parameterData,
      selectedFieldResources,
      stepResources,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full space-y-8 p-6"
        data-page={`parameter-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={parameterData?.disabled_reason ?? null}
          entityType="parameter"
        />

        <GenericForm
          nuqsParsers={parameterSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={parameterData ?? null}
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

export default React.memo(ParameterComponent);
