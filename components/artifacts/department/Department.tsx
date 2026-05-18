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
import { useDepartmentAi } from "@/hooks/use-department-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { parseAsString, type Parser } from "nuqs";

type CreateDepartmentIn = InputOf<"/department/create", "post">;
type CreateDepartmentOut = OutputOf<"/department/create", "post">;
type UpdateDepartmentIn = InputOf<"/department/update", "post">;
type UpdateDepartmentOut = OutputOf<"/department/update", "post">;
type PatchDepartmentDraftIn = InputOf<"/department/draft", "post">;
type PatchDepartmentDraftOut = OutputOf<"/department/draft", "post">;

type DepartmentData = OutputOf<"/department/get", "post">;


type DepartmentDraftFormState = {
  name_id?: string | null;
  name?: string | null;
  description_id?: string | null;
  description?: string | null;
  flag_ids?: string[] | null;
  active?: boolean | null;
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
  flag_ids: string[];
  setting_ids: string[];
  pending_ids: string[];
};

const DEPARTMENT_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
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
        flag_ids: [],
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
      flag_ids: (data.flags?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
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
            flag_ids: formStateFromServer.flag_ids ?? prev.flag_ids,
            setting_ids: formStateFromServer.setting_ids ?? prev.setting_ids,
            pending_ids: formStateFromServer.pending_ids ?? prev.pending_ids,
          };
          // Only set the server-sync absorb flag when state actually changes
          // (same fix as Persona / Parameter / Profile / etc).
          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            prev.description_id !== next.description_id ||
            prev.description !== next.description ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            JSON.stringify(prev.setting_ids) !== JSON.stringify(next.setting_ids) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }

      return result;
    };
  }, [patchDepartmentDraftAction]);

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);

  // Append-only: always send full current state as a complete snapshot.
  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as unknown as DepartmentFormState;
    const payload: Record<string, unknown> = {};

    if (current.name != null) {
      payload["name"] = current.name;
    } else if (current.name_id) {
      payload["name_id"] = current.name_id;
    }

    if (current.description != null) {
      payload["description"] = current.description;
    } else if (current.description_id) {
      payload["description_id"] = current.description_id;
    }

    if (current.flag_ids.length > 0) {
      payload["flag_ids"] = current.flag_ids;
    }
    if (current.setting_ids.length > 0) {
      payload["setting_ids"] = current.setting_ids;
    }
    if (current.pending_ids.length > 0) {
      payload["pending_ids"] = current.pending_ids;
    }

    return payload;
  }, []);

  const hasResourceIds =
    checkHasResourceIds(
      DEPARTMENT_RESOURCES,
      formState as unknown as Record<string, unknown>,
    ) ||
    !!formState.name ||
    !!formState.description ||
    formState.pending_ids.length > 0;

  // Per-type boolean view of flag_ids, built from the catalog. Rendered by Flags.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (department?.flags ?? [])
        .filter((f) => f.id)
        .map((f) => [f.id as string, f])
    );
    for (const id of formState.flag_ids) {
      const row = byId.get(id);
      if (!row) continue;
      const type = row.type ?? row.name;
      if (type && row.value != null) map[type] = row.value;
    }
    return map;
  }, [formState.flag_ids, department?.flags]);

  type FlagRow = NonNullable<NonNullable<typeof department>["flags"]>[number];
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, FlagRow[]>();
    for (const f of department?.flags ?? []) {
      const t = f.type ?? f.name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f);
      map.set(t, list);
    }
    return map;
  }, [department?.flags]);

  const handleFlagToggle = useCallback(
    (type: string, next: boolean | null) => {
      setFormState((prev) => {
        const rows = flagRowsByType.get(type) ?? [];
        const rowIdsForType = new Set(
          rows.map((r) => r.id).filter((id): id is string => !!id)
        );
        const retained = prev.flag_ids.filter((id) => !rowIdsForType.has(id));
        const target =
          next == null ? null : rows.find((r) => r.value === next)?.id ?? null;
        const nextIds = target ? [...retained, target] : retained;
        return { ...prev, flag_ids: nextIds };
      });
    },
    [flagRowsByType]
  );

  // --- Stable value-change handlers (extracted from inline arrows) ---
  const handleNameIdChange = useCallback((nameId: string | null) => {
    setFormState((prev) => ({ ...prev, name_id: nameId, name: null }));
  }, []);

  const handleNameChange = useCallback((name: string) => {
    setFormState((prev) => ({ ...prev, name }));
  }, []);

  const handleDescriptionIdChange = useCallback((descriptionId: string | null) => {
    setFormState((prev) => ({
      ...prev,
      description_id: descriptionId,
      description: null,
    }));
  }, []);

  const handleDescriptionChange = useCallback((description: string) => {
    setFormState((prev) => ({ ...prev, description }));
  }, []);

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // See Persona.tsx for the canonical pattern and rationale.
  type SingleField = "name_id" | "description_id";
  type MultiField = "flag_ids";

  const handleAcceptPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
        ...prev,
        [field]: pendingId,
        ...(field === "name_id" ? { name: null } : {}),
        ...(field === "description_id" ? { description: null } : {}),
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleRejectPendingField = useCallback(
    (field: SingleField, pendingId: string) => {
      setFormState((prev) => ({
        ...prev,
        [field]: prev[field] === pendingId ? null : prev[field],
        pending_ids: prev.pending_ids.filter((id) => id !== pendingId),
      }));
    },
    [],
  );

  const handleAcceptPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        // Multi-accept keeps the ids in the field array (already
        // selected). Just strip them from pending_ids so the next save
        // promotes the connections to active=true.
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

  const handleRejectPendingMulti = useCallback(
    (field: MultiField, pendingIds: string[]) => {
      const removeSet = new Set(pendingIds);
      setFormState((prev) => ({
        ...prev,
        [field]: (prev[field] as string[]).filter((id) => !removeSet.has(id)),
        pending_ids: prev.pending_ids.filter((id) => !removeSet.has(id)),
      }));
    },
    [],
  );

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
  });

  const { isGenerating, generate } = useDepartmentAi({});

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
      basic: ["names", "descriptions", "flags"],
      settings: ["settings"],
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

      const flagIds = effectiveFormState.flag_ids.length > 0
        ? effectiveFormState.flag_ids
        : null;

      if (isEditMode && departmentId && updateDepartmentAction) {
        await updateDepartmentAction({
          body: {
            departments: [
              {
                id: departmentId,
                name_id: effectiveFormState.name_id ?? undefined,
                description_id: effectiveFormState.description_id ?? undefined,
                flag_ids: flagIds,
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
                flag_ids: flagIds,
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
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      switch (stepId) {
        case "basic":
          return formState.name_id ? "completed" : "active";
        case "settings":
          if (!formState.name_id) return "pending";
          return formState.setting_ids.length > 0 ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [formState.name_id, formState.setting_ids],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the department name, description, and active status.",
        resetFields: ["name_id", "description_id", "flag_ids"],
      },
      {
        id: "settings",
        title: "Settings",
        description: "Pick which settings apply to this department.",
        resetFields: ["setting_ids"],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => ["name_id", "description_id", "flag_ids", "setting_ids"],
    [],
  );

  // Per-step reset handler — clear only the fields relevant to that step.
  const handleStepReset = useCallback(
    (stepId: string) => {
      switch (stepId) {
        case "basic":
          setFormState((prev) => ({
            ...prev,
            name_id: null,
            name: null,
            description_id: null,
            description: null,
            flag_ids: [],
          }));
          break;
        case "settings":
          setFormState((prev) => ({ ...prev, setting_ids: [] }));
          break;
        default:
          break;
      }
    },
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
                    department?.names?.find((item) => item.selected) ?? null
                  }
                  show_name={true}
                  names={department?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("name_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("name_id", pendingId)
                  }
                  placeholder="e.g., Customer Success"
                  defaultName="New Department"
                  required={true}
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              resetFields={["name_id", "description_id", "flag_ids"]}
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
              resetLabel="Reset"
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
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("description_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("description_id", pendingId)
                  }
                  required={false}
                  isAutosaveEnabled={isAutosaveEnabled}
                />

                <Flags
                  flags={department?.flags ?? []}
                  values={flagValues}
                  show_flags={(department?.flags?.length ?? 0) > 0}
                  columns={1}
                  label="Flags"
                  disabled={disabled}
                  onChange={handleFlagToggle}
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("flag_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("flag_ids", pendingIds)
                  }
                />
              </div>
            </StepCard>
          );

        case "settings":
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={["setting_ids"]}
              actions={
                stableDepartmentData?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="settings"
                    resourceTypes={(stepResources["settings"] ?? []) as string[]}
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
              <Settings
                settings_ids={formState.setting_ids}
                settings={department?.settings ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, setting_ids: ids }))
                }
                required={false}
              />
            </StepCard>
          );

        default:
          return null;
      }
    },
    [
      department?.descriptions,
      department?.flags,
      department?.names,
      department?.settings,
      disabled,
      flagValues,
      formState.description_id,
      formState.name_id,
      formState.setting_ids,
      handleDirectStepGenerate,
      handleFlagToggle,
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
          resetSuccessMessage={(stepId) =>
            stepId === "settings" ? "Settings reset" : "Basic information reset"
          }
          onReset={handleStepReset}
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
