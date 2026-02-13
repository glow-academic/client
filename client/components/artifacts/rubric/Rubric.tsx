/**
 * Rubric.tsx
 * Canonical rubric create/edit component (persona parity pattern).
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
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { Points } from "@/components/resources/Points";
import { Standards } from "@/components/resources/Standards";
import { StandardGroups } from "@/components/resources/StandardGroups";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type SaveRubricIn = InputOf<"/api/v4/artifacts/rubrics/save", "post">;
type SaveRubricOut = OutputOf<"/api/v4/artifacts/rubrics/save", "post">;
type SaveRubricBody = NonNullable<SaveRubricIn["body"]>;
type PatchRubricDraftIn = InputOf<"/api/v4/artifacts/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/api/v4/artifacts/rubrics/draft", "patch">;
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
type CreateDraftPointsIn = InputOf<"/api/v4/resources/points", "post">;
type CreateDraftPointsOut = OutputOf<"/api/v4/resources/points", "post">;
type CreateDraftStandardGroupsIn = InputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;
type CreateDraftStandardGroupsOut = OutputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;
type RubricData = OutputOf<"/api/v4/artifacts/rubrics/get", "post">;
type RubricResourceType =
  | "names"
  | "descriptions"
  | "flags"
  | "departments"
  | "points"
  | "pass_points"
  | "standard_groups"
  | "standards";

type RubricFormState = {
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  department_ids: string[];
  total_points_id: string | null;
  pass_points_id: string | null;
  standard_group_ids: string[];
  standard_ids: string[];
};

const FLUSH_KEYS = [
  "names",
  "descriptions",
  "departments",
  "standard_groups",
] as const;

const VALID_RESOURCE_TYPES: RubricResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "points",
  "pass_points",
  "standard_groups",
  "standards",
];

const RUBRIC_RESOURCES: ResourceConfig[] = [
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
    key: "points",
    formKey: "total_points_id",
    flushKey: null,
    type: "single",
  },
  {
    key: "pass_points",
    formKey: "pass_points_id",
    flushKey: null,
    type: "single",
  },
  {
    key: "standard_groups",
    formKey: "standard_group_ids",
    flushKey: "standard_group_ids",
    type: "multi",
  },
  {
    key: "standards",
    formKey: "standard_ids",
    flushKey: null,
    type: "multi",
  },
];

export interface RubricProps {
  rubricId?: string;
  rubricData?: RubricData;
  saveRubricAction?: (input: SaveRubricIn) => Promise<SaveRubricOut>;
  patchRubricDraftAction?: (
    input: PatchRubricDraftIn,
  ) => Promise<PatchRubricDraftOut>;
  createNamesAction?: (
    input: CreateDraftNamesIn,
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn,
  ) => Promise<CreateDraftDescriptionsOut>;
  createPointsAction?: (
    input: CreateDraftPointsIn,
  ) => Promise<CreateDraftPointsOut>;
  createStandardGroupsAction?: (
    input: CreateDraftStandardGroupsIn,
  ) => Promise<CreateDraftStandardGroupsOut>;
}

function RubricComponent({
  rubricId,
  rubricData,
  saveRubricAction,
  patchRubricDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createPointsAction,
  createStandardGroupsAction,
}: RubricProps) {
  const router = useRouter();
  const isEditMode = !!rubricId;
  const s = rubricData;

  const [formState, setFormState] = useState<RubricFormState>({
    name_id: null,
    description_id: null,
    active_flag_id: null,
    department_ids: [],
    total_points_id: null,
    pass_points_id: null,
    standard_group_ids: [],
    standard_ids: [],
  });

  const { profile, setSelectedDraftId, socket, isConnected } = useProfile();
  const { isAutosaveEnabled } = useSaveContext();
  const { flushRegistryRef, registerFlushCallbacks } =
    useFlushRegistry<Record<string, unknown>>(FLUSH_KEYS);

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
          | { id?: string | null; flag_option_id?: string | null }
          | null;
        const deptRes = data["department_resources"] as
          | Array<{ department_id?: string | null }>
          | null;
        const pointsRes = data["points_resource"] as { id?: string | null } | null;
        const passPointsRes = data["pass_points_resource"] as
          | { id?: string | null }
          | null;
        const standardGroupRes = data["standard_group_resources"] as
          | Array<{ standard_group_id?: string | null }>
          | null;
        const standardRes = data["standard_resources"] as
          | Array<{ standard_id?: string | null }>
          | null;

        if (nameRes?.id) updates["name_id"] = nameRes.id;
        if (descRes?.id) updates["description_id"] = descRes.id;
        if (flagRes?.flag_option_id || flagRes?.id) {
          updates["active_flag_id"] = flagRes.flag_option_id ?? flagRes.id;
        }
        if (pointsRes?.id) updates["total_points_id"] = pointsRes.id;
        if (passPointsRes?.id) updates["pass_points_id"] = passPointsRes.id;

        if (deptRes?.length) {
          const nextIds = deptRes
            .map((x) => x.department_id)
            .filter((x): x is string => !!x);
          const prevIds = (prev["department_ids"] as string[]) ?? [];
          updates["department_ids"] = [
            ...prevIds,
            ...nextIds.filter((id) => !prevIds.includes(id)),
          ];
        }

        if (standardGroupRes?.length) {
          const nextIds = standardGroupRes
            .map((x) => x.standard_group_id)
            .filter((x): x is string => !!x);
          const prevIds = (prev["standard_group_ids"] as string[]) ?? [];
          updates["standard_group_ids"] = [
            ...prevIds,
            ...nextIds.filter((id) => !prevIds.includes(id)),
          ];
        }

        if (standardRes?.length) {
          const nextIds = standardRes
            .map((x) => x.standard_id)
            .filter((x): x is string => !!x);
          const prevIds = (prev["standard_ids"] as string[]) ?? [];
          updates["standard_ids"] = [
            ...prevIds,
            ...nextIds.filter((id) => !prevIds.includes(id)),
          ];
        }

        if (data["active_flag_id"]) updates["active_flag_id"] = data["active_flag_id"];
        if (data["total_points_id"]) updates["total_points_id"] = data["total_points_id"];
        if (data["pass_points_id"]) updates["pass_points_id"] = data["pass_points_id"];

        return { ...prev, ...updates };
      },
    };
  }, []);

  const { setGeneratingResources, isGenerating } = useAiGeneration<
    RubricResourceType,
    Record<string, unknown>
  >({
    socket,
    isConnected,
    artifactType: "rubric",
    groupId: s?.group_id,
    eventPrefix: "rubric_generation",
    validResourceTypes: VALID_RESOURCE_TYPES,
    onComplete: onAiComplete,
    setFormState: setFormState as React.Dispatch<
      React.SetStateAction<Record<string, unknown>>
    >,
  });

  const getInitialFormState = useCallback((): RubricFormState => {
    if (!s) {
      return {
        name_id: null,
        description_id: null,
        active_flag_id: null,
        department_ids: [],
        total_points_id: null,
        pass_points_id: null,
        standard_group_ids: [],
        standard_ids: [],
      };
    }

    return {
      name_id: s.names?.resource?.id ?? null,
      description_id: s.descriptions?.resource?.id ?? null,
      active_flag_id: s.flags?.current?.[0]?.flag_option_id ?? null,
      department_ids:
        s.departments?.current
          ?.map((x) => x.department_id)
          .filter((x): x is string => !!x) ?? [],
      total_points_id: s.points?.resource?.id ?? null,
      pass_points_id: s.pass_points?.resource?.id ?? null,
      standard_group_ids:
        s.standard_groups?.current
          ?.map((x) => x.standard_group_id)
          .filter((x): x is string => !!x) ?? [],
      standard_ids:
        s.standards?.current
          ?.map((x) => x.standard_id)
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
    if (!patchRubricDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) =>
      patchRubricDraftAction({ body: payload } as PatchRubricDraftIn);
  }, [patchRubricDraftAction]);

  const lastPatchedFormStateRef = React.useRef<Record<string, unknown> | null>(
    null,
  );
  const hasResourceIds = checkHasResourceIds(
    RUBRIC_RESOURCES,
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
      ...buildResourceActions(RUBRIC_RESOURCES, {
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
    async (resourceTypes: RubricResourceType[], userInstructions?: string) => {
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
      socket.emit("rubric_generate", {
        resource_types: resourceTypes,
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: currentDraftId,
        rubric_id: rubricId || null,
      });
    },
    [
      socket,
      isConnected,
      rubricId,
      setGeneratingResources,
      formDataRef,
      flushAllAndSave,
    ],
  );

  const canRegenerate = useCallback(
    (rt: string): boolean => {
      if (!s) return false;
      switch (rt) {
        case "names":
          return s.names?.resource?.generated ?? false;
        case "descriptions":
          return s.descriptions?.resource?.generated ?? false;
        case "flags":
          return s.flags?.current?.some((f) => f.generated) ?? false;
        case "departments":
          return s.departments?.current?.some((x) => x.generated) ?? false;
        case "points":
          return s.points?.resource?.generated ?? false;
        case "pass_points":
          return s.pass_points?.resource?.generated ?? false;
        case "standard_groups":
          return (
            s.standard_groups?.current?.some(
              (x) => (x as { generated?: boolean | null }).generated ?? false,
            ) ?? false
          );
        case "standards":
          return (
            s.standards?.current?.some(
              (x) => (x as { generated?: boolean | null }).generated ?? false,
            ) ?? false
          );
        default:
          return false;
      }
    },
    [s],
  );

  const stepResources: Record<string, RubricResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments"],
      points: ["points", "pass_points"],
      standard_groups: ["standard_groups"],
      standards: ["standards"],
    }),
    [],
  );

  const resourceLabels: Partial<Record<RubricResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      points: "Total Points",
      pass_points: "Pass Points",
      standard_groups: "Standard Groups",
      standards: "Standards",
    }),
    [],
  );

  const { handleOpenStepCardModal, modalProps } =
    useGenerationModal<RubricResourceType>({
      stepResources,
      resourceLabels,
      canRegenerate,
      onGenerate: (selected, instructions) =>
        handleGenerateResources(selected, instructions),
      isGenerating,
    });

  const disabled = useMemo(() => !s?.can_edit, [s?.can_edit]);

  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      const flushResults = isAutosaveEnabled
        ? {}
        : await (async () => {
            const entries = await Promise.all(
              Object.values(flushRegistryRef.current).map((fn) => fn()),
            );
            return entries.reduce<Record<string, unknown>>((acc, cur) => {
              if (cur && typeof cur === "object") Object.assign(acc, cur);
              return acc;
            }, {});
          })();

      const effectiveFormState = computeEffectiveFormState(
        RUBRIC_RESOURCES,
        formStateRef.current,
        flushResults,
      ) as unknown as RubricFormState;

      if (s?.names?.required && !effectiveFormState.name_id) {
        throw new Error("Rubric name is required");
      }
      if (s?.departments?.required && effectiveFormState.department_ids.length === 0) {
        throw new Error("Department is required");
      }
      if (!profile?.id) {
        throw new Error("Profile not loaded");
      }
      if (!s?.group_id) {
        throw new Error("Missing group_id");
      }
      if (!saveRubricAction) {
        throw new Error("Save action not available");
      }

      const initialState = getInitialFormState() as unknown as Record<
        string,
        unknown
      >;
      const saveActions = buildResourceActions(RUBRIC_RESOURCES, {
        formState: effectiveFormState as unknown as Record<string, unknown>,
        referenceState: initialState,
        flushResults,
        entityData: s as Record<string, unknown> | null,
      }) as Pick<
        SaveRubricBody,
        | "names"
        | "descriptions"
        | "flags"
        | "departments"
        | "points"
        | "pass_points"
        | "standard_groups"
        | "standards"
      >;

      await saveRubricAction({
        body: {
          input_rubric_id: isEditMode ? rubricId ?? null : null,
          group_id: s.group_id,
          ...saveActions,
        },
      });

      toast.success(`Rubric ${isEditMode ? "updated" : "created"} successfully!`);
      router.push("/system/rubrics");
    },
    [
      isAutosaveEnabled,
      flushRegistryRef,
      s,
      profile?.id,
      saveRubricAction,
      getInitialFormState,
      isEditMode,
      rubricId,
      router,
    ],
  );

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      switch (stepId) {
        case "basic":
          return formState.name_id && formState.description_id
            ? "completed"
            : "active";
        case "points":
          return formState.pass_points_id ? "completed" : "active";
        case "standard_groups":
          return formState.standard_group_ids.length > 0 ? "completed" : "active";
        case "standards":
          return formState.standard_ids.length > 0 ? "completed" : "active";
        default:
          return "active";
      }
    },
    [formState],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set rubric name, description, departments, and active status.",
        resetFields: ["name_id", "description_id", "active_flag_id", "department_ids"],
      },
      {
        id: "points",
        title: "Points",
        description: "Set total points and pass points.",
        resetFields: ["total_points_id", "pass_points_id"],
      },
      {
        id: "standard_groups",
        title: "Standard Groups",
        description: "Choose standard groups.",
        resetFields: ["standard_group_ids"],
      },
      {
        id: "standards",
        title: "Standards",
        description: "Choose standards.",
        resetFields: ["standard_ids"],
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
      "total_points_id",
      "pass_points_id",
      "standard_group_ids",
      "standard_ids",
    ],
    [],
  );

  const renderStep = useCallback(
    ({
      stepId,
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
    }) => {
      if (stepId === "basic") {
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
                createNamesAction={createNamesAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["names"]}
              />
            }
            resetFields={[
              "name_id",
              "description_id",
              "active_flag_id",
              "department_ids",
            ]}
            actions={
              s?.basic_show_ai_generate ? (
                <StepCardAiButton
                  stepId="basic"
                  resourceTypes={stepResources["basic"] ?? []}
                  canRegenerate={(rt) =>
                    canRegenerate(rt as RubricResourceType)
                  }
                  isGenerating={(rt) =>
                    isGenerating(rt as RubricResourceType)
                  }
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
                createDescriptionsAction={createDescriptionsAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["descriptions"]}
              />

              <Departments
                department_ids={formState.department_ids}
                department_resources={s?.departments?.current ?? []}
                show_departments={s?.departments?.show ?? false}
                department_suggestions={s?.departments?.suggestions ?? []}
                departments={s?.departments?.resources ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, department_ids: ids }))
                }
                onGenerate={() => handleGenerateResources(["departments"])}
                isGenerating={isGenerating("departments")}
                required={s?.departments?.required ?? false}
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.departments?.show_ai_generate ?? false}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["departments"]}
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
                isGenerating={isGenerating("flags")}
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.flags?.show_ai_generate ?? false}
              />
            </div>
          </StepCard>
        );
      }

      if (stepId === "points") {
        return (
          <StepCard
            stepStatus={stepStatus}
            stepNumber={stepNumber}
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            isReadonly={disabled}
            isEditMode={isEditMode}
            resetFields={["total_points_id", "pass_points_id"]}
            actions={
              s?.content_show_ai_generate ? (
                <StepCardAiButton
                  stepId="points"
                  resourceTypes={stepResources["points"] ?? []}
                  canRegenerate={(rt) =>
                    canRegenerate(rt as RubricResourceType)
                  }
                  isGenerating={(rt) =>
                    isGenerating(rt as RubricResourceType)
                  }
                  onOpenModal={handleOpenStepCardModal}
                  disabled={disabled}
                />
              ) : undefined
            }
            {...(onReset ? { onReset } : {})}
          >
            <div className="space-y-4">
              <Points
                points_id={formState.total_points_id}
                points_resource={
                  s?.points?.resource
                    ? {
                        id: s.points.resource.id ?? null,
                        value: s.points.resource.value ?? null,
                        generated: s.points.resource.generated ?? null,
                      }
                    : null
                }
                show_points={s?.points?.show ?? false}
                points_suggestions={s?.points?.suggestions ?? []}
                points={(s?.points?.resources ?? []).map((p) => ({
                  id: p.id ?? null,
                  value: p.value ?? null,
                  generated: p.generated ?? null,
                }))}
                disabled={disabled}
                onPointsIdChange={(pointsId) =>
                  setFormState((prev) => ({ ...prev, total_points_id: pointsId }))
                }
                onGenerate={() => handleGenerateResources(["points"])}
                isGenerating={isGenerating("points")}
                label="Total Points"
                required={s?.points?.required ?? false}
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.points?.show_ai_generate ?? false}
                create_tool_id={s?.points?.create_tool_id ?? null}
                createPointsAction={createPointsAction}
                isAutosaveEnabled={isAutosaveEnabled}
              />

              <Points
                points_id={formState.pass_points_id}
                points_resource={
                  s?.pass_points?.resource
                    ? {
                        id: s.pass_points.resource.id ?? null,
                        value: s.pass_points.resource.value ?? null,
                        generated: s.pass_points.resource.generated ?? null,
                      }
                    : null
                }
                show_points={s?.pass_points?.show ?? false}
                points_suggestions={s?.pass_points?.suggestions ?? []}
                points={(s?.pass_points?.resources ?? []).map((p) => ({
                  id: p.id ?? null,
                  value: p.value ?? null,
                  generated: p.generated ?? null,
                }))}
                disabled={disabled}
                onPointsIdChange={(pointsId) =>
                  setFormState((prev) => ({ ...prev, pass_points_id: pointsId }))
                }
                onGenerate={() => handleGenerateResources(["pass_points"])}
                isGenerating={isGenerating("pass_points")}
                label="Pass Points"
                required={s?.pass_points?.required ?? false}
                group_id={s?.group_id ?? null}
                showAiGenerate={s?.pass_points?.show_ai_generate ?? false}
                create_tool_id={s?.pass_points?.create_tool_id ?? null}
                createPointsAction={createPointsAction}
                isAutosaveEnabled={isAutosaveEnabled}
              />
            </div>
          </StepCard>
        );
      }

      if (stepId === "standard_groups") {
        return (
          <StepCard
            stepStatus={stepStatus}
            stepNumber={stepNumber}
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            isReadonly={disabled}
            isEditMode={isEditMode}
            resetFields={["standard_group_ids"]}
            actions={
              s?.content_show_ai_generate ? (
                <StepCardAiButton
                  stepId="standard_groups"
                  resourceTypes={stepResources["standard_groups"] ?? []}
                  canRegenerate={(rt) =>
                    canRegenerate(rt as RubricResourceType)
                  }
                  isGenerating={(rt) =>
                    isGenerating(rt as RubricResourceType)
                  }
                  onOpenModal={handleOpenStepCardModal}
                  disabled={disabled}
                />
              ) : undefined
            }
            {...(onReset ? { onReset } : {})}
          >
            <StandardGroups
              standard_group_ids={formState.standard_group_ids}
              standard_group_resources={s?.standard_groups?.current ?? []}
              show_standard_groups={s?.standard_groups?.show ?? false}
              standard_group_suggestions={s?.standard_groups?.suggestions ?? []}
              standard_groups={s?.standard_groups?.resources ?? []}
              disabled={disabled}
              onChange={(ids) =>
                setFormState((prev) => ({ ...prev, standard_group_ids: ids }))
              }
              onGenerate={() => handleGenerateResources(["standard_groups"])}
              isGenerating={isGenerating("standard_groups")}
              required={s?.standard_groups?.required ?? false}
              group_id={s?.group_id ?? null}
              showAiGenerate={s?.standard_groups?.show_ai_generate ?? false}
              create_tool_id={s?.standard_groups?.create_tool_id ?? null}
              createStandardGroupsAction={createStandardGroupsAction}
              isAutosaveEnabled={isAutosaveEnabled}
              registerFlush={registerFlushCallbacks["standard_groups"]}
            />
          </StepCard>
        );
      }

      return (
        <StepCard
          stepStatus={stepStatus}
          stepNumber={stepNumber}
          stepTitle={stepTitle}
          stepDescription={stepDescription}
          isReadonly={disabled}
          isEditMode={isEditMode}
          resetFields={["standard_ids"]}
          actions={
            s?.content_show_ai_generate ? (
              <StepCardAiButton
                stepId="standards"
                resourceTypes={stepResources["standards"] ?? []}
                canRegenerate={(rt) =>
                  canRegenerate(rt as RubricResourceType)
                }
                isGenerating={(rt) =>
                  isGenerating(rt as RubricResourceType)
                }
                onOpenModal={handleOpenStepCardModal}
                disabled={disabled}
              />
            ) : undefined
          }
          {...(onReset ? { onReset } : {})}
        >
          <Standards
            standard_ids={formState.standard_ids}
            standard_resources={s?.standards?.current ?? []}
            show_standards={s?.standards?.show ?? false}
            standard_suggestions={s?.standards?.suggestions ?? []}
            standards={s?.standards?.resources ?? []}
            disabled={disabled}
            onChange={(ids) =>
              setFormState((prev) => ({ ...prev, standard_ids: ids }))
            }
            onGenerate={() => handleGenerateResources(["standards"])}
            isGenerating={isGenerating("standards")}
            required={s?.standards?.required ?? false}
            group_id={s?.group_id ?? null}
            showAiGenerate={s?.standards?.show_ai_generate ?? false}
          />
        </StepCard>
      );
    },
    [
      disabled,
      isEditMode,
      formState,
      s,
      handleGenerateResources,
      isGenerating,
      createNamesAction,
      createDescriptionsAction,
      createPointsAction,
      createStandardGroupsAction,
      isAutosaveEnabled,
      registerFlushCallbacks,
      stepResources,
      canRegenerate,
      handleOpenStepCardModal,
    ],
  );

  const rubricSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      descriptionSearch: parseAsString,
      standardGroupSearch: parseAsString,
      pointsSearch: parseAsString,
      pointsShowSelected: parseAsBoolean,
      standardGroupShowSelected: parseAsBoolean,
    }),
    [],
  );

  return (
    <TooltipProvider>
      <div className="w-full p-6 space-y-8" data-page={`rubric-${isEditMode ? "edit" : "new"}`}>
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={s?.disabled_reason ?? null}
          entityType="rubric"
        />
        <GenericForm
          nuqsParsers={rubricSearchParamsClient as Record<string, Parser<unknown>>}
          steps={steps}
          getStepStatus={getStepStatus}
          serverData={s}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={() => "Step reset"}
          onReset={(stepId) => {
            if (stepId === "basic") {
              setFormState((prev) => ({
                ...prev,
                name_id: null,
                description_id: null,
                active_flag_id: null,
                department_ids: [],
              }));
            }
            if (stepId === "points") {
              setFormState((prev) => ({
                ...prev,
                total_points_id: null,
                pass_points_id: null,
              }));
            }
            if (stepId === "standard_groups") {
              setFormState((prev) => ({ ...prev, standard_group_ids: [] }));
            }
            if (stepId === "standards") {
              setFormState((prev) => ({ ...prev, standard_ids: [] }));
            }
          }}
          onSubmit={handleSubmit}
          submitButton={{
            backUrl: "/system/rubrics",
            backLabel: "Back",
            createLabel: "Create Rubric",
            updateLabel: "Update Rubric",
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

export default React.memo(RubricComponent);
