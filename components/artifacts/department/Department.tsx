/**
 * Department.tsx
 * Canonical department create/edit component.
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
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Settings } from "@/components/resources/Settings";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDrafts } from "@/contexts/draft-context";
import { useProfile } from "@/contexts/profile-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  buildDraftPayload,
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { parseAsString, type Parser } from "nuqs";

type CreateDepartmentIn = InputOf<"/department/create", "post">;
type CreateDepartmentOut = OutputOf<"/department/create", "post">;
type UpdateDepartmentIn = InputOf<"/department/update", "post">;
type UpdateDepartmentOut = OutputOf<"/department/update", "post">;
type PatchDepartmentDraftIn = InputOf<"/department/draft", "patch">;
type PatchDepartmentDraftOut = OutputOf<"/department/draft", "patch">;

type DepartmentData = OutputOf<"/department/get", "post">;


type DepartmentDraftFormState = {
  name_id?: string | null;
  name?: string | null;
  description_id?: string | null;
  description?: string | null;
  flag_id?: string | null;
  active_flag_id?: string | null;
  setting_ids?: string[] | null;
  pending_ids?: string[] | null;
};

type CanonicalDepartmentData = DepartmentData;

type DepartmentResourceType = "names" | "descriptions" | "flags" | "settings";

type DepartmentFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  active_flag_id: string | null;
  setting_ids: string[];
  pending_ids: string[];
};

const VALID_RESOURCE_TYPES: DepartmentResourceType[] = [
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
  { key: "settings", formKey: "setting_ids", flushKey: "setting_ids", type: "multi" },
];

export interface DepartmentProps {
  departmentId?: string;
  mode?: "create" | "edit";
  departmentData?: DepartmentData;
  createDepartmentAction?: (
    input: CreateDepartmentIn,
  ) => Promise<CreateDepartmentOut>;
  updateDepartmentAction?: (
    input: UpdateDepartmentIn,
  ) => Promise<UpdateDepartmentOut>;
  patchDepartmentDraftAction?: (
    input: PatchDepartmentDraftIn,
  ) => Promise<PatchDepartmentDraftOut>;
}

function DepartmentComponent({
  departmentId,
  mode = departmentId ? "edit" : "create",
  departmentData,
  createDepartmentAction,
  updateDepartmentAction,
  patchDepartmentDraftAction,
}: DepartmentProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!departmentId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const department = departmentData as unknown as CanonicalDepartmentData | undefined;
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());

  const departmentDataRef = useRef<CanonicalDepartmentData | undefined>(department);
  useEffect(() => {
    departmentDataRef.current = department;
  }, [department]);

  const stableDepartmentData = useMemo(() => {
    if (!department) return null;
    return {
      names: department.names,
      descriptions: department.descriptions,
      flags: department.flags,
      settings: department.settings,
      basic_show_ai_generate: department.basic_show_ai_generate ?? false,
      show_ai_generate: department.show_ai_generate ?? false,
      group_id: department.group_id,
    };
  }, [
    department?.names,
    department?.descriptions,
    department?.flags,
    department?.settings,
    department?.basic_show_ai_generate,
    department?.show_ai_generate,
    department?.group_id,
  ]);

  const getInitialFormState = useCallback((): DepartmentFormState => {
    const data = departmentDataRef.current;
    if (!data) {
      return {
        name_id: null,
        name: null,
        description_id: null,
        description: null,
        active_flag_id: null,
        setting_ids: [],
        pending_ids: [],
      };
    }

    return {
      name_id: data.names?.find((item) => item.selected)?.id ?? null,
      name: null,
      description_id:
        data.descriptions?.find((item) => item.selected)?.id ?? null,
      description: null,
      active_flag_id:
        data.flags?.find((item) => item.selected)?.flag_option_id ?? null,
      setting_ids:
        (data.settings?.filter((item) => item.selected) ?? [])
          .map((item) => item.id)
          .filter((id): id is string => !!id),
      pending_ids:
        data.pending_ids?.filter((id): id is string => !!id) ?? [],
    };
  }, []);

  const [formState, setFormState] = useState<DepartmentFormState>(
    getInitialFormState,
  );

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
    if (!patchDepartmentDraftAction) {
      patchActionRef.current = undefined;
      return;
    }

    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchDepartmentDraftAction({
        body: payload,
      } as PatchDepartmentDraftIn);

      const formStateFromServer =
        (result?.form_state ?? null) as DepartmentDraftFormState | null;
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
          setting_ids: formStateFromServer.setting_ids ?? prev.setting_ids,
          pending_ids: formStateFromServer.pending_ids ?? prev.pending_ids,
        }));
      }

      return result;
    };
  }, [patchDepartmentDraftAction]);

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);

  const buildPatchPayload = useCallback(
    (
      inputDraftId: string | null,
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const currentFormState =
        formStateRef.current as unknown as DepartmentFormState;
      const payload: Record<string, unknown> = {
        draft_id: inputDraftId || null,
        input_draft_id: inputDraftId || null,
        ...buildDraftPayload(DEPARTMENT_RESOURCES, {
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
    DEPARTMENT_RESOURCES,
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
    artifactType: "department",
    validResourceTypes: VALID_RESOURCE_TYPES as string[],
  });

  const handleGenerateResources = useCallback(
    async (resourceTypes: DepartmentResourceType[], userInstructions?: string) => {
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
        artifact_id: departmentId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [departmentId, flushAllAndSave, formDataRef, generate],
  );

  const canRegenerate = useCallback(
    (resourceType: DepartmentResourceType) => {
      if (!stableDepartmentData) return false;
      switch (resourceType) {
        case "names":
          return stableDepartmentData.names?.find((item) => item.selected)?.generated ?? false;
        case "descriptions":
          return (
            stableDepartmentData.descriptions?.find((item) => item.selected)?.generated ??
            false
          );
        case "flags":
          return (
            stableDepartmentData.flags?.some((item) => item.selected && item.generated) ??
            false
          );
        case "settings":
          return (
            stableDepartmentData.settings?.some((item) => item.selected && item.generated) ??
            false
          );
        default:
          return false;
      }
    },
    [stableDepartmentData],
  );

  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as DepartmentResourceType),
    [canRegenerate],
  );
  const isGeneratingForStepCard = useCallback(
    (resourceType: string) => isGenerating(resourceType as DepartmentResourceType),
    [isGenerating],
  );

  const stepResources: Record<string, DepartmentResourceType[]> = useMemo(
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
    [handleGenerateResources, stepResources],
  );

  const disabled = useMemo(
    () => !department?.can_edit,
    [department?.can_edit],
  );

  const handleSubmit = useCallback(
    async () => {
      const effectiveFormState =
        formStateRef.current as unknown as DepartmentFormState;

      if (!effectiveFormState.name_id) {
        throw new Error("Department name is required");
      }
      if (!profile?.id) {
        throw new Error("Profile not loaded");
      }

      if (isEditMode && departmentId && updateDepartmentAction) {
        await updateDepartmentAction({
          body: {
            departments: [
              {
                department_id: departmentId,
                name_id: effectiveFormState.name_id ?? undefined,
                description_id: effectiveFormState.description_id ?? undefined,
                active_flag_id: effectiveFormState.active_flag_id ?? undefined,
                settings_ids: effectiveFormState.setting_ids.length
                  ? effectiveFormState.setting_ids
                  : null,
              },
            ],
            group_id: stableDepartmentData?.group_id ?? null,
          },
        } as UpdateDepartmentIn);
      } else if (createDepartmentAction) {
        await createDepartmentAction({
          body: {
            departments: [
              {
                name_id: effectiveFormState.name_id ?? undefined,
                description_id: effectiveFormState.description_id ?? undefined,
                active_flag_id: effectiveFormState.active_flag_id ?? undefined,
                settings_ids: effectiveFormState.setting_ids.length
                  ? effectiveFormState.setting_ids
                  : null,
              },
            ],
            group_id: stableDepartmentData?.group_id ?? null,
          },
        } as CreateDepartmentIn);
      } else {
        throw new Error("Save action not available");
      }

      toast.success(
        `Department ${isEditMode ? "updated" : "created"} successfully!`,
      );
      router.push("/system/departments");
    },
    [
      createDepartmentAction,
      departmentId,
      isEditMode,
      profile?.id,
      router,
      stableDepartmentData?.group_id,
      updateDepartmentAction,
    ],
  );

  const getStepStatus = useCallback(
    (_stepId: string, _formData: Record<string, unknown>): StepStatus => {
      return formState.name_id ? "completed" : "active";
    },
    [formState.name_id],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the department name, description, active status, and settings.",
        resetFields: [
          "name_id",
          "description_id",
          "active_flag_id",
          "setting_ids",
        ],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => ["name_id", "description_id", "active_flag_id", "setting_ids"],
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
            name_resource={
              department?.names?.find((item) => item.selected) ?? null
            }
            show_name={true}
            names={department?.names ?? []}
            disabled={disabled}
            onNameIdChange={(nameId) =>
              setFormState((prev) => ({ ...prev, name_id: nameId, name: null }))
            }
            onNameChange={(name) =>
              setFormState((prev) => ({ ...prev, name }))
            }
            required={true}
            hideDescription={true}
            isAutosaveEnabled={isAutosaveEnabled}
          />
        }
        resetFields={["name_id", "description_id", "active_flag_id", "setting_ids"]}
        actions={
          stableDepartmentData?.basic_show_ai_generate ? (
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
            description_resource={
              department?.descriptions?.find((item) => item.selected) ?? null
            }
            show_description={true}
            descriptions={department?.descriptions ?? []}
            disabled={disabled}
            onDescriptionIdChange={(descriptionId) =>
              setFormState((prev) => ({
                ...prev,
                description_id: descriptionId,
                description: null,
              }))
            }
            onDescriptionChange={(description) =>
              setFormState((prev) => ({ ...prev, description }))
            }
            required={false}
            isAutosaveEnabled={isAutosaveEnabled}
          />

          <Flags
            flags={department?.flags ?? []}
            flag_id={formState.active_flag_id}
            show_flags={(department?.flags?.length ?? 0) > 0}
            columns={1}
            disabled={disabled}
            onChange={(flagId) =>
              setFormState((prev) => ({ ...prev, active_flag_id: flagId }))
            }
          />

          <Settings
            settings_ids={formState.setting_ids}
            settings={department?.settings ?? []}
            disabled={disabled}
            onChange={(ids) =>
              setFormState((prev) => ({ ...prev, setting_ids: ids }))
            }
            required={false}
          />
        </div>
      </StepCard>
    ),
    [
      department?.descriptions,
      department?.flags,
      department?.names,
      department?.settings,
      disabled,
      formState.active_flag_id,
      formState.description_id,
      formState.name_id,
      formState.setting_ids,
      handleDirectStepGenerate,
      handleGenerateResources,
      isAutosaveEnabled,
      isEditMode,
      stableDepartmentData?.basic_show_ai_generate,
      stepResources["basic"],
      canRegenerateForStepCard,
      isGeneratingForStepCard,
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
      <div
        className="w-full space-y-8 p-6"
        data-page={`department-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={department?.disabled_reason ?? null}
          entityType="department"
        />
        <GenericForm
          nuqsParsers={
            departmentSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={departmentData as unknown as Record<string, unknown> | undefined}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={() => "Basic information reset"}
          onReset={(stepId) => {
            if (stepId === "basic") {
              setFormState({
                name_id: null,
                name: null,
                description_id: null,
                description: null,
                active_flag_id: null,
                setting_ids: [],
                pending_ids: [],
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
