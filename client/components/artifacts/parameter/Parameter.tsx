"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { StepCard } from "@/components/common/forms/StepCard";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Fields } from "@/components/resources/Fields";
import { Flags, type FlagConfig } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import { useGenerationModal } from "@/hooks/use-generation-modal";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type SaveParameterIn = InputOf<"/api/v4/artifacts/parameters/save", "post">;
type SaveParameterOut = OutputOf<"/api/v4/artifacts/parameters/save", "post">;
type PatchParameterDraftIn = InputOf<
  "/api/v4/artifacts/parameters/draft",
  "patch"
>;
type PatchParameterDraftOut = OutputOf<
  "/api/v4/artifacts/parameters/draft",
  "patch"
>;
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

type ParameterData = OutputOf<"/api/v4/artifacts/parameters/get", "post">;

type ParameterFormState = {
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  flag_ids: string[];
  department_ids: string[];
  field_ids: string[];
  simulation_parameter: boolean;
  document_parameter: boolean;
  persona_parameter: boolean;
  scenario_parameter: boolean;
  video_parameter: boolean;
};

type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
};

type ParameterSectionData = {
  actor_name?: string | null;
  can_edit?: boolean | null;
  disabled_reason?: string | null;
  parameter_exists?: boolean | null;
  group_id?: string | null;
  draft_version?: number | null;
  basic_show_ai_generate?: boolean | null;
  fields_step_show_ai_generate?: boolean | null;
  names?: {
    resource?: { id?: string | null; name?: string | null; generated?: boolean | null } | null;
    resources?: Array<{ id?: string | null; name?: string | null; generated?: boolean | null }> | null;
    suggestions?: string[] | null;
    show?: boolean | null;
    required?: boolean | null;
    show_ai_generate?: boolean | null;
    create_tool_id?: string | null;
  } | null;
  descriptions?: {
    resource?: { id?: string | null; description?: string | null; generated?: boolean | null } | null;
    resources?: Array<{ id?: string | null; description?: string | null; generated?: boolean | null }> | null;
    suggestions?: string[] | null;
    show?: boolean | null;
    required?: boolean | null;
    show_ai_generate?: boolean | null;
    create_tool_id?: string | null;
  } | null;
  flags?: {
    current?: Array<{
      key?: string | null;
      label?: string | null;
      description?: string | null;
      flag_option_id?: string | null;
      generated?: boolean | null;
    }> | null;
    resources?: Array<{
      key?: string | null;
      label?: string | null;
      description?: string | null;
      icon_id?: string | null;
      flag_option_id?: string | null;
      generated?: boolean | null;
    }> | null;
    show?: boolean | null;
    required?: boolean | null;
    show_ai_generate?: boolean | null;
    create_tool_id?: string | null;
  } | null;
  departments?: {
    current?: Array<{ department_id?: string | null; name?: string | null; description?: string | null; generated?: boolean | null }> | null;
    resources?: Array<{ department_id?: string | null; name?: string | null; description?: string | null; generated?: boolean | null }> | null;
    suggestions?: string[] | null;
    show?: boolean | null;
    required?: boolean | null;
    show_ai_generate?: boolean | null;
  } | null;
  fields?: {
    current?: Array<{ field_id?: string | null; name?: string | null; description?: string | null; generated?: boolean | null }> | null;
    resources?: Array<{ field_id?: string | null; name?: string | null; description?: string | null; generated?: boolean | null }> | null;
    suggestions?: string[] | null;
    show?: boolean | null;
    required?: boolean | null;
    show_ai_generate?: boolean | null;
  } | null;
};

const FLUSH_KEYS = ["names", "descriptions"] as const;
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
    flushKey: null,
    type: "multi",
  },
  { key: "fields", formKey: "field_ids", flushKey: null, type: "multi" },
];

export interface ParameterProps {
  parameterId?: string;
  mode?: "create" | "edit";
  parameterData?: ParameterData;
  saveParameterAction?: (input: SaveParameterIn) => Promise<SaveParameterOut>;
  patchParameterDraftAction?: (
    input: PatchParameterDraftIn
  ) => Promise<PatchParameterDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
}

function ParameterComponent({
  parameterId,
  mode = parameterId ? "edit" : "create",
  parameterData,
  saveParameterAction,
  patchParameterDraftAction,
  createNamesAction,
  createDescriptionsAction,
}: ParameterProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!parameterId;
  const s = (parameterData ?? null) as unknown as ParameterSectionData | null;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  const parameterSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      fieldSearch: parseAsString,
      fieldShowSelected: parseAsBoolean,
    }),
    []
  );

  const flagIdByKey = useMemo(() => {
    const map: Record<string, string> = {};
    (s?.flags?.resources ?? []).forEach((f) => {
      if (f.key && f.flag_option_id) {
        map[f.key] = f.flag_option_id;
      }
    });
    return map;
  }, [s?.flags?.resources]);

  const getInitialFormState = useCallback((): ParameterFormState => {
    if (!s) {
      return {
        name_id: null,
        description_id: null,
        active_flag_id: null,
        flag_ids: [],
        department_ids: [],
        field_ids: [],
        simulation_parameter: false,
        document_parameter: false,
        persona_parameter: false,
        scenario_parameter: false,
        video_parameter: false,
      };
    }

    const currentFlags = s.flags?.current ?? [];
    const hasKey = (k: string) => currentFlags.some((f) => f.key === k);
    const activeFlagId =
      currentFlags.find((f) => f.key === "active")?.flag_option_id ?? null;
    const flagIds = currentFlags
      .map((f) => f.flag_option_id)
      .filter((x): x is string => !!x);

    return {
      name_id: s.names?.resource?.id ?? null,
      description_id: s.descriptions?.resource?.id ?? null,
      active_flag_id: activeFlagId,
      flag_ids: flagIds,
      department_ids:
        s.departments?.current
          ?.map((d) => d.department_id)
          .filter((x): x is string => !!x) ?? [],
      field_ids:
        s.fields?.current
          ?.map((f) => f.field_id)
          .filter((x): x is string => !!x) ?? [],
      simulation_parameter: hasKey("simulation"),
      document_parameter: hasKey("document"),
      persona_parameter: hasKey("persona"),
      scenario_parameter: hasKey("scenario"),
      video_parameter: hasKey("video"),
    };
  }, [s]);

  const [formState, setFormState] = useState<ParameterFormState>(
    getInitialFormState
  );

  useEffect(() => {
    const newState = getInitialFormState();
    setFormState((prev) =>
      JSON.stringify(prev) === JSON.stringify(newState) ? prev : newState
    );
  }, [getInitialFormState]);

  const formStateRef = React.useRef(formState as Record<string, unknown>);
  useEffect(() => {
    formStateRef.current = formState as Record<string, unknown>;
  }, [formState]);

  const deriveFlagIds = useCallback(
    (state: ParameterFormState): string[] => {
      const ids: string[] = [];
      const pushIf = (key: string, enabled: boolean) => {
        const id = flagIdByKey[key];
        if (enabled && id) ids.push(id);
      };

      if (state.active_flag_id) {
        ids.push(state.active_flag_id);
      }
      pushIf("simulation", state.simulation_parameter);
      pushIf("document", state.document_parameter);
      pushIf("persona", state.persona_parameter);
      pushIf("scenario", state.scenario_parameter);
      pushIf("video", state.video_parameter);
      return Array.from(new Set(ids));
    },
    [flagIdByKey]
  );

  const patchActionRef = React.useRef<
    ((
      payload: Record<string, unknown>
    ) => Promise<{ draft_id?: string | null; new_version?: number | null }>) | undefined
  >(undefined);

  useEffect(() => {
    if (patchParameterDraftAction) {
      patchActionRef.current = async (payload: Record<string, unknown>) =>
        patchParameterDraftAction({ body: payload } as PatchParameterDraftIn);
    } else {
      patchActionRef.current = undefined;
    }
  }, [patchParameterDraftAction]);

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);

  const hasResourceIds =
    checkHasResourceIds(
      PARAMETER_RESOURCES,
      formState as unknown as Record<string, unknown>
    ) || deriveFlagIds(formState).length > 0;

  const lastPatchedFormStateRef = React.useRef<Record<string, unknown> | null>(
    null
  );

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>
    ): Record<string, unknown> => {
      const effective = computeEffectiveFormState(
        PARAMETER_RESOURCES,
        formStateRef.current,
        flushResults ?? {}
      ) as unknown as ParameterFormState;
      const effectiveFlags = deriveFlagIds(effective);
      const refState = lastPatchedFormStateRef.current as
        | (ParameterFormState & Record<string, unknown>)
        | null;
      const refFlags = refState ? deriveFlagIds(refState) : [];
      const flagsChanged =
        JSON.stringify(effectiveFlags) !== JSON.stringify(refFlags);

      return {
        input_draft_id: inputDraftId || null,
        group_id: s?.group_id ?? null,
        ...buildDraftPayload(PARAMETER_RESOURCES, {
          formState: effective as unknown as Record<string, unknown>,
          referenceState: refState,
          flushResults: (flushResults ?? {}) as Record<string, unknown>,
        }),
        ...(flagsChanged
          ? {
              flag_ids:
                effectiveFlags.length > 0 ? effectiveFlags : null,
            }
          : {}),
        expected_version: expectedVersion,
      };
    },
    [deriveFlagIds, s]
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
    serverDraftVersion: s?.draft_version ?? null,
    hasResourceIds,
    flushRegistryRef,
    formStateRef,
    onPatchSuccess: () => {
      lastPatchedFormStateRef.current = {
        ...(formStateRef.current as Record<string, unknown>),
      };
    },
  });

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "parameter",
    groupId: s?.group_id,
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
    [flushAllAndSave, formDataRef, parameterId, generate]
  );

  const canRegenerate = useCallback(
    (resourceType: ResourceType) => {
      switch (resourceType) {
        case "names":
          return s?.names?.resource?.generated ?? false;
        case "descriptions":
          return s?.descriptions?.resource?.generated ?? false;
        case "flags":
          return s?.flags?.current?.some((f) => f.generated) ?? false;
        case "departments":
          return s?.departments?.current?.some((d) => d.generated) ?? false;
        case "fields":
          return s?.fields?.current?.some((f) => f.generated) ?? false;
        default:
          return false;
      }
    },
    [s]
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
      (s?.fields?.current ?? []).map((f) => ({
        field_id: f.field_id ?? null,
        name: f.name ?? null,
        description: f.description ?? null,
        generated: f.generated ?? null,
      })),
    [s?.fields?.current]
  );
  const allFieldResources = useMemo(
    () =>
      (s?.fields?.resources ?? []).map((f) => ({
        field_id: f.field_id ?? null,
        name: f.name ?? null,
        description: f.description ?? null,
        generated: f.generated ?? null,
        parameter_id: null,
      })),
    [s?.fields?.resources]
  );

  const disabled = useMemo(() => !s?.can_edit, [s?.can_edit]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: Record<string, unknown> = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const effective = computeEffectiveFormState(
        PARAMETER_RESOURCES,
        formStateRef.current,
        flushResults
      ) as unknown as ParameterFormState;
      const effectiveFlags = deriveFlagIds(effective);

      if (s?.names?.required && !effective.name_id) {
        toast.error("Parameter name is required");
        throw new Error("Parameter name is required");
      }

      if (s?.departments?.required && (effective.department_ids?.length ?? 0) === 0) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (s?.fields?.required && (effective.field_ids?.length ?? 0) === 0) {
        toast.error("Fields are required");
        throw new Error("Fields are required");
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!saveParameterAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      await saveParameterAction({
        body: {
          input_parameter_id: isEditMode && parameterId ? parameterId : null,
          name_id: effective.name_id!,
          description_id: effective.description_id ?? null,
          flag_ids: effectiveFlags.length > 0 ? effectiveFlags : null,
          department_ids: effective.department_ids?.length
            ? effective.department_ids
            : null,
          field_ids: effective.field_ids?.length ? effective.field_ids : null,
        },
      });

      toast.success(
        `Parameter ${isEditMode ? "updated" : "created"} successfully!`
      );
      router.push("/management/parameters");
    },
    [
      isAutosaveEnabled,
      flushAllResources,
      deriveFlagIds,
      s,
      profile?.id,
      saveParameterAction,
      isEditMode,
      parameterId,
      router,
      getInitialFormState,
    ]
  );

  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasFields = (formState.field_ids?.length ?? 0) > 0;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "parameter-config":
          return hasName ? "completed" : "pending";
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

  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      fields: "Fields",
    }),
    []
  );

  const { handleOpenStepCardModal, modalProps } = useGenerationModal<ResourceType>({
    stepResources,
    resourceLabels,
    canRegenerate,
    onGenerate: (selectedResources, instructions) => {
      handleGenerateResources(selectedResources as ResourceType[], instructions);
    },
    isGenerating,
  });

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the parameter name, description, departments, and active status.",
        resetFields: ["name_id", "description_id", "department_ids", "active_flag_id"],
      },
      {
        id: "parameter-config",
        title: "Parameter Configuration",
        description: "Configure where this parameter type is used.",
        resetFields: [
          "simulation_parameter",
          "document_parameter",
          "persona_parameter",
          "scenario_parameter",
          "video_parameter",
        ],
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
      "simulation_parameter",
      "document_parameter",
      "persona_parameter",
      "scenario_parameter",
      "video_parameter",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "parameter-config":
        return "Parameter configuration reset";
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
            description_id: null,
            active_flag_id: null,
            flag_ids: prev.flag_ids.filter((id) => id !== (prev.active_flag_id ?? "")),
            department_ids: [],
          };
        case "parameter-config":
          return {
            ...prev,
            simulation_parameter: false,
            document_parameter: false,
            persona_parameter: false,
            scenario_parameter: false,
            video_parameter: false,
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
        case "basic": {
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
                  name_id={formState.name_id ?? null}
                  name_resource={s?.names?.resource ?? null}
                  show_name={s?.names?.show ?? true}
                  name_suggestions={s?.names?.suggestions ?? []}
                  names={s?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={() => handleGenerateResources(["names"])}
                  placeholder="e.g., Student Age"
                  defaultName="New Parameter"
                  required={s?.names?.required ?? false}
                  hideDescription={true}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.names?.show_ai_generate ?? false}
                  create_tool_id={s?.names?.create_tool_id ?? null}
                  createNamesAction={createNamesAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["names"]}
                />
              }
              resetFields={["name_id", "description_id", "department_ids", "active_flag_id"]}
              actions={
                stepResources["basic"]?.length && s?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={s?.descriptions?.resource ?? null}
                  show_description={s?.descriptions?.show ?? true}
                  description_suggestions={s?.descriptions?.suggestions ?? []}
                  descriptions={s?.descriptions?.resources ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={(descriptionId) =>
                    setFormState((prev) => ({ ...prev, description_id: descriptionId }))
                  }
                  onGenerate={() => handleGenerateResources(["descriptions"])}
                  label="Description"
                  placeholder="Enter a brief description (optional)"
                  required={s?.descriptions?.required ?? false}
                  rows={3}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
                  create_tool_id={s?.descriptions?.create_tool_id ?? null}
                  createDescriptionsAction={createDescriptionsAction}
                  isAutosaveEnabled={isAutosaveEnabled}
                  registerFlush={registerFlushCallbacks["descriptions"]}
                />

                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={s?.departments?.current ?? []}
                  show_departments={s?.departments?.show ?? false}
                  department_suggestions={s?.departments?.suggestions ?? []}
                  departments={s?.departments?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={() => handleGenerateResources(["departments"])}
                  required={s?.departments?.required ?? false}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.departments?.show_ai_generate ?? false}
                />

                <Flags
                  flags={(s?.flags?.resources ?? []).filter(f => f.key === "active") as FlagConfig[]}
                  flag_id={formState.active_flag_id}
                  show_flags={s?.flags?.show ?? false}
                  columns={1}
                  label="Active"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => {
                      const nextFlagIds = prev.flag_ids.filter(
                        (id) => id !== (prev.active_flag_id ?? "")
                      );
                      if (flagId) nextFlagIds.push(flagId);
                      return {
                        ...prev,
                        active_flag_id: flagId,
                        flag_ids: Array.from(new Set(nextFlagIds)),
                      };
                    })
                  }
                  onGenerate={() => handleGenerateResources(["flags"])}
                  group_id={s?.group_id ?? null}
                  showAiGenerate={s?.flags?.show_ai_generate ?? false}
                />
              </div>
            </StepCard>
          );
        }

        case "parameter-config": {
          const toggleTypeFlag = (key: string, checked: boolean) => {
            const optionId = flagIdByKey[key];
            setFormState((prev) => {
              const nextIds = prev.flag_ids.filter((id) => id !== optionId);
              if (checked && optionId) {
                nextIds.push(optionId);
              }
              return {
                ...prev,
                flag_ids: Array.from(new Set(nextIds)),
                simulation_parameter:
                  key === "simulation" ? checked : prev.simulation_parameter,
                document_parameter:
                  key === "document" ? checked : prev.document_parameter,
                persona_parameter:
                  key === "persona" ? checked : prev.persona_parameter,
                scenario_parameter:
                  key === "scenario" ? checked : prev.scenario_parameter,
                video_parameter:
                  key === "video" ? checked : prev.video_parameter,
              };
            });
          };

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={[
                "simulation_parameter",
                "document_parameter",
                "persona_parameter",
                "scenario_parameter",
                "video_parameter",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="simulation_parameter">Simulation Parameter</Label>
                  <Switch
                    id="simulation_parameter"
                    checked={formState.simulation_parameter}
                    onCheckedChange={(checked) => toggleTypeFlag("simulation", checked)}
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="document_parameter">Document Parameter</Label>
                  <Switch
                    id="document_parameter"
                    checked={formState.document_parameter}
                    onCheckedChange={(checked) => toggleTypeFlag("document", checked)}
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="persona_parameter">Persona Parameter</Label>
                  <Switch
                    id="persona_parameter"
                    checked={formState.persona_parameter}
                    onCheckedChange={(checked) => toggleTypeFlag("persona", checked)}
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="scenario_parameter">Scenario Parameter</Label>
                  <Switch
                    id="scenario_parameter"
                    checked={formState.scenario_parameter}
                    onCheckedChange={(checked) => toggleTypeFlag("scenario", checked)}
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="video_parameter">Video Parameter</Label>
                  <Switch
                    id="video_parameter"
                    checked={formState.video_parameter}
                    onCheckedChange={(checked) => toggleTypeFlag("video", checked)}
                    disabled={disabled}
                  />
                </div>
              </div>
            </StepCard>
          );
        }

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
                (s?.fields?.show_ai_generate ?? s?.fields_step_show_ai_generate) ? (
                  <StepCardAiButton
                    stepId="fields"
                    resourceTypes={stepResources["fields"]}
                    canRegenerate={canRegenerateForStepCard}
                    isGenerating={isGeneratingForStepCard}
                    onOpenModal={handleOpenStepCardModal}
                    disabled={disabled}
                  />
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <Fields
                field_ids={formState.field_ids ?? []}
                field_resources={selectedFieldResources}
                show_fields={s?.fields?.show ?? false}
                field_suggestions={s?.fields?.suggestions ?? []}
                fields={allFieldResources}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, field_ids: ids }))
                }
                label="Fields"
                required={s?.fields?.required ?? false}
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.fields?.show_ai_generate ?? false}
                onGenerate={() => handleGenerateResources(["fields"])}
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
      disabled,
      isEditMode,
      formState,
      s,
      isGenerating,
      isGeneratingForStepCard,
      selectedFieldResources,
      allFieldResources,
      stepResources,
      canRegenerateForStepCard,
      handleOpenStepCardModal,
      createNamesAction,
      createDescriptionsAction,
      isAutosaveEnabled,
      registerFlushCallbacks,
      handleGenerateResources,
      flagIdByKey,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`parameter-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={s?.disabled_reason ?? null}
          entityType="parameter"
        />

        <GenericForm
          nuqsParsers={parameterSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={s}
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

        <GenerateRegenerateModal {...modalProps} />
      </div>
    </TooltipProvider>
  );
}

export default React.memo(ParameterComponent);
