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
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateRubricIn = InputOf<"/rubric/create", "post">;
type CreateRubricOut = OutputOf<"/rubric/create", "post">;
type UpdateRubricIn = InputOf<"/rubric/update", "post">;
type UpdateRubricOut = OutputOf<"/rubric/update", "post">;
type PatchRubricDraftIn = InputOf<"/rubric/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/rubric/draft", "patch">;
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
type CreateDraftPointsIn = InputOf<"/api/v5/resources/points", "post">;
type CreateDraftPointsOut = OutputOf<"/api/v5/resources/points", "post">;
type CreateDraftStandardGroupsIn = InputOf<
  "/api/v5/resources/standard_groups",
  "post"
>;
type CreateDraftStandardGroupsOut = OutputOf<
  "/api/v5/resources/standard_groups",
  "post"
>;
type RubricData = OutputOf<"/rubric/get", "post">;
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
  name: string | null;
  name_id: string | null;
  description: string | null;
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
  "points",
  "pass_points",
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
    flushKey: "total_points_id",
    type: "single",
  },
  {
    key: "pass_points",
    formKey: "pass_points_id",
    flushKey: "pass_points_id",
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
  createRubricAction?: (input: CreateRubricIn) => Promise<CreateRubricOut>;
  updateRubricAction?: (input: UpdateRubricIn) => Promise<UpdateRubricOut>;
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
  createRubricAction,
  updateRubricAction,
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
    name: null,
    name_id: null,
    description: null,
    description_id: null,
    active_flag_id: null,
    department_ids: [],
    total_points_id: null,
    pass_points_id: null,
    standard_group_ids: [],
    standard_ids: [],
  });

  const { profile } = useProfile();
  const { setSelectedDraftId, isAutosaveEnabled } = useDrafts();
  const { flushRegistryRef, registerFlushCallbacks } =
    useFlushRegistry<Record<string, unknown>>(FLUSH_KEYS);

  const { isGenerating, generate } = useArtifactAi({
    artifactType: "rubric",
    validResourceTypes: VALID_RESOURCE_TYPES as string[],
  });

  const getInitialFormState = useCallback((): RubricFormState => {
    if (!s) {
      return {
        name: null,
        name_id: null,
        description: null,
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
      name: null,
      name_id: s.names?.resource?.id ?? null,
      description: null,
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

  const serverSyncPendingRef = React.useRef(false);
  const formStateKey = useMemo(() => {
    if (serverSyncPendingRef.current) return undefined;
    return JSON.stringify(formState);
  }, [formState]);
  const patchActionRef = React.useRef<
    ((payload: Record<string, unknown>) => Promise<{ draft_id?: string | null }>) | undefined
  >(undefined);
  useEffect(() => {
    if (!patchRubricDraftAction) {
      patchActionRef.current = undefined;
      return;
    }
    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const res = await patchRubricDraftAction({ body: payload } as PatchRubricDraftIn);
      if (res.form_state) {
        serverSyncPendingRef.current = true;
        setFormState((prev) => ({
          ...prev,
          name: null,
          name_id: (res.form_state!.name_id as string) ?? prev.name_id,
          description: null,
          description_id: (res.form_state!.description_id as string) ?? prev.description_id,
        }));
        requestAnimationFrame(() => {
          serverSyncPendingRef.current = false;
        });
      }
      return res;
    };
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
      flushResults?: Record<string, unknown>,
    ): Record<string, unknown> => {
      const payload: Record<string, unknown> = {
        input_draft_id: inputDraftId || null,
        group_id: s?.group_id ?? null,
        ...buildDraftPayload(RUBRIC_RESOURCES, {
          formState: formStateRef.current,
          referenceState: lastPatchedFormStateRef.current,
          flushResults: flushResults ?? {},
        }),
      };
      const fs = formStateRef.current as unknown as RubricFormState;
      if (fs.name) {
        payload["name"] = fs.name;
        delete payload["name_id"];
      }
      if (fs.description) {
        payload["description"] = fs.description;
        delete payload["description_id"];
      }
      return payload;
    },
    [s],
  );

  const { setUrlFormDataRef, onFormDataChange, flushAllAndSave, formDataRef } =
    useDraftLifecycle({
      formStateKey,
      patchActionRef,
      isAutosaveEnabled,
      buildPatchPayload,
      setSelectedDraftId,
      hasResourceIds,
      flushRegistryRef,
      formStateRef,
      onPatchSuccess: () => {
        lastPatchedFormStateRef.current = { ...formStateRef.current };
      },
    });

  const handleGenerateResources = useCallback(
    async (resourceTypes: RubricResourceType[], userInstructions?: string) => {
      let currentDraftId =
        (formDataRef.current["draftId"] as string | undefined) ?? null;
      if (!currentDraftId) currentDraftId = await flushAllAndSave();
      if (!currentDraftId) {
        toast.error("Please save a draft before generating with AI");
        return;
      }
      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: currentDraftId,
        artifact_id: rubricId || null,
      });
    },
    [
      rubricId,
      generate,
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

      const pointIds = [
        effectiveFormState.total_points_id,
        effectiveFormState.pass_points_id,
      ].filter((x): x is string => !!x);

      if (isEditMode) {
        if (!updateRubricAction) throw new Error("Update action not available");
        await updateRubricAction({
          body: {
            rubrics: [
              {
                rubric_id: rubricId!,
                name_id: effectiveFormState.name_id ?? undefined,
                description_id: effectiveFormState.description_id ?? undefined,
                active_flag_id: effectiveFormState.active_flag_id ?? undefined,
                department_ids: effectiveFormState.department_ids?.length
                  ? effectiveFormState.department_ids
                  : undefined,
                point_ids: pointIds.length ? pointIds : undefined,
                standard_group_ids: effectiveFormState.standard_group_ids?.length
                  ? effectiveFormState.standard_group_ids
                  : undefined,
                standard_ids: effectiveFormState.standard_ids?.length
                  ? effectiveFormState.standard_ids
                  : undefined,
              },
            ],
            group_id: s.group_id,
          },
        } as UpdateRubricIn);
      } else {
        if (!createRubricAction) throw new Error("Create action not available");
        await createRubricAction({
          body: {
            rubrics: [
              {
                name_id: effectiveFormState.name_id!,
                description_id: effectiveFormState.description_id ?? undefined,
                active_flag_id: effectiveFormState.active_flag_id ?? undefined,
                department_ids: effectiveFormState.department_ids?.length
                  ? effectiveFormState.department_ids
                  : undefined,
                point_ids: pointIds.length ? pointIds : undefined,
                standard_group_ids: effectiveFormState.standard_group_ids?.length
                  ? effectiveFormState.standard_group_ids
                  : undefined,
                standard_ids: effectiveFormState.standard_ids?.length
                  ? effectiveFormState.standard_ids
                  : undefined,
              },
            ],
            group_id: s.group_id,
          },
        } as CreateRubricIn);
      }

      toast.success(`Rubric ${isEditMode ? "updated" : "created"} successfully!`);
      router.push("/system/rubrics");
    },
    [
      isAutosaveEnabled,
      flushRegistryRef,
      s,
      profile?.id,
      createRubricAction,
      updateRubricAction,
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
                  setFormState((prev) => ({ ...prev, name_id: nameId, name: null }))
                }
                onNameChange={(name) =>
                  setFormState((prev) => ({ ...prev, name }))
                }
                onGenerate={() => handleGenerateResources(["names"])}
                required={s?.names?.required ?? false}
                hideDescription={true}
                showAiGenerate={s?.names?.show_ai_generate ?? false}
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
                  setFormState((prev) => ({ ...prev, description_id: descriptionId, description: null }))
                }
                onDescriptionChange={(description) =>
                  setFormState((prev) => ({ ...prev, description }))
                }
                onGenerate={() => handleGenerateResources(["descriptions"])}
                required={s?.descriptions?.required ?? false}
                showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
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
                required={s?.departments?.required ?? false}
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
                  onOpenModal={handleDirectStepGenerate}
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
                label="Total Points"
                required={s?.points?.required ?? false}
                showAiGenerate={s?.points?.show_ai_generate ?? false}
                createPointsAction={createPointsAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["points"]}
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
                label="Pass Points"
                required={s?.pass_points?.required ?? false}
                showAiGenerate={s?.pass_points?.show_ai_generate ?? false}
                createPointsAction={createPointsAction}
                isAutosaveEnabled={isAutosaveEnabled}
                registerFlush={registerFlushCallbacks["pass_points"]}
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
                  onOpenModal={handleDirectStepGenerate}
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
              required={s?.standard_groups?.required ?? false}
              showAiGenerate={s?.standard_groups?.show_ai_generate ?? false}
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
                onOpenModal={handleDirectStepGenerate}
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
            required={s?.standards?.required ?? false}
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
      handleDirectStepGenerate,
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
                name: null,
                name_id: null,
                description: null,
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
      </div>
    </TooltipProvider>
  );
}

export default React.memo(RubricComponent);
