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
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Settings } from "@/components/resources/Settings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import { useFlushRegistry } from "@/hooks/use-flush-registry";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  computeEffectiveFormState,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsString, type Parser } from "nuqs";

type SaveDepartmentIn = InputOf<"/api/v5/artifacts/departments/save", "post">;
type SaveDepartmentOut = OutputOf<"/api/v5/artifacts/departments/save", "post">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type PatchDepartmentDraftIn = InputOf<
  "/api/v5/artifacts/departments/draft",
  "patch"
>;
type PatchDepartmentDraftOut = OutputOf<
  "/api/v5/artifacts/departments/draft",
  "patch"
>;
type DepartmentData = OutputOf<"/api/v5/artifacts/departments/get", "post">;

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

  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const { flushRegistryRef, registerFlushCallbacks, flushAllResources } =
    useFlushRegistry<FlushResult>(FLUSH_KEYS);

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "department",
    validResourceTypes: VALID_RESOURCE_TYPES as string[],
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
      ...buildDraftPayload(DEPARTMENT_RESOURCES, {
        formState: formStateRef.current,
        referenceState: lastPatchedFormStateRef.current,
        flushResults: flushResults ?? {},
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
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }
      generate(resourceTypes, {
        draft_id: currentDraftId,
        artifact_id: departmentId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [
      departmentId,
      generate,
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
          return false;
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
  const isGeneratingForStepCard = useCallback(
    (rt: string) => isGenerating(rt as ResourceType),
    [isGenerating],
  );

  const stepResources: Record<string, ResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "settings"],
      all: ["names", "descriptions", "flags", "settings"],
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

  const disabled = useMemo(() => !s?.can_edit, [s?.can_edit]);

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

      await saveDepartmentAction({
        body: {
          input_department_id: isEditMode ? departmentId ?? null : null,
          name_id: effectiveFormState.name_id!,
          description_id: effectiveFormState.description_id ?? null,
          flag_id: effectiveFormState.active_flag_id ?? null,
          settings_ids: effectiveFormState.settings_ids?.length
            ? effectiveFormState.settings_ids
            : null,
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
            required={s?.names?.required ?? false}
            hideDescription={true}

            showAiGenerate={s?.names?.show_ai_generate ?? false}
            create_tool_id={s?.names?.create_tool_id ?? null}
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
              resourceTypes={(stepResources["basic"] ?? []) as string[]}
              canRegenerate={canRegenerateForStepCard}
              isGenerating={isGeneratingForStepCard}
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
            description_resource={s?.descriptions?.resource ?? null}
            show_description={s?.descriptions?.show ?? true}
            description_suggestions={s?.descriptions?.suggestions ?? []}
            descriptions={s?.descriptions?.resources ?? []}
            disabled={disabled}
            onDescriptionIdChange={(descriptionId) =>
              setFormState((prev) => ({ ...prev, description_id: descriptionId }))
            }
            onGenerate={() => handleGenerateResources(["descriptions"])}
            required={s?.descriptions?.required ?? false}

            showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
            create_tool_id={s?.descriptions?.create_tool_id ?? null}
            createDescriptionsAction={createDescriptionsAction}
            isAutosaveEnabled={isAutosaveEnabled}
            registerFlush={registerFlushCallbacks["descriptions"]}
          />

          <Flags
            flags={s?.flags?.resources ?? []}
            flag_id={formState.active_flag_id}
            show_flags={s?.flags?.show ?? false}
            columns={1}
            disabled={disabled}
            onChange={(flagId) =>
              setFormState((prev) => ({ ...prev, active_flag_id: flagId }))
            }
            onGenerate={() => handleGenerateResources(["flags"])}

            showAiGenerate={s?.flags?.show_ai_generate ?? false}
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
            required={s?.settings?.required ?? false}

            showAiGenerate={s?.settings?.show_ai_generate ?? false}
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
      isGeneratingForStepCard,
      handleDirectStepGenerate,
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
      </div>
    </TooltipProvider>
  );
}

export default React.memo(DepartmentComponent);
