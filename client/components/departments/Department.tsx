/**
 * Department.tsx
 * Canonical department create/edit component (persona parity pattern).
 */
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
import { GenerateRegenerateModal } from "@/components/common/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/FlagsLegacy";
import { Names } from "@/components/resources/Names";
import { Settings } from "@/components/resources/Settings";
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
  buildResourceActions,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsString, type Parser } from "nuqs";

type SaveDepartmentIn = InputOf<"/api/v4/artifacts/departments/save", "post">;
type SaveDepartmentOut = OutputOf<"/api/v4/artifacts/departments/save", "post">;
type SaveDepartmentBody = NonNullable<SaveDepartmentIn["body"]>;
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
type PatchDepartmentDraftIn = InputOf<
  "/api/v4/artifacts/departments/draft",
  "patch"
>;
type PatchDepartmentDraftOut = OutputOf<
  "/api/v4/artifacts/departments/draft",
  "patch"
>;
type DepartmentData = OutputOf<"/api/v4/artifacts/departments/get", "post">;

type DepartmentFormState = {
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  settings_ids: string[];
};

type FlushResult = {
  name_id?: string | null;
  description_id?: string | null;
};

const FLUSH_KEYS = ["names", "descriptions"] as const;

const VALID_RESOURCE_TYPES: ResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "settings",
];

const DEPARTMENT_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "active_flag_id", flushKey: null, type: "single" },
  {
    key: "settings",
    formKey: "settings_ids",
    flushKey: null,
    type: "multi",
  },
];

export interface DepartmentProps {
  departmentId?: string;
  departmentData?: DepartmentData;
  saveDepartmentAction?: (
    input: SaveDepartmentIn,
  ) => Promise<SaveDepartmentOut>;
  patchDepartmentDraftAction?: (
    input: PatchDepartmentDraftIn,
  ) => Promise<PatchDepartmentDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn,
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn,
  ) => Promise<CreateDraftDescriptionsOut>;
}

function DepartmentComponent({
  departmentId,
  departmentData,
  saveDepartmentAction,
  patchDepartmentDraftAction,
  createNamesAction,
  createDescriptionsAction,
}: DepartmentProps) {
  const router = useRouter();
  const isEditMode = !!departmentId;
  const s = departmentData;

  const [formState, setFormState] = useState<DepartmentFormState>({
    name_id: null,
    description_id: null,
    active_flag_id: null,
    settings_ids: [],
  });

  const { profile, setSelectedDraftId, socket, isConnected } = useProfile();
  const { isAutosaveEnabled } = useSaveContext();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  const onAiComplete = useCallback((data: Record<string, unknown>) => {
    return {
      aiUpdates: {} as Record<string, unknown>,
      formStateUpdater: (prev: Record<string, unknown>) => {
        const updates: Record<string, unknown> = {};
        const nameRes = data["name_resource"] as { id?: string | null } | null;
        const descRes = data["description_resource"] as
          | { id?: string | null }
          | null;
        const flagRes = data["flag_resource"] as
          | { flag_option_id?: string | null }
          | null;
        const settingsRes = data["settings_resources"] as
          | Array<{ settings_id?: string | null }>
          | null;

        if (nameRes?.id) updates["name_id"] = nameRes.id;
        if (descRes?.id) updates["description_id"] = descRes.id;
        if (flagRes?.flag_option_id) updates["active_flag_id"] = flagRes.flag_option_id;
        if (settingsRes?.length) {
          const nextIds = settingsRes
            .map((x) => x.settings_id)
            .filter((x): x is string => !!x);
          const prevIds = (prev["settings_ids"] as string[]) ?? [];
          updates["settings_ids"] = [
            ...prevIds,
            ...nextIds.filter((id) => !prevIds.includes(id)),
          ];
        }

        return { ...prev, ...updates };
      },
    };
  }, []);

  const { setGeneratingResources, isGenerating } = useAiGeneration<
    ResourceType,
    Record<string, unknown>
  >({
    socket,
    isConnected,
    artifactType: "department",
    groupId: s?.group_id,
    eventPrefix: "department_generation",
    validResourceTypes: VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
    setFormState: setFormState as React.Dispatch<
      React.SetStateAction<Record<string, unknown>>
    >,
  });

  const getInitialFormState = useCallback((): DepartmentFormState => {
    if (!s) {
      return {
        name_id: null,
        description_id: null,
        active_flag_id: null,
        settings_ids: [],
      };
    }
    return {
      name_id: s.names?.resource?.id ?? null,
      description_id: s.descriptions?.resource?.id ?? null,
      active_flag_id: s.flags?.current?.[0]?.flag_option_id ?? null,
      settings_ids:
        s.settings?.current
          ?.map((x) => x.settings_id)
          .filter((x): x is string => !!x) ?? [],
    };
  }, [s]);

  const formStateRef = React.useRef(formState as Record<string, unknown>);
  useEffect(() => {
    formStateRef.current = formState as Record<string, unknown>;
  }, [formState]);

  useEffect(() => {
    const next = getInitialFormState();
    setFormState((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(next)) return next;
      return prev;
    });
  }, [getInitialFormState]);

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);
  const draftVersion = s?.draft_version ?? null;

  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null; new_version?: number | null }>) | undefined
  >(undefined);
  useEffect(() => {
    if (!patchDepartmentDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) =>
      patchDepartmentDraftAction({ body: payload } as PatchDepartmentDraftIn);
  }, [patchDepartmentDraftAction]);

  const lastPatchedFormStateRef = React.useRef<Record<string, unknown> | null>(
    null,
  );
  const hasResourceIds = checkHasResourceIds(
    DEPARTMENT_RESOURCES,
    formState as unknown as Record<string, unknown>,
  );

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      expectedVersion: number,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => ({
      input_draft_id: inputDraftId || null,
      group_id: s?.group_id ?? null,
      ...buildResourceActions(DEPARTMENT_RESOURCES, {
        formState: formStateRef.current,
        referenceState: lastPatchedFormStateRef.current,
        flushResults: flushResults ?? {},
        entityData: s as Record<string, unknown> | null,
      }),
      expected_version: expectedVersion,
    }),
    [s],
  );

  const { setUrlFormDataRef, onFormDataChange, flushAllAndSave, formDataRef } =
    useDraftLifecycle({
      formStateKey,
      patchActionRef,
      isAutosaveEnabled,
      buildPatchPayload,
      setSelectedDraftId,
      serverDraftVersion: draftVersion,
      hasResourceIds,
      flushRegistryRef,
      formStateRef,
      onPatchSuccess: () => {
        lastPatchedFormStateRef.current = { ...formStateRef.current };
      },
    });

  const handleGenerateResources = useCallback(
    async (resourceTypes: ResourceType[], userInstructions?: string) => {
      if (!socket || !isConnected) {
        toast.error("WebSocket not connected");
        return;
      }
      setGeneratingResources((prev) => {
        const next = new Set(prev);
        resourceTypes.forEach((rt) => next.add(rt));
        return next;
      });
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }
      socket.emit("department_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: currentDraftId,
        department_id: departmentId || null,
      });
    },
    [
      socket,
      isConnected,
      departmentId,
      setGeneratingResources,
      formDataRef,
      flushAllAndSave,
    ],
  );

  const canRegenerate = useCallback(
    (rt: ResourceType): boolean => {
      if (!s) return false;
      switch (rt) {
        case "names":
          return s.names?.resource?.generated ?? false;
        case "descriptions":
          return s.descriptions?.resource?.generated ?? false;
        case "flags":
          return s.flags?.current?.some((f) => f.generated) ?? false;
        case "settings":
          return s.settings?.current?.some((x) => x.generated) ?? false;
        default:
          return false;
      }
    },
    [s],
  );
  const canRegenerateForStepCard = useCallback(
    (rt: string) => canRegenerate(rt as ResourceType),
    [canRegenerate],
  );

  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "settings"],
      all: ["names", "descriptions", "flags", "settings"],
    }),
    [],
  );
  const resourceLabels: Partial<Record<ResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      settings: "Settings",
    }),
    [],
  );
  const { handleOpenStepCardModal, modalProps } =
    useGenerationModal<ResourceType>({
      stepResources,
      resourceLabels,
      canRegenerate,
      onGenerate: (selected, instructions) =>
        handleGenerateResources(selected, instructions),
      isGenerating,
    });

  const disabled = useMemo(() => !s?.can_edit, [s?.can_edit]);

  useEffect(() => {
    const departmentName = s?.names?.resource?.name;
    if (departmentName && departmentId && isEditMode) {
      setEntityMetadata({
        entityId: departmentId,
        entityName: departmentName,
        entityType: "department",
      });
    }
    return () => clearEntityMetadata();
  }, [
    s?.names?.resource?.name,
    departmentId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      let flushResults: Record<string, unknown> = {};
      if (!isAutosaveEnabled) {
        flushResults = await flushAllResources();
      }

      const effectiveFormState = computeEffectiveFormState(
        DEPARTMENT_RESOURCES,
        formStateRef.current,
        flushResults,
      ) as unknown as DepartmentFormState;

      if (s?.names?.required && !effectiveFormState.name_id) {
        throw new Error("Department name is required");
      }
      if (!profile?.id) {
        throw new Error("Profile not loaded");
      }
      if (!s?.group_id) {
        throw new Error("Missing group_id");
      }
      if (!saveDepartmentAction) {
        throw new Error("Save action not available");
      }

      const initialState = getInitialFormState() as unknown as Record<
        string,
        unknown
      >;
      const saveActions = buildResourceActions(DEPARTMENT_RESOURCES, {
        formState: effectiveFormState as unknown as Record<string, unknown>,
        referenceState: initialState,
        flushResults,
        entityData: s as Record<string, unknown> | null,
      }) as Pick<
        SaveDepartmentBody,
        "names" | "descriptions" | "flags" | "settings"
      >;

      await saveDepartmentAction({
        body: {
          input_department_id: isEditMode ? departmentId ?? null : null,
          group_id: s.group_id,
          ...saveActions,
        },
      });
      toast.success(
        `Department ${isEditMode ? "updated" : "created"} successfully!`,
      );
      router.push("/system/departments");
    },
    [
      isAutosaveEnabled,
      flushAllResources,
      s,
      profile?.id,
      saveDepartmentAction,
      getInitialFormState,
      isEditMode,
      departmentId,
      router,
    ],
  );

  const getStepStatus = useCallback(
    (_stepId: string, _formData: Record<string, unknown>): StepStatus => {
      return formState.name_id && formState.description_id ? "completed" : "active";
    },
    [formState.name_id, formState.description_id],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the department name, description, active status, and settings.",
        resetFields: ["name_id", "description_id", "active_flag_id", "settings_ids"],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => ["name_id", "description_id", "active_flag_id", "settings_ids"],
    [],
  );

  const renderStep = useCallback(
    ({
      stepStatus,
      stepTitle,
      stepDescription,
      stepNumber,
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
    }) => (
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
            name_resource={s?.names?.resource ?? null}
            show_name={s?.names?.show ?? true}
            name_suggestions={s?.names?.suggestions ?? []}
            names={s?.names?.resources ?? []}
            disabled={disabled}
            onNameIdChange={(nameId) =>
              setFormState((prev) => ({ ...prev, name_id: nameId }))
            }
            onGenerate={() => handleGenerateResources(["names"])}
            isGenerating={isGenerating("names")}
            required={s?.names?.required ?? false}
            hideDescription={true}
            group_id={s?.group_id ?? null}
            showAiGenerate={s?.names?.show_ai_generate ?? false}
            create_tool_id={s?.names?.create_tool_id ?? null}
            link_tool_id={s?.names?.link_tool_id ?? null}
            createNamesAction={createNamesAction}
            isAutosaveEnabled={isAutosaveEnabled}
            registerFlush={registerFlushCallbacks["names"]}
          />
        }
        resetFields={["name_id", "description_id", "active_flag_id", "settings_ids"]}
        actions={
          s?.basic_show_ai_generate ? (
            <StepCardAiButton
              stepId="basic"
              resourceTypes={stepResources["basic"]}
              canRegenerate={canRegenerateForStepCard}
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
            description_resource={s?.descriptions?.resource ?? null}
            show_description={s?.descriptions?.show ?? true}
            description_suggestions={s?.descriptions?.suggestions ?? []}
            descriptions={s?.descriptions?.resources ?? []}
            disabled={disabled}
            onDescriptionIdChange={(descriptionId) =>
              setFormState((prev) => ({ ...prev, description_id: descriptionId }))
            }
            onGenerate={() => handleGenerateResources(["descriptions"])}
            isGenerating={isGenerating("descriptions")}
            required={s?.descriptions?.required ?? false}
            group_id={s?.group_id ?? null}
            showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
            create_tool_id={s?.descriptions?.create_tool_id ?? null}
            link_tool_id={s?.descriptions?.link_tool_id ?? null}
            createDescriptionsAction={createDescriptionsAction}
            isAutosaveEnabled={isAutosaveEnabled}
            registerFlush={registerFlushCallbacks["descriptions"]}
          />

          <Flags
            flag_id={formState.active_flag_id}
            flag_resource={
              s?.flags?.current?.[0]
                ? {
                    id: s.flags.current[0].flag_option_id ?? null,
                    name: s.flags.current[0].label ?? null,
                    description: s.flags.current[0].description ?? null,
                    icon: s.flags.current[0].icon_id ?? null,
                    generated: s.flags.current[0].generated ?? null,
                  }
                : null
            }
            flags={(s?.flags?.resources ?? []).map((f) => ({
              id: f.flag_option_id ?? null,
              name: f.label ?? null,
              description: f.description ?? null,
              icon: f.icon_id ?? null,
              generated: f.generated ?? null,
            }))}
            show_flag={s?.flags?.show ?? false}
            disabled={disabled}
            onFlagIdChange={(flagId) =>
              setFormState((prev) => ({ ...prev, active_flag_id: flagId }))
            }
            onGenerate={() => handleGenerateResources(["flags"])}
            isGenerating={isGenerating("flags")}
            required={s?.flags?.required ?? false}
            group_id={s?.group_id ?? null}
            showAiGenerate={s?.flags?.show_ai_generate ?? false}
            link_tool_id={s?.flags?.link_tool_id ?? null}
          />

          <Settings
            settings_ids={formState.settings_ids}
            settings_resources={s?.settings?.current ?? []}
            show_settings={s?.settings?.show ?? false}
            settings_suggestions={s?.settings?.suggestions ?? []}
            settings={s?.settings?.resources ?? []}
            disabled={disabled}
            onChange={(ids) =>
              setFormState((prev) => ({ ...prev, settings_ids: ids }))
            }
            onGenerate={() => handleGenerateResources(["settings"])}
            isGenerating={isGenerating("settings")}
            required={s?.settings?.required ?? false}
            group_id={s?.group_id ?? null}
            showAiGenerate={s?.settings?.show_ai_generate ?? false}
            link_tool_id={s?.settings?.link_tool_id ?? null}
          />
        </div>
      </StepCard>
    ),
    [
      disabled,
      isEditMode,
      formState,
      s,
      handleGenerateResources,
      isGenerating,
      createNamesAction,
      createDescriptionsAction,
      isAutosaveEnabled,
      registerFlushCallbacks,
      stepResources,
      canRegenerateForStepCard,
      handleOpenStepCardModal,
    ],
  );

  const departmentSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
    }),
    [],
  );

  return (
    <TooltipProvider>
      <div className="w-full p-6 space-y-8" data-page={`department-${isEditMode ? "edit" : "new"}`}>
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={s?.disabled_reason ?? null}
          entityType="department"
        />
        <GenericForm
          nuqsParsers={departmentSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={s}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={() => "Basic information reset"}
          onReset={(stepId) => {
            if (stepId === "basic") {
              setFormState({
                name_id: null,
                description_id: null,
                active_flag_id: null,
                settings_ids: [],
              });
            }
          }}
          onSubmit={handleSubmit}
          submitButton={{
            backUrl: "/system/departments",
            backLabel: "Back",
            createLabel: "Create Department",
            updateLabel: "Update Department",
          }}
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

export default React.memo(DepartmentComponent);
