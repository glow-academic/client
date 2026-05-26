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
import { ConditionalParameters } from "@/components/resources/ConditionalParameters";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { Names } from "@/components/resources/Names";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useDrafts } from "@/contexts/draft-context";
import { useFieldAi } from "@/hooks/use-field-ai";
import { useDraftLifecycle } from "@/hooks/use-draft-lifecycle";
import type { InputOf, OutputOf } from "@/lib/api/types";
import {
  checkHasResourceIds,
  type ResourceConfig,
} from "@/lib/resources/action-builders";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

type CreateFieldIn = InputOf<"/field/create", "post">;
type CreateFieldOut = OutputOf<"/field/create", "post">;
type UpdateFieldIn = InputOf<"/field/update", "post">;
type UpdateFieldOut = OutputOf<"/field/update", "post">;
type PatchFieldDraftIn = InputOf<"/field/draft", "post">;
type PatchFieldDraftOut = OutputOf<"/field/draft", "post">;

type FieldData = OutputOf<"/field/get", "post">;

type FieldResourceType =
  | "names"
  | "descriptions"
  | "flags"
  | "departments"
  | "conditional_parameters";

type FieldFormState = {
  name_id: string | null;
  name: string | null;
  description_id: string | null;
  description: string | null;
  flag_ids: string[];
  department_ids: string[];
  conditional_parameter_ids: string[];
  pending_ids: string[];
};

const VALID_RESOURCE_TYPES: FieldResourceType[] = [
  "names",
  "descriptions",
  "flags",
  "departments",
  "conditional_parameters",
];

const FIELD_RESOURCES: ResourceConfig[] = [
  { key: "names", formKey: "name_id", flushKey: "name_id", type: "single" },
  {
    key: "descriptions",
    formKey: "description_id",
    flushKey: "description_id",
    type: "single",
  },
  { key: "flags", formKey: "flag_ids", flushKey: null, type: "multi" },
  {
    key: "departments",
    formKey: "department_ids",
    flushKey: "department_ids",
    type: "multi",
  },
  {
    key: "conditional_parameters",
    formKey: "conditional_parameter_ids",
    flushKey: "conditional_parameter_ids",
    type: "multi",
  },
];

export interface FieldProps {
  fieldId?: string;
  mode?: "create" | "edit";
  fieldData?: FieldData;
  createFieldAction?: (input: CreateFieldIn) => Promise<CreateFieldOut>;
  updateFieldAction?: (input: UpdateFieldIn) => Promise<UpdateFieldOut>;
  patchFieldDraftAction?: (
    input: PatchFieldDraftIn,
  ) => Promise<PatchFieldDraftOut>;
}

function FieldComponent({
  fieldId,
  mode = fieldId ? "edit" : "create",
  fieldData,
  createFieldAction,
  updateFieldAction,
  patchFieldDraftAction,
}: FieldProps) {
  const router = useRouter();
  const isEditMode = mode === "edit" && !!fieldId;
  const { profile } = useProfile();
  const { isAutosaveEnabled, setSelectedDraftId } = useDrafts();
  const emptyFlushRegistryRef = useRef<
    Map<string, () => Promise<Record<string, unknown> | void>>
  >(new Map());

  const fieldDataRef = useRef(fieldData);
  useEffect(() => {
    fieldDataRef.current = fieldData;
  }, [fieldData]);

  const stableFieldData = useMemo(() => {
    if (!fieldData) return null;
    return {
      names: fieldData.names,
      descriptions: fieldData.descriptions,
      flags: fieldData.flags,
      departments: fieldData.departments,
      conditional_parameters: fieldData.conditional_parameters,
      basic_show_ai_generate: fieldData.basic_show_ai_generate ?? false,
      show_ai_generate: fieldData.show_ai_generate ?? false,
      group_id: fieldData.group_id,
    };
  }, [
    fieldData?.names,
    fieldData?.descriptions,
    fieldData?.flags,
    fieldData?.departments,
    fieldData?.conditional_parameters,
    fieldData?.basic_show_ai_generate,
    fieldData?.show_ai_generate,
    fieldData?.group_id,
  ]);

  const getInitialFormState = useCallback((): FieldFormState => {
    const data = fieldDataRef.current;
    if (!data) {
      return {
        name_id: null,
        name: null,
        description_id: null,
        description: null,
        flag_ids: [],
        department_ids: [],
        conditional_parameter_ids: [],
        pending_ids: [],
      };
    }

    return {
      name_id: data.names?.find((item) => item.selected)?.id ?? null,
      name: null,
      description_id: data.descriptions?.find((item) => item.selected)?.id ?? null,
      description: null,
      flag_ids: (data.flags?.filter((item) => item.selected) ?? [])
        .map((item) => item.id)
        .filter((id): id is string => !!id),
      department_ids:
        (data.departments?.filter((item) => item.selected) ?? [])
          .map((item) => item.department_id)
          .filter((id): id is string => !!id),
      conditional_parameter_ids:
        (data.conditional_parameters?.filter((item) => item.selected) ?? [])
          .map((item) => item.parameter_id)
          .filter((id): id is string => !!id),
      pending_ids:
        data.pending_ids?.filter((id): id is string => !!id) ?? [],
    };
  }, []);

  const [formState, setFormState] = useState<FieldFormState>(getInitialFormState);

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
    if (!patchFieldDraftAction) {
      patchActionRef.current = undefined;
      return;
    }

    patchActionRef.current = async (payload: Record<string, unknown>) => {
      const result = await patchFieldDraftAction({
        body: payload,
      } as PatchFieldDraftIn);

      const formStateFromServer = result?.form_state as
        | {
            name_id?: string | null;
            description_id?: string | null;
            flag_ids?: string[] | null;
            department_ids?: string[] | null;
            conditional_parameter_ids?: string[] | null;
            pending_ids?: string[] | null;
          }
        | undefined;
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
            department_ids:
              formStateFromServer.department_ids ?? prev.department_ids,
            conditional_parameter_ids:
              formStateFromServer.conditional_parameter_ids ??
              prev.conditional_parameter_ids,
            pending_ids: formStateFromServer.pending_ids ?? prev.pending_ids,
          };
          // Only set the server-sync absorb flag when state actually changes.
          // (Same fix as Persona / Parameter / Profile.)
          const changed =
            prev.name_id !== next.name_id ||
            prev.name !== next.name ||
            prev.description_id !== next.description_id ||
            prev.description !== next.description ||
            JSON.stringify(prev.flag_ids) !== JSON.stringify(next.flag_ids) ||
            JSON.stringify(prev.department_ids) !== JSON.stringify(next.department_ids) ||
            JSON.stringify(prev.conditional_parameter_ids) !== JSON.stringify(next.conditional_parameter_ids) ||
            JSON.stringify(prev.pending_ids) !== JSON.stringify(next.pending_ids);
          if (!changed) return prev;
          serverSyncPendingRef.current = true;
          return next;
        });
      }

      return result;
    };
  }, [patchFieldDraftAction]);

  const formStateKey = useMemo(() => JSON.stringify(formState), [formState]);

  const buildPatchPayload = useCallback((): Record<string, unknown> => {
    const current = formStateRef.current as unknown as FieldFormState;
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
    if (current.department_ids.length > 0) {
      payload["department_ids"] = current.department_ids;
    }
    if (current.conditional_parameter_ids.length > 0) {
      payload["conditional_parameter_ids"] = current.conditional_parameter_ids;
    }
    if (current.pending_ids.length > 0) {
      payload["pending_ids"] = current.pending_ids;
    }

    return payload;
  }, []);

  const hasResourceIds =
    checkHasResourceIds(
      FIELD_RESOURCES,
      formState as unknown as Record<string, unknown>,
    ) ||
    !!formState.name ||
    !!formState.description ||
    formState.pending_ids.length > 0;

  // Per-type boolean view of flag_ids, built from the catalog. Rendered by Flags.
  const flagValues = useMemo<Record<string, boolean | null>>(() => {
    const map: Record<string, boolean | null> = {};
    const byId = new Map(
      (fieldData?.flags ?? [])
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
  }, [formState.flag_ids, fieldData?.flags]);

  type FieldFlagRow = NonNullable<NonNullable<typeof fieldData>["flags"]>[number];
  const flagRowsByType = useMemo(() => {
    const map = new Map<string, FieldFlagRow[]>();
    for (const f of fieldData?.flags ?? []) {
      const t = f.type ?? f.name;
      if (!t) continue;
      const list = map.get(t) ?? [];
      list.push(f);
      map.set(t, list);
    }
    return map;
  }, [fieldData?.flags]);

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

  // ─── Per-field pending lifecycle ──────────────────────────────────
  // Mirrors the canonical persona pattern: inline ✓ / ✗ on a pending
  // diff resolves the id, removes it from ``pending_ids`` so the next
  // autosave promotes (accept) or drops (reject) the connection.
  type SingleField = "name_id" | "description_id";
  type MultiField =
    | "flag_ids"
    | "department_ids"
    | "conditional_parameter_ids";

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
    (_field: MultiField, pendingIds: string[]) => {
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

  const { isGenerating, generate } = useFieldAi({});

  const handleGenerateResources = useCallback(
    async (resourceTypes: FieldResourceType[], userInstructions?: string) => {
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
        artifact_id: fieldId || null,
        user_instructions: userInstructions ? [userInstructions] : null,
      });
    },
    [fieldId, flushAllAndSave, formDataRef, generate],
  );

  const canRegenerate = useCallback(
    (resourceType: FieldResourceType) => {
      if (!stableFieldData) return false;
      switch (resourceType) {
        case "names":
          return (
            stableFieldData.names?.find((item) => item.selected)?.generated ?? false
          );
        case "descriptions":
          return (
            stableFieldData.descriptions?.find((item) => item.selected)
              ?.generated ?? false
          );
        case "flags":
          return (
            stableFieldData.flags?.filter((item) => item.selected).some(
              (item) => item.generated,
            ) ?? false
          );
        case "departments":
          return (
            stableFieldData.departments?.filter((item) => item.selected).some(
              (item) => item.generated,
            ) ?? false
          );
        case "conditional_parameters":
          return (
            stableFieldData.conditional_parameters
              ?.filter((item) => item.selected)
              .some((item) => item.generated) ?? false
          );
      }
    },
    [stableFieldData],
  );

  const canRegenerateForStepCard = useCallback(
    (resourceType: string) => canRegenerate(resourceType as FieldResourceType),
    [canRegenerate],
  );
  const isGeneratingForStepCard = useCallback(
    (resourceType: string) => isGenerating(resourceType as FieldResourceType),
    [isGenerating],
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

  const disabled = useMemo(() => fieldData?.can_edit === false, [fieldData?.can_edit]);

  const handleSubmit = useCallback(async () => {
    const current = formStateRef.current as unknown as FieldFormState;

    if (!current.name_id && !current.name?.trim()) {
      toast.error("Field name is required");
      throw new Error("Field name is required");
    }

    if (!profile?.id) {
      toast.error("Profile not loaded. Please refresh the page.");
      throw new Error("Profile not loaded");
    }

    const flagIds = current.flag_ids.length > 0 ? current.flag_ids : null;

    if (isEditMode && fieldId) {
      if (!updateFieldAction) {
        toast.error("Update action not available");
        throw new Error("Update action not available");
      }
      await updateFieldAction({
        body: {
          fields: [
            {
              id: fieldId,
              ...(current.name_id ? { name_id: current.name_id } : {}),
              ...(current.name ? { name: current.name } : {}),
              ...(current.description_id
                ? { description_id: current.description_id }
                : {}),
              ...(current.description ? { description: current.description } : {}),
              ...(flagIds ? { flag_ids: flagIds } : {}),
              ...(current.department_ids.length > 0
                ? { department_ids: current.department_ids }
                : {}),
              ...(current.conditional_parameter_ids.length > 0
                ? { conditional_parameter_ids: current.conditional_parameter_ids }
                : {}),
            },
          ],
        },
      } as UpdateFieldIn);
    } else {
      if (!createFieldAction) {
        toast.error("Create action not available");
        throw new Error("Create action not available");
      }
      await createFieldAction({
        body: {
          fields: [
            {
              ...(current.name_id ? { name_id: current.name_id } : {}),
              ...(current.name ? { name: current.name } : {}),
              ...(current.description_id
                ? { description_id: current.description_id }
                : {}),
              ...(current.description ? { description: current.description } : {}),
              ...(flagIds ? { flag_ids: flagIds } : {}),
              ...(current.department_ids.length > 0
                ? { department_ids: current.department_ids }
                : {}),
              ...(current.conditional_parameter_ids.length > 0
                ? { conditional_parameter_ids: current.conditional_parameter_ids }
                : {}),
            },
          ],
        },
      } as CreateFieldIn);
    }

    toast.success(`Field ${isEditMode ? "updated" : "created"} successfully`);
    router.push("/management/fields");
  }, [
    createFieldAction,
    fieldId,
    isEditMode,
    profile?.id,
    router,
    updateFieldAction,
  ]);

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formState.name_id || !!formState.name?.trim();

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "conditional":
          if (!hasName) return "pending";
          return formState.conditional_parameter_ids.length > 0
            ? "completed"
            : "active";
        default:
          return "pending";
      }
    },
    [formState.conditional_parameter_ids.length, formState.name, formState.name_id],
  );

  const stepResources: Record<string, FieldResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments"],
      conditional: ["conditional_parameters"],
      all: VALID_RESOURCE_TYPES,
    }),
    [],
  );

  const handleDirectStepGenerate = useCallback(
    (stepId: string, _mode: "generate" | "regenerate") => {
      const resources = stepResources[stepId];
      if (resources) {
        void handleGenerateResources(resources);
      }
    },
    [handleGenerateResources, stepResources],
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the field name, description, departments, and active status.",
        resetFields: ["name_id", "description_id", "flag_ids", "department_ids"],
      },
      {
        id: "conditional",
        title: "Conditional Parameters",
        description: "Choose parameters shown when this field is selected.",
        resetFields: [
          "conditional_parameter_ids",
          "conditionalParameterSearch",
          "conditionalParameterShowSelected",
        ],
      },
    ],
    [],
  );

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "flag_ids",
      "department_ids",
      "conditional_parameter_ids",
      "pending_ids",
    ],
    [],
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "conditional":
        return "Conditional parameters reset";
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
            flag_ids: [],
            department_ids: [],
          };
        case "conditional":
          return {
            ...prev,
            conditional_parameter_ids: [],
          };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/management/fields",
      backLabel: "Back",
      createLabel: "Create Field",
      updateLabel: "Update Field",
    }),
    [],
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
          const descriptionSearch =
            (formData["descriptionSearch"] as string | null | undefined) || "";

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
                  name_resource={fieldData?.names?.find((item) => item.selected) ?? null}
                  show_name={true}
                  names={fieldData?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("name_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("name_id", pendingId)
                  }
                  placeholder="e.g., Learning Style"
                  defaultName="New Field"
                  required={true}
                  hideDescription={true}
                  isAutosaveEnabled={isAutosaveEnabled}
                />
              }
              resetFields={["name_id", "description_id", "flag_ids", "department_ids"]}
              actions={
                stepResources["basic"]?.length &&
                fieldData?.basic_show_ai_generate ? (
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
                    fieldData?.descriptions?.find((item) => item.selected) ?? null
                  }
                  show_description={true}
                  descriptions={fieldData?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                  onAcceptPending={(pendingId) =>
                    handleAcceptPendingField("description_id", pendingId)
                  }
                  onRejectPending={(pendingId) =>
                    handleRejectPendingField("description_id", pendingId)
                  }
                  label="Description"
                  placeholder="Enter a brief description (optional)"
                  required={false}
                  rows={3}
                  searchTerm={descriptionSearch}
                  onSearchChange={(term) =>
                    setFormData({ descriptionSearch: term || null })
                  }
                  isAutosaveEnabled={isAutosaveEnabled}
                />

                <Departments
                  department_ids={formState.department_ids}
                  department_resources={
                    fieldData?.departments?.filter((item) => item.selected) ?? []
                  }
                  show_departments={true}
                  departments={fieldData?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onAcceptPending={(pendingIds) =>
                    handleAcceptPendingMulti("department_ids", pendingIds)
                  }
                  onRejectPending={(pendingIds) =>
                    handleRejectPendingMulti("department_ids", pendingIds)
                  }
                  required={false}
                />

                <Flags
                  flags={fieldData?.flags ?? []}
                  values={flagValues}
                  show_flags={true}
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
        }

        case "conditional": {
          const conditionalParameterSearch =
            (formData["conditionalParameterSearch"] as string | null | undefined) ||
            "";
          const conditionalParameterShowSelected =
            (formData["conditionalParameterShowSelected"] as boolean | null | undefined) ??
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
              onSearchChange={(term) =>
                setFormData({ conditionalParameterSearch: term || null })
              }
              searchPlaceholder="Search conditional parameters..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: conditionalParameterShowSelected,
                  onChange: (value: boolean) =>
                    setFormData({ conditionalParameterShowSelected: value || null }),
                },
              ]}
              resetFields={[
                "conditional_parameter_ids",
                "conditionalParameterSearch",
                "conditionalParameterShowSelected",
              ]}
              actions={
                stepResources["conditional"]?.length &&
                fieldData?.show_ai_generate ? (
                  <StepCardAiButton
                    stepId="conditional"
                    resourceTypes={stepResources["conditional"]}
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
              <ConditionalParameters
                conditional_parameter_ids={formState.conditional_parameter_ids}
                conditional_parameter_resources={
                  fieldData?.conditional_parameters?.filter((item) => item.selected) ?? []
                }
                show_conditional_parameters={true}
                conditional_parameters={fieldData?.conditional_parameters ?? []}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({
                    ...prev,
                    conditional_parameter_ids: ids,
                  }))
                }
                onAcceptPending={(pendingIds) =>
                  handleAcceptPendingMulti("conditional_parameter_ids", pendingIds)
                }
                onRejectPending={(pendingIds) =>
                  handleRejectPendingMulti("conditional_parameter_ids", pendingIds)
                }
              />
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      canRegenerateForStepCard,
      disabled,
      fieldData?.basic_show_ai_generate,
      fieldData?.conditional_parameters,
      fieldData?.departments,
      fieldData?.descriptions,
      fieldData?.flags,
      fieldData?.names,
      fieldData?.show_ai_generate,
      flagValues,
      handleFlagToggle,
      formState.conditional_parameter_ids,
      formState.department_ids,
      formState.description_id,
      formState.name_id,
      handleDirectStepGenerate,
      handleGenerateResources,
      isAutosaveEnabled,
      isEditMode,
      isGeneratingForStepCard,
      stepResources,
    ],
  );

  const handleFormDataChange = useCallback(
    (fd: Record<string, unknown>) => {
      onFormDataChange(fd);
      setFormState((prev) => ({
        ...prev,
        name_id: (fd["name_id"] as string | undefined) ?? prev.name_id,
        description_id:
          (fd["description_id"] as string | undefined) ?? prev.description_id,
        flag_ids: (fd["flag_ids"] as string[] | undefined) ?? prev.flag_ids,
        department_ids:
          (fd["department_ids"] as string[] | undefined) ?? prev.department_ids,
        conditional_parameter_ids:
          (fd["conditional_parameter_ids"] as string[] | undefined) ??
          prev.conditional_parameter_ids,
        pending_ids:
          (fd["pending_ids"] as string[] | undefined) ?? prev.pending_ids,
      }));
    },
    [onFormDataChange],
  );

  return (
    <TooltipProvider>
      <div className="w-full space-y-8 p-6" data-page={`field-${isEditMode ? "edit" : "new"}`}>
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
          formFieldKeys={formFieldKeys}
          onReset={handleReset}
          resetSuccessMessage={resetSuccessMessage}
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
