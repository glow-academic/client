/**
 * Eval.tsx
 * Resource-first Eval artifact component
 * Uses modular resource components and GenericForm pattern
 */
"use client";

import { useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { StepCard } from "@/components/common/forms/StepCard";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { StepCardAiButton } from "@/components/common/forms/StepCardAiButton";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { ModelFlags } from "@/components/resources/ModelFlags";
import { ModelPositions } from "@/components/resources/ModelPositions";
import { ModelRubrics } from "@/components/resources/ModelRubrics";
import { Models } from "@/components/resources/Models";
import { Names } from "@/components/resources/Names";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDrafts } from "@/contexts/draft-context";
import { useProfile } from "@/contexts/profile-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
// Eval endpoints
type CreateEvalIn = InputOf<"/eval/create", "post">;
type CreateEvalOut = OutputOf<"/eval/create", "post">;
type UpdateEvalIn = InputOf<"/eval/update", "post">;
type UpdateEvalOut = OutputOf<"/eval/update", "post">;
type PatchEvalDraftIn = InputOf<"/eval/draft", "patch">;
type PatchEvalDraftOut = OutputOf<"/eval/draft", "patch">;
type EvalData = OutputOf<"/eval/get", "post">;

type EvalNameItem = {
  id?: string | null;
  name?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalDescriptionItem = {
  id?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalFlagItem = {
  key: string;
  label: string;
  description?: string | null;
  icon_id?: string | null;
  flag_option_id?: string | null;
  show?: boolean;
  required?: boolean;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalDepartmentItem = {
  department_id?: string | null;
  name?: string | null;
  description?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalModelItem = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  modality_ids?: string[] | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalModelFlagItem = {
  id?: string | null;
  model_id?: string | null;
  flag_id?: string | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalModelPositionItem = {
  id?: string | null;
  model_id?: string | null;
  value?: number | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};

type EvalModelRubricItem = {
  id?: string | null;
  model_id?: string | null;
  rubric_id?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  selected?: boolean | null;
  pending?: boolean | null;
};


type EvalDraftFormState = {
  name_id?: string | null;
  name?: string | null;
  description_id?: string | null;
  description?: string | null;
  flag_ids?: string[] | null;
  department_ids?: string[] | null;
  model_ids?: string[] | null;
  pending_ids?: string[] | null;
};

export interface EvalProps {
  evalId?: string;
  // Server-provided data (for server-side rendering)
  evalDetail?: EvalData;
  evalDetailDefault?: EvalData;
  // Server actions
  createEvalAction?: (input: CreateEvalIn) => Promise<CreateEvalOut>;
  updateEvalAction?: (input: UpdateEvalIn) => Promise<UpdateEvalOut>;
  patchEvalDraftAction?: (
    input: PatchEvalDraftIn
  ) => Promise<PatchEvalDraftOut>;
}

type EvalResourceType =
  | ResourceType
  | "models"
  | "model_flags"
  | "model_positions"
  | "model_rubrics";

interface EvalFormState {
  name: string | null;
  name_id: string | null;
  description: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  dynamic_flag_id: string | null;
  groups_flag_id: string | null;
  department_ids: string[];
  model_ids: string[];
  model_flag_ids: string[];
  model_position_ids: string[];
  model_rubric_ids: string[];
  // Value fields for multi-select creatables (merged with IDs by draft endpoint)
  model_flags: Array<{ model_id: string; flag_id: string }> | null;
  model_positions: Array<{ model_id: string; value: number }> | null;
  model_rubrics: Array<{ model_id: string; rubric_id: string }> | null;
  pending_ids: string[];
}

function EvalComponent({
  evalId,
  evalDetail,
  evalDetailDefault,
  createEvalAction,
  updateEvalAction,
  patchEvalDraftAction,
}: EvalProps) {
  const router = useRouter();
  const isEditMode = !!evalId;
  const { profile } = useProfile();
  const { selectedDraftId, setSelectedDraftId } = useDrafts();
  const evalData = (isEditMode ? evalDetail : evalDetailDefault) as
    | EvalData
    | undefined;
  const s = useMemo(() => {
    if (!evalData) return null;
    return {
      names: evalData.names,
      descriptions: evalData.descriptions,
      flags: evalData.flags,
      departments: evalData.departments,
      models: evalData.models,
      model_flags: evalData.model_flags,
      model_rubrics: evalData.model_rubrics,
      model_positions: evalData.model_positions,
      basic_show_ai_generate: evalData.basic_show_ai_generate,
      model_show_ai_generate: evalData.model_show_ai_generate,
      group_id: evalData.group_id,
      can_edit: evalData.can_edit,
      disabled_reason: evalData.disabled_reason,
      pending_ids: evalData.pending_ids,
    };
  }, [evalData]);

  // Generation state for AI workflows
  const VALID_EVAL_RESOURCE_TYPES: EvalResourceType[] = [
    "names", "descriptions", "flags", "departments", "models",
    "model_flags", "model_positions", "model_rubrics",
  ];
  const { isGenerating, makeOnGenerationComplete, generate } =
    useArtifactAi({
      artifactType: "eval",
      validResourceTypes: VALID_EVAL_RESOURCE_TYPES,
    });

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const evalSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      modelSearch: parseAsString,
      modelShowSelected: parseAsBoolean,
    }),
    []
  );

  // Local form state (not in URL) - stores only resource IDs
  const evalDataRef = useRef(evalData);
  useEffect(() => {
    evalDataRef.current = evalData;
  }, [evalData]);

  const getInitialFormState = useCallback((): EvalFormState => {
    const data = evalDataRef.current;
    const selectedFlags = data?.flags?.filter((flag) => flag.selected) ?? [];
    const flagIdForKey = (key: string) =>
      selectedFlags.find((flag) => flag.key === key)?.flag_option_id ?? null;
    return {
      name: null,
      name_id: data?.names?.find((item) => item.selected)?.id ?? null,
      description: null,
      description_id:
        data?.descriptions?.find((item) => item.selected)?.id ?? null,
      active_flag_id: flagIdForKey("active"),
      dynamic_flag_id: flagIdForKey("dynamic"),
      groups_flag_id: flagIdForKey("groups"),
      department_ids:
        (data?.departments ?? [])
          .filter((d) => d.selected)
          ?.map((d) => d.department_id)
          .filter(Boolean)
          .map(String) ?? [],
      model_ids:
        (data?.models ?? [])
          .filter((m) => m.selected)
          ?.map((m) => m.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_flag_ids:
        (data?.model_flags ?? [])
          .filter((f) => f.selected)
          ?.map((f) => f.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_position_ids:
        (data?.model_positions ?? [])
          .filter((p) => p.selected)
          ?.map((p) => p.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_rubric_ids:
        (data?.model_rubrics ?? [])
          .filter((r) => r.selected)
          ?.map((r) => r.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_flags: null,
      model_positions: null,
      model_rubrics: null,
      pending_ids: data?.pending_ids?.filter(Boolean).map(String) ?? [],
    };
  }, []);

  const [formState, setFormState] =
    useState<EvalFormState>(getInitialFormState);

  const departmentIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.departments ?? [])
          .filter((d) => d.selected)
          ?.map((d) => d.department_id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.departments]
  );
  const modelIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.models ?? [])
          .filter((m) => m.selected)
          ?.map((m) => m.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.models]
  );
  const modelFlagIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.model_flags ?? [])
          .filter((f) => f.selected)
          ?.map((f) => f.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.model_flags]
  );
  const modelPositionIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.model_positions ?? [])
          .filter((p) => p.selected)
          ?.map((p) => p.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.model_positions]
  );
  const modelRubricIdsStr = useMemo(
    () =>
      JSON.stringify(
        (s?.model_rubrics ?? [])
          .filter((r) => r.selected)
          ?.map((r) => r.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.model_rubrics]
  );

  // Sync form state when server data changes
  useEffect(() => {
    const nextState = getInitialFormState();
    setFormState((prev) => {
      if (
        prev.name_id !== nextState.name_id ||
        prev.description_id !== nextState.description_id ||
        prev.active_flag_id !== nextState.active_flag_id ||
        prev.dynamic_flag_id !== nextState.dynamic_flag_id ||
        prev.groups_flag_id !== nextState.groups_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(nextState.department_ids) ||
        JSON.stringify(prev.model_ids) !==
          JSON.stringify(nextState.model_ids) ||
        JSON.stringify(prev.model_flag_ids) !==
          JSON.stringify(nextState.model_flag_ids) ||
        JSON.stringify(prev.model_position_ids) !==
          JSON.stringify(nextState.model_position_ids) ||
        JSON.stringify(prev.model_rubric_ids) !==
          JSON.stringify(nextState.model_rubric_ids)
      ) {
        return nextState;
      }
      return prev;
    });
  }, [
    s?.names,
    s?.descriptions,
    s?.flags,
    departmentIdsStr,
    modelIdsStr,
    modelFlagIdsStr,
    modelPositionIdsStr,
    modelRubricIdsStr,
    getInitialFormState,
  ]);

  // URL-backed form data bridge
  const [draftId, setDraftId] = useState<string | null>(null);
  const setUrlFormDataRef = useRef<
    null | ((updates: Record<string, unknown>) => void)
  >(null);
  const formDataRef = useRef<Record<string, unknown>>({});

  const onFormDataChange = useCallback((fd: Record<string, unknown>) => {
    formDataRef.current = fd;
    const next = (fd["draftId"] as string | undefined) ?? null;
    setDraftId((prev) => (prev === next ? prev : next));
  }, []);

  // Sync URL draftId to profile context
  useEffect(() => {
    if (draftId !== selectedDraftId) {
      setSelectedDraftId(draftId);
    }
  }, [draftId, selectedDraftId, setSelectedDraftId]);

  // Draft patching
  const patchEvalDraftActionRef = useRef(patchEvalDraftAction);
  useEffect(() => {
    patchEvalDraftActionRef.current = patchEvalDraftAction;
  }, [patchEvalDraftAction]);

  const serverSyncPendingRef = useRef(false);

  const draftPatchKey = useMemo(() => {
    if (serverSyncPendingRef.current) return null;
    return JSON.stringify({
      name: formState.name,
      name_id: formState.name_id,
      description: formState.description,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
      dynamic_flag_id: formState.dynamic_flag_id,
      groups_flag_id: formState.groups_flag_id,
      department_ids: formState.department_ids,
      model_ids: formState.model_ids,
      pending_ids: formState.pending_ids,
    });
  }, [formState]);

  const lastPatchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const hasResourceIds =
      formState.name_id ||
      formState.description_id ||
      formState.active_flag_id ||
      formState.dynamic_flag_id ||
      formState.groups_flag_id ||
      formState.department_ids.length > 0 ||
      formState.model_ids.length > 0 ||
      formState.model_flag_ids.length > 0 ||
      formState.model_position_ids.length > 0 ||
      formState.model_rubric_ids.length > 0;

    if (!hasResourceIds || !patchEvalDraftActionRef.current) {
      return;
    }

    if (lastPatchedKeyRef.current === draftPatchKey) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!patchEvalDraftActionRef.current) return;
        const flagIds = [
          formState.active_flag_id,
          formState.dynamic_flag_id,
          formState.groups_flag_id,
        ].filter(Boolean) as string[];

        // Build payload with value field overlay
        const payload: Record<string, unknown> = {
          draft_id: draftId || null,
          flag_ids: flagIds.length > 0 ? flagIds : null,
          department_ids: formState.department_ids.length > 0 ? formState.department_ids : null,
          model_ids: formState.model_ids.length > 0 ? formState.model_ids : null,
          pending_ids: formState.pending_ids.length > 0 ? formState.pending_ids : null,
        };
        if (formState.name) {
          payload["name"] = formState.name;
        } else {
          payload["name_id"] = formState.name_id;
        }
        if (formState.description) {
          payload["description"] = formState.description;
        } else {
          payload["description_id"] = formState.description_id;
        }

        const result = await patchEvalDraftActionRef.current({
          body: payload,
        } as PatchEvalDraftIn);

        lastPatchedKeyRef.current = draftPatchKey;

        // Sync form_state from server response
        const serverFormState = result.form_state as EvalDraftFormState | null | undefined;
        if (serverFormState) {
          const serverFlagIds = serverFormState.flag_ids ?? [];
          const flagLookup = new Map(
            (s?.flags ?? [])
              .filter((flag) => flag.flag_option_id)
              .map((flag) => [flag.flag_option_id as string, flag.key]),
          );
          const nextFlagId = (key: string) =>
            serverFlagIds.find((flagId) => flagLookup.get(flagId) === key) ?? null;

          serverSyncPendingRef.current = true;
          setFormState((prev) => {
            const nextNameId =
              (serverFormState.name_id as string | null | undefined) ?? prev.name_id;
            const nextDescriptionId =
              (serverFormState.description_id as string | null | undefined) ??
              prev.description_id;
            return {
              ...prev,
              name_id: nextNameId,
              // Clear value fields only once the server has resolved them to
              // IDs — keeping the value would cause infinite re-saves (value
              // takes precedence → new resource → new id → repeat).
              name: nextNameId ? null : prev.name,
              description_id: nextDescriptionId,
              description: nextDescriptionId ? null : prev.description,
              active_flag_id: nextFlagId("active"),
              dynamic_flag_id: nextFlagId("dynamic"),
              groups_flag_id: nextFlagId("groups"),
              department_ids:
                (serverFormState.department_ids as string[] | null | undefined) ??
                prev.department_ids,
              model_ids:
                (serverFormState.model_ids as string[] | null | undefined) ??
                prev.model_ids,
              pending_ids:
                (serverFormState.pending_ids as string[] | null | undefined) ??
                prev.pending_ids,
            };
          });
          requestAnimationFrame(() => {
            serverSyncPendingRef.current = false;
          });
        }

        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

      } catch {
        // Draft patch failed - leave lastPatchedKeyRef unchanged
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftPatchKey, draftId, formState, s]);

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

  // Readonly logic using server-provided can_edit flag
  const disabled = useMemo(() => {
    if (!s) return false;
    return !s.can_edit;
  }, [s]);

  // Resource regeneration check
  const canRegenerate = useCallback(
    (resourceType: EvalResourceType): boolean => {
      if (!s) return false;
      switch (resourceType) {
        case "names":
          return s.names?.find((item) => item.selected)?.generated ?? false;
        case "descriptions":
          return s.descriptions?.find((item) => item.selected)?.generated ?? false;
        case "flags":
          return s.flags?.some((flag) => flag.selected && flag.generated) ?? false;
        case "departments":
          return s.departments?.some((d) => d.selected && d.generated) ?? false;
        case "models":
          return s.models?.some((m) => m.selected && m.generated) ?? false;
        case "model_flags":
          return s.model_flags?.some((f) => f.selected && f.generated) ?? false;
        case "model_positions":
          return s.model_positions?.some((p) => p.selected && p.generated) ?? false;
        case "model_rubrics":
          return s.model_rubrics?.some((r) => r.selected && r.generated) ?? false;
        default:
          return false;
      }
    },
    [s]
  );

  // Step-to-resources mapping for multi-generation
  const stepResources: Record<string, EvalResourceType[]> = useMemo(
    () => ({
      basic: ["names", "descriptions", "flags", "departments"],
      models: [
        "models",
        "model_flags",
        "model_positions",
        "model_rubrics",
      ],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "models",
        "model_flags",
        "model_positions",
        "model_rubrics",
      ],
    }),
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: EvalResourceType[],
      userInstructions?: string
    ) => {
      const formData = formDataRef.current;
      const draftId = (formData["draftId"] as string | undefined) ?? null;

      generate(resourceTypes, {
        user_instructions: userInstructions ? [userInstructions] : null,
        draft_id: draftId || null,
      });
    },
    [generate]
  );

  // Individual generation handlers
  const handleGenerateModels = useCallback(
    async () => handleGenerateResources(["models"]),
    [handleGenerateResources]
  );

  const handleGenerateModelFlags = useCallback(
    async () => handleGenerateResources(["model_flags"]),
    [handleGenerateResources]
  );

  const handleGenerateModelPositions = useCallback(
    async () => handleGenerateResources(["model_positions"]),
    [handleGenerateResources]
  );

  const handleGenerateModelRubrics = useCallback(
    async () => handleGenerateResources(["model_rubrics"]),
    [handleGenerateResources]
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

  // Submit handler
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      if (!formState.name_id) {
        toast.error("Name is required");
        throw new Error("Name is required");
      }

      const saveFlagIds = [
        formState.active_flag_id,
        formState.dynamic_flag_id,
        formState.groups_flag_id,
      ].filter(Boolean) as string[];

      try {
        if (isEditMode) {
          if (!updateEvalAction) throw new Error("Update action not available");
          await updateEvalAction({
            body: {
              evals: [
                {
                  eval_id: evalId!,
                  name_id: formState.name_id ?? undefined,
                  description_id: formState.description_id ?? undefined,
                  flag_ids: saveFlagIds.length > 0 ? saveFlagIds : undefined,
                  department_ids: formState.department_ids.length > 0 ? formState.department_ids : undefined,
                  model_ids: formState.model_ids.length > 0 ? formState.model_ids : undefined,
                  model_flag_ids: formState.model_flag_ids.length > 0 ? formState.model_flag_ids : undefined,
                  model_rubric_ids: formState.model_rubric_ids.length > 0 ? formState.model_rubric_ids : undefined,
                  model_position_ids: formState.model_position_ids.length > 0 ? formState.model_position_ids : undefined,
                },
              ],
              group_id: s?.group_id,
            },
          } as UpdateEvalIn);
        } else {
          if (!createEvalAction) throw new Error("Create action not available");
          await createEvalAction({
            body: {
              evals: [
                {
                  name_id: formState.name_id!,
                  description_id: formState.description_id ?? undefined,
                  flag_ids: saveFlagIds.length > 0 ? saveFlagIds : undefined,
                  department_ids: formState.department_ids.length > 0 ? formState.department_ids : undefined,
                  model_ids: formState.model_ids.length > 0 ? formState.model_ids : undefined,
                  model_flag_ids: formState.model_flag_ids.length > 0 ? formState.model_flag_ids : undefined,
                  model_rubric_ids: formState.model_rubric_ids.length > 0 ? formState.model_rubric_ids : undefined,
                  model_position_ids: formState.model_position_ids.length > 0 ? formState.model_position_ids : undefined,
                },
              ],
              group_id: s?.group_id,
            },
          } as CreateEvalIn);
        }
        toast.success(
          `Eval ${isEditMode ? "updated" : "created"} successfully!`
        );
        router.push("/system/evals");
      } catch (error) {
        toast.error(
          `Failed to ${isEditMode ? "update" : "create"} eval: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      formState,
      isEditMode,
      evalId,
      profile?.id,
      updateEvalAction,
      createEvalAction,
      router,
    ]
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasModels = true;
      const hasModelFlags = true;
      const hasModelPositions = true;
      const hasModelRubrics = true;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "models":
          return hasModels &&
            hasModelFlags &&
            hasModelPositions &&
            hasModelRubrics
            ? "completed"
            : "active";
        default:
          return "pending";
      }
    },
    [formState, s]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basics",
        description: "Name, description, flags, and departments.",
        resetFields: ["name", "description", "department_ids", "active"],
      },
      {
        id: "models",
        title: "Models",
        description:
          "Select models and configure model flags, positions, and rubrics.",
        resetFields: [
          "model_ids",
          "model_flag_ids",
          "model_position_ids",
          "model_rubric_ids",
          "modelSearch",
          "modelShowSelected",
        ],
      },
    ],
    []
  );

  const formFieldKeys = useMemo(
    () => [
      "name_id",
      "description_id",
      "active_flag_id",
      "dynamic_flag_id",
      "groups_flag_id",
      "department_ids",
      "model_ids",
      "model_flag_ids",
      "model_position_ids",
      "model_rubric_ids",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basics reset";
      case "models":
        return "Model configuration reset";
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
            name: null,
            name_id: null,
            description: null,
            description_id: null,
            active_flag_id: null,
            dynamic_flag_id: null,
            groups_flag_id: null,
            department_ids: [],
          };
        case "models":
          return {
            ...prev,
            model_ids: [],
            model_flag_ids: [],
            model_flags: null,
            model_position_ids: [],
            model_positions: null,
            model_rubric_ids: [],
            model_rubrics: null,
          };
        default:
          return prev;
      }
    });
  }, []);

  const submitButton = useMemo(
    () => ({
      backUrl: "/system/evals",
      backLabel: "Back",
      createLabel: "Create Eval",
      updateLabel: "Update Eval",
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
      formData: stepFormData,
      setFormData: setStepFormData,
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
      filters?: Array<{
        key: string;
        label: string;
        value: boolean;
        onChange: (value: boolean) => void;
      }>;
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
                  name_resource={s?.names?.find((item) => item.selected) ?? null}
                  show_name={true}
                  names={s?.names ?? []}
                  disabled={disabled}
                  onNameIdChange={handleNameIdChange}
                  onNameChange={handleNameChange}
                  required={true}
                  placeholder="Eval name"
                  defaultName="New Eval"
                  hideDescription={true}
                />
              }
              resetFields={["name", "description", "department_ids", "active"]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["basic"]?.length && s?.basic_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="basic"
                    resourceTypes={stepResources["basic"]}
                    canRegenerate={(rt: string) => canRegenerate(rt as EvalResourceType)}
                    isGenerating={(rt: string) =>
                      isGenerating(rt as EvalResourceType)
                    }
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Descriptions
                  description_id={formState.description_id ?? null}
                  description_resource={
                    s?.descriptions?.find((item) => item.selected) ?? null
                  }
                  show_description={true}
                  descriptions={s?.descriptions ?? []}
                  disabled={disabled}
                  onDescriptionIdChange={handleDescriptionIdChange}
                  onDescriptionChange={handleDescriptionChange}
                  required={false}
                />

                <Flags
                  flags={(s?.flags ?? []).filter((flag) => flag.key === "active")}
                  flag_id={formState.active_flag_id ?? null}
                  show_flags={(s?.flags ?? []).some((flag) => flag.key === "active" && flag.show !== false)}
                  columns={1}
                  label="Active"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                />

                <Flags
                  flags={(s?.flags ?? []).filter((flag) => flag.key === "dynamic")}
                  flag_id={formState.dynamic_flag_id ?? null}
                  show_flags={(s?.flags ?? []).some((flag) => flag.key === "dynamic" && flag.show !== false)}
                  columns={1}
                  label="Dynamic"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      dynamic_flag_id: flagId,
                    }))
                  }
                />

                <Flags
                  flags={(s?.flags ?? []).filter((flag) => flag.key === "groups")}
                  flag_id={formState.groups_flag_id ?? null}
                  show_flags={(s?.flags ?? []).some((flag) => flag.key === "groups" && flag.show !== false)}
                  columns={1}
                  label="Use Groups"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      groups_flag_id: flagId,
                    }))
                  }
                />

                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={
                    (s?.departments ?? []).filter((item) => item.selected) ?? []
                  }
                  show_departments={(s?.departments?.length ?? 0) > 0}
                  departments={s?.departments ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  required={false}
                />
              </div>
            </StepCard>
          );
        }

        case "models": {
          const modelSearch =
            (stepFormData["modelSearch"] as string | undefined) ?? null;
          const modelShowSelected =
            (stepFormData["modelShowSelected"] as boolean | undefined) ?? false;
          const hasSelectedModels =
            (formState.model_ids ?? []).length > 0;
          const showModelFlags =
            (s?.model_flags?.length ?? 0) > 0 || hasSelectedModels;
          const showModelPositions =
            (s?.model_positions?.length ?? 0) > 0 || hasSelectedModels;
          const showModelRubrics =
            (s?.model_rubrics?.length ?? 0) > 0 || hasSelectedModels;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              resetFields={[
                "model_ids",
                "model_flag_ids",
                "model_position_ids",
                "model_rubric_ids",
                "modelSearch",
                "modelShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              filters={[
                {
                  key: "modelShowSelected",
                  label: "Show selected only",
                  value: modelShowSelected,
                  onChange: (value: boolean) =>
                    setStepFormData({ modelShowSelected: value }),
                },
              ]}
              searchTerm={modelSearch ?? ""}
              onSearchChange={(term: string) =>
                setStepFormData({ modelSearch: term || null })
              }
              searchPlaceholder="Search models..."
              actions={
                stepResources["models"]?.length &&
                s?.model_show_ai_generate ? (
                  <StepCardAiButton
                    stepId="models"
                    resourceTypes={stepResources["models"]}
                    canRegenerate={(rt: string) => canRegenerate(rt as EvalResourceType)}
                    isGenerating={(rt: string) =>
                      isGenerating(rt as EvalResourceType)
                    }
                    onOpenModal={handleDirectStepGenerate}
                    disabled={disabled}
                  />
                ) : undefined
              }
            >
              <div className="space-y-6">
                <Models
                  model_id={formState.model_ids?.[0] ?? null}
                  model_resource={s?.models?.find((item) => item.selected) ?? null}
                  show_models={(s?.models?.length ?? 0) > 0}
                  models={s?.models ?? []}
                  disabled={disabled}
                  onModelIdChange={(id) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_ids: id ? [id] : [],
                    }))
                  }
                  required={false}
                  searchTerm={modelSearch ?? ""}
                  showSelectedFilter={modelShowSelected}
                />
                <ModelFlags
                  model_flag_resources={
                    (s?.model_flags ?? []).filter((item) => item.selected) ?? []
                  }
                  show_model_flags={showModelFlags}
                  model_flags={s?.model_flags ?? []}
                  model_ids={formState.model_ids ?? []}
                  models={s?.models ?? []}
                  model_resources={(s?.models ?? []).filter((item) => item.selected)}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_flag_ids: ids,
                    }))
                  }
                  required={false}
                  onModelFlagValues={(flags) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_flags: flags.length > 0 ? flags : null,
                    }))
                  }
                />
                <ModelPositions
                  model_position_ids={formState.model_position_ids ?? []}
                  model_position_resources={
                    (s?.model_positions ?? []).filter((item) => item.selected) ?? []
                  }
                  show_model_positions={showModelPositions}
                  model_positions={s?.model_positions ?? []}
                  models={s?.models ?? []}
                  model_resources={(s?.models ?? []).filter((item) => item.selected)}
                  disabled={disabled}
                  onChange={() => {}}
                  onPositionIdsChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_position_ids: ids,
                    }))
                  }
                  simulation_id={evalId || null}
                  model_ids={formState.model_ids}
                  onGenerate={handleGenerateModelPositions}
                  required={false}
                  onModelPositionValues={(positions) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_positions: positions.length > 0 ? positions : null,
                    }))
                  }
                />
                <ModelRubrics
                  model_rubric_resources={
                    (s?.model_rubrics ?? []).filter((item) => item.selected) ?? []
                  }
                  show_model_rubrics={showModelRubrics}
                  model_ids={formState.model_ids ?? []}
                  models={s?.models ?? []}
                  model_resources={(s?.models ?? []).filter((item) => item.selected)}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_rubric_ids: ids,
                    }))
                  }
                  required={false}
                  onModelRubricValues={(rubrics) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_rubrics: rubrics.length > 0 ? rubrics : null,
                    }))
                  }
                />
              </div>
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      s,
      formState,
      disabled,
      isEditMode,
      evalId,
      handleGenerateModels,
      handleGenerateModelFlags,
      handleGenerateModelPositions,
      handleGenerateModelRubrics,
      isGenerating,
      stepResources,
      canRegenerate,
      handleDirectStepGenerate,
      makeOnGenerationComplete,
    ]
  );

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`eval-${isEditMode ? "edit" : "new"}`}
      >
        <ReadOnlyBanner
          disabled={disabled}
          disabledReason={s?.disabled_reason ?? null}
          entityType="eval"
        />

        <GenericForm
          nuqsParsers={
            evalSearchParamsClient as Record<string, Parser<unknown>>
          }
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

      </div>
    </TooltipProvider>
  );
}

export default React.memo(EvalComponent);
