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
type CreateEvalIn = InputOf<"/evals/create", "post">;
type CreateEvalOut = OutputOf<"/evals/create", "post">;
type UpdateEvalIn = InputOf<"/evals/update", "post">;
type UpdateEvalOut = OutputOf<"/evals/update", "post">;
type PatchEvalDraftIn = InputOf<"/evals/draft", "patch">;
type PatchEvalDraftOut = OutputOf<"/evals/draft", "patch">;
type EvalData = OutputOf<"/evals/get", "post">;

// Resource creation endpoints
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
type CreateDraftFlagsIn = InputOf<"/api/v5/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v5/resources/flags", "post">;
type CreateDraftModelPositionsIn = InputOf<
  "/api/v5/resources/model_positions",
  "post"
>;
type CreateDraftModelPositionsOut = OutputOf<
  "/api/v5/resources/model_positions",
  "post"
>;
type CreateDraftModelRubricsIn = InputOf<
  "/api/v5/resources/model_rubrics",
  "post"
>;
type CreateDraftModelRubricsOut = OutputOf<
  "/api/v5/resources/model_rubrics",
  "post"
>;

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
  // Resource creation actions
  createNamesAction?: (
    input: CreateDraftNamesIn
  ) => Promise<CreateDraftNamesOut>;
  createDescriptionsAction?: (
    input: CreateDraftDescriptionsIn
  ) => Promise<CreateDraftDescriptionsOut>;
  createFlagsAction?: (
    input: CreateDraftFlagsIn
  ) => Promise<CreateDraftFlagsOut>;
  createModelFlagsAction?: React.ComponentProps<
    typeof ModelFlags
  >["createModelFlagsAction"];
  createModelPositionsAction?: (
    input: CreateDraftModelPositionsIn
  ) => Promise<CreateDraftModelPositionsOut>;
  createModelRubricsAction?: (
    input: CreateDraftModelRubricsIn
  ) => Promise<CreateDraftModelRubricsOut>;
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
}

function EvalComponent({
  evalId,
  evalDetail,
  evalDetailDefault,
  createEvalAction,
  updateEvalAction,
  patchEvalDraftAction,
  createNamesAction,
  createDescriptionsAction,
  createFlagsAction: _createFlagsAction,
  createModelFlagsAction,
  createModelPositionsAction,
  createModelRubricsAction,
}: EvalProps) {
  const router = useRouter();
  const isEditMode = !!evalId;
  const { profile } = useProfile();
  const { selectedDraftId, setSelectedDraftId } = useDrafts();
  const evalData = isEditMode ? evalDetail : evalDetailDefault;
  const s = useMemo(() => {
    if (!evalData) return null;
    return {
      names: evalData.names,
      descriptions: evalData.descriptions,
      active_flags: evalData.active_flags,
      dynamic_flags: evalData.dynamic_flags,
      groups_flags: evalData.groups_flags,
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
      draft_version: evalData.draft_version,
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
    return {
      name: null,
      name_id: data?.names?.resource?.id ?? null,
      description: null,
      description_id: data?.descriptions?.resource?.id ?? null,
      active_flag_id: data?.active_flags?.resource?.flag_option_id ?? null,
      dynamic_flag_id: data?.dynamic_flags?.resource?.flag_option_id ?? null,
      groups_flag_id: data?.groups_flags?.resource?.flag_option_id ?? null,
      department_ids:
        data?.departments?.current
          ?.map((d) => d.department_id)
          .filter(Boolean)
          .map(String) ?? [],
      model_ids:
        data?.models?.current
          ?.map((m) => m.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_flag_ids:
        data?.model_flags?.current
          ?.map((f) => f.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_position_ids:
        data?.model_positions?.current
          ?.map((p) => p.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_rubric_ids:
        data?.model_rubrics?.current
          ?.map((r) => r.id)
          .filter(Boolean)
          .map(String) ?? [],
      model_flags: null,
      model_positions: null,
      model_rubrics: null,
    };
  }, []);

  const [formState, setFormState] =
    useState<EvalFormState>(getInitialFormState);

  const departmentIdsStr = useMemo(
    () =>
      JSON.stringify(
        s?.departments?.current
          ?.map((d) => d.department_id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.departments?.current]
  );
  const modelIdsStr = useMemo(
    () =>
      JSON.stringify(
        s?.models?.current
          ?.map((m) => m.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.models?.current]
  );
  const modelFlagIdsStr = useMemo(
    () =>
      JSON.stringify(
        s?.model_flags?.current
          ?.map((f) => f.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.model_flags?.current]
  );
  const modelPositionIdsStr = useMemo(
    () =>
      JSON.stringify(
        s?.model_positions?.current
          ?.map((p) => p.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.model_positions?.current]
  );
  const modelRubricIdsStr = useMemo(
    () =>
      JSON.stringify(
        s?.model_rubrics?.current
          ?.map((r) => r.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s?.model_rubrics?.current]
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
    s?.active_flags,
    s?.dynamic_flags,
    s?.groups_flags,
    departmentIdsStr,
    modelIdsStr,
    modelFlagIdsStr,
    modelPositionIdsStr,
    modelRubricIdsStr,
    getInitialFormState,
  ]);

  // Draft version tracking
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const lastSavedVersionRef = useRef(0);
  useEffect(() => {
    lastSavedVersionRef.current = lastSavedVersion;
  }, [lastSavedVersion]);
  // Sync draft_version from server to avoid unintended draft forks.
  const draftVersion =
    s && "draft_version" in s
      ? (s as { draft_version?: number | null }).draft_version
      : null;
  useEffect(() => {
    if (
      typeof draftVersion === "number" &&
      draftVersion !== lastSavedVersionRef.current
    ) {
      setLastSavedVersion(draftVersion);
      lastSavedVersionRef.current = draftVersion;
    }
  }, [draftVersion]);

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
      model_flag_ids: formState.model_flag_ids,
      model_position_ids: formState.model_position_ids,
      model_rubric_ids: formState.model_rubric_ids,
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
          input_draft_id: draftId || null,
          flag_ids: flagIds.length > 0 ? flagIds : null,
          department_ids: formState.department_ids.length > 0 ? formState.department_ids : null,
          model_ids: formState.model_ids.length > 0 ? formState.model_ids : null,
          expected_version: lastSavedVersionRef.current,
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
        if (result.form_state) {
          serverSyncPendingRef.current = true;
          setFormState((prev) => ({
            ...prev,
            name: null,
            name_id: (result.form_state!.name_id as string) ?? prev.name_id,
            description: null,
            description_id: (result.form_state!.description_id as string) ?? prev.description_id,
          }));
          requestAnimationFrame(() => {
            serverSyncPendingRef.current = false;
          });
        }

        if (!draftId && result.draft_id) {
          setUrlFormDataRef.current?.({ draftId: result.draft_id });
        }

        if ((result.new_version ?? 0) !== lastSavedVersionRef.current) {
          setLastSavedVersion(result.new_version ?? 0);
          lastSavedVersionRef.current = result.new_version ?? 0;
        }
      } catch {
        // Draft patch failed - leave lastPatchedKeyRef unchanged
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [draftPatchKey, draftId, formState]);

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
          return s.names?.resource?.generated ?? false;
        case "descriptions":
          return s.descriptions?.resource?.generated ?? false;
        case "flags":
          return (
            s.active_flags?.resource?.generated ||
            s.dynamic_flags?.resource?.generated ||
            s.groups_flags?.resource?.generated ||
            false
          );
        case "departments":
          return s.departments?.current?.some((d) => d.generated) ?? false;
        case "models":
          return s.models?.current?.some((m) => m.generated) ?? false;
        case "model_flags":
          return s.model_flags?.current?.some((f) => f.generated) ?? false;
        case "model_positions":
          return s.model_positions?.current?.some((p) => p.generated) ?? false;
        case "model_rubrics":
          return s.model_rubrics?.current?.some((r) => r.generated) ?? false;
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
  const handleGenerateNames = useCallback(
    async () => handleGenerateResources(["names"]),
    [handleGenerateResources]
  );

  const handleGenerateDescriptions = useCallback(
    async () => handleGenerateResources(["descriptions"]),
    [handleGenerateResources]
  );

  const handleGenerateFlags = useCallback(
    async () => handleGenerateResources(["flags"]),
    [handleGenerateResources]
  );

  const handleGenerateDepartments = useCallback(
    async () => handleGenerateResources(["departments"]),
    [handleGenerateResources]
  );

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
      if (s?.names?.required && !formState.name_id) {
        toast.error("Eval name is required");
        throw new Error("Eval name is required");
      }

      if (s?.descriptions?.required && !formState.description_id) {
        toast.error("Eval description is required");
        throw new Error("Eval description is required");
      }

      if (
        s?.departments?.required &&
        (!formState.department_ids || formState.department_ids.length === 0)
      ) {
        toast.error("Departments are required");
        throw new Error("Departments are required");
      }

      if (
        s?.models?.required &&
        (!formState.model_ids || formState.model_ids.length === 0)
      ) {
        toast.error("Models are required");
        throw new Error("Models are required");
      }

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
      s?.names?.required,
      s?.descriptions?.required,
      s?.departments?.required,
      s?.models?.required,
    ]
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasModels =
        !(s?.models?.required ?? false) ||
        formState.model_ids.length > 0;
      const hasModelFlags =
        !(s?.model_flags?.required ?? false) ||
        formState.model_flag_ids.length > 0;
      const hasModelPositions =
        !(s?.model_positions?.required ?? false) ||
        formState.model_position_ids.length > 0;
      const hasModelRubrics =
        !(s?.model_rubrics?.required ?? false) ||
        formState.model_rubric_ids.length > 0;

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
                  name_resource={s?.names?.resource ?? null}
                  show_name={s?.names?.show ?? true}
                  name_suggestions={s?.names?.suggestions?.map(String) ?? []}
                  names={s?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId, name: null }))
                  }
                  onNameChange={(name) =>
                    setFormState((prev) => ({ ...prev, name }))
                  }
                  onGenerate={handleGenerateNames}
                  createNamesAction={createNamesAction}
                  required={s?.names?.required ?? false}
                  placeholder="Eval name"
                  defaultName="New Eval"
                  hideDescription={true}
                  showAiGenerate={s?.names?.show_ai_generate ?? false}
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
                  description_resource={s?.descriptions?.resource ?? null}
                  show_description={s?.descriptions?.show ?? true}
                  description_suggestions={
                    s?.descriptions?.suggestions?.map(String) ?? []
                  }
                  descriptions={s?.descriptions?.resources ?? []}
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
                  onGenerate={handleGenerateDescriptions}
                  createDescriptionsAction={createDescriptionsAction}
                  required={s?.descriptions?.required ?? false}
                  showAiGenerate={s?.descriptions?.show_ai_generate ?? false}
                />

                <Flags
                  flags={s?.active_flags?.resources ?? []}
                  flag_id={formState.active_flag_id ?? null}
                  show_flags={s?.active_flags?.show ?? false}
                  columns={1}
                  label="Active"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      active_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                />

                <Flags
                  flags={s?.dynamic_flags?.resources ?? []}
                  flag_id={formState.dynamic_flag_id ?? null}
                  show_flags={s?.dynamic_flags?.show ?? false}
                  columns={1}
                  label="Dynamic"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      dynamic_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                />

                <Flags
                  flags={s?.groups_flags?.resources ?? []}
                  flag_id={formState.groups_flag_id ?? null}
                  show_flags={s?.groups_flags?.show ?? false}
                  columns={1}
                  label="Use Groups"
                  disabled={disabled}
                  onChange={(flagId) =>
                    setFormState((prev) => ({
                      ...prev,
                      groups_flag_id: flagId,
                    }))
                  }
                  onGenerate={handleGenerateFlags}
                />

                <Departments
                  department_ids={formState.department_ids ?? []}
                  department_resources={s?.departments?.current ?? []}
                  show_departments={s?.departments?.show ?? false}
                  department_suggestions={
                    s?.departments?.suggestions?.map(String) ?? []
                  }
                  departments={s?.departments?.resources ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({ ...prev, department_ids: ids }))
                  }
                  onGenerate={handleGenerateDepartments}
                  required={s?.departments?.required ?? false}
                  showAiGenerate={s?.departments?.show_ai_generate ?? false}
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
            (s?.model_flags?.show ?? false) || hasSelectedModels;
          const showModelPositions =
            (s?.model_positions?.show ?? false) || hasSelectedModels;
          const showModelRubrics =
            (s?.model_rubrics?.show ?? false) || hasSelectedModels;

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
                  show_models={(s?.models?.show ?? false) || (s?.models?.required ?? false)}
                  models={s?.models?.resources ?? []}
                  disabled={disabled}
                  onModelIdChange={(id) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_ids: id ? [id] : [],
                    }))
                  }
                  onGenerate={handleGenerateModels}
                  required={s?.models?.required ?? false}
                  showAiGenerate={s?.models?.show_ai_generate ?? false}
                  searchTerm={modelSearch ?? ""}
                  showSelectedFilter={modelShowSelected}
                />
                <ModelFlags
                  model_flag_ids={formState.model_flag_ids ?? []}
                  model_flag_resources={s?.model_flags?.current ?? []}
                  show_model_flags={showModelFlags}
                  model_flags={s?.model_flags?.resources ?? []}
                  model_ids={formState.model_ids ?? []}
                  models={s?.models?.resources ?? []}
                  model_resources={s?.models?.current ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_flag_ids: ids,
                    }))
                  }
                  createModelFlagsAction={createModelFlagsAction}
                  onGenerate={handleGenerateModelFlags}
                  required={s?.model_flags?.required ?? false}
                  showAiGenerate={s?.model_flags?.show_ai_generate ?? false}
                  onModelFlagValues={(flags) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_flags: flags.length > 0 ? flags : null,
                    }))
                  }
                />
                <ModelPositions
                  model_position_ids={formState.model_position_ids ?? []}
                  model_position_resources={s?.model_positions?.current ?? []}
                  show_model_positions={showModelPositions}
                  model_positions={s?.model_positions?.resources ?? []}
                  models={s?.models?.resources ?? []}
                  model_resources={s?.models?.current ?? []}
                  disabled={disabled}
                  onChange={() => {}}
                  onPositionIdsChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_position_ids: ids,
                    }))
                  }
                  eval_id={evalId || null}
                  model_ids={formState.model_ids}
                  createModelPositionsAction={createModelPositionsAction}
                  onGenerate={handleGenerateModelPositions}
                  required={s?.model_positions?.required ?? false}
                  showAiGenerate={s?.model_positions?.show_ai_generate ?? false}
                  onModelPositionValues={(positions) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_positions: positions.length > 0 ? positions : null,
                    }))
                  }
                />
                <ModelRubrics
                  model_rubric_ids={formState.model_rubric_ids ?? []}
                  model_rubric_resources={s?.model_rubrics?.current ?? []}
                  show_model_rubrics={showModelRubrics}
                  model_rubrics={s?.model_rubrics?.resources ?? []}
                  model_ids={formState.model_ids ?? []}
                  models={s?.models?.resources ?? []}
                  model_resources={s?.models?.current ?? []}
                  disabled={disabled}
                  onChange={(ids) =>
                    setFormState((prev) => ({
                      ...prev,
                      model_rubric_ids: ids,
                    }))
                  }
                  createModelRubricsAction={createModelRubricsAction}
                  onGenerate={handleGenerateModelRubrics}
                  required={s?.model_rubrics?.required ?? false}
                  showAiGenerate={s?.model_rubrics?.show_ai_generate ?? false}
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
      handleGenerateNames,
      handleGenerateDescriptions,
      handleGenerateDepartments,
      handleGenerateFlags,
      handleGenerateModels,
      handleGenerateModelFlags,
      handleGenerateModelPositions,
      handleGenerateModelRubrics,
      isGenerating,
      stepResources,
      canRegenerate,
      handleDirectStepGenerate,
      createNamesAction,
      createDescriptionsAction,
      createModelFlagsAction,
      createModelPositionsAction,
      createModelRubricsAction,
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
