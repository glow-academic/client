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
import type { GenerateRegenerateModalResource } from "@/components/common/forms/GenerateRegenerateModal";
import { GenerateRegenerateModal } from "@/components/common/forms/GenerateRegenerateModal";
import { ReadOnlyBanner } from "@/components/common/forms/ReadOnlyBanner";
import { Agents } from "@/components/resources/Agents";
import { Departments } from "@/components/resources/Departments";
import { Descriptions } from "@/components/resources/Descriptions";
import { Flags } from "@/components/resources/Flags";
import { GroupRubrics } from "@/components/resources/GroupRubrics";
import { Groups } from "@/components/resources/Groups";
import { Names } from "@/components/resources/Names";
import { RunRubrics } from "@/components/resources/RunRubrics";
import { Runs } from "@/components/resources/Runs";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDrafts } from "@/contexts/draft-context";
import { useProfile } from "@/contexts/profile-context";
import { useArtifactAi } from "@/hooks/use-artifact-ai";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { ResourceType } from "@/lib/resources/types";
import { Loader2, Sparkles } from "lucide-react";
import { parseAsBoolean, parseAsString, type Parser } from "nuqs";

// Types defined inline using InputOf/OutputOf
// Eval endpoints
type SaveEvalIn = InputOf<"/api/v4/artifacts/evals/save", "post">;
type SaveEvalOut = OutputOf<"/api/v4/artifacts/evals/save", "post">;
type PatchEvalDraftIn = InputOf<"/api/v4/artifacts/evals/draft", "patch">;
type PatchEvalDraftOut = OutputOf<"/api/v4/artifacts/evals/draft", "patch">;
type EvalData = OutputOf<"/api/v4/artifacts/evals/get", "post">;

// Resource creation endpoints
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
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftAgentsIn = InputOf<"/api/v4/resources/agents", "post">;
type CreateDraftAgentsOut = OutputOf<"/api/v4/resources/agents", "post">;
type CreateDraftRunsIn = InputOf<"/api/v4/resources/runs", "post">;
type CreateDraftRunsOut = OutputOf<"/api/v4/resources/runs", "post">;
type CreateDraftGroupsIn = InputOf<"/api/v4/resources/groups", "post">;
type CreateDraftGroupsOut = OutputOf<"/api/v4/resources/groups", "post">;

export interface EvalProps {
  evalId?: string;
  // Server-provided data (for server-side rendering)
  evalDetail?: EvalData;
  evalDetailDefault?: EvalData;
  // Server actions
  createEvalAction?: (input: SaveEvalIn) => Promise<SaveEvalOut>;
  updateEvalAction?: (input: SaveEvalIn) => Promise<SaveEvalOut>;
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
  createAgentsAction?: (
    input: CreateDraftAgentsIn
  ) => Promise<CreateDraftAgentsOut>;
  createRunsAction?: (input: CreateDraftRunsIn) => Promise<CreateDraftRunsOut>;
  createGroupsAction?: (
    input: CreateDraftGroupsIn
  ) => Promise<CreateDraftGroupsOut>;
}

type EvalResourceType =
  | ResourceType
  | "agents"
  | "rubrics"
  | "run_positions"
  | "group_positions"
  | "run_rubrics"
  | "group_rubrics";

interface EvalFormState {
  name_id: string | null;
  description_id: string | null;
  active_flag_id: string | null;
  dynamic_flag_id: string | null;
  groups_flag_id: string | null;
  department_ids: string[];
  agent_ids: string[];
  run_rubric_links: Record<string, string[]>;
  group_rubric_links: Record<string, string[]>;
  model_run_ids: string[];
  group_ids: string[];
}

function normalizeRubricLinks(
  entries?: EvalData["run_rubrics"] | EvalData["group_rubrics"]
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  entries?.forEach((entry) => {
    if (!entry) return;
    const id =
      "run_id" in entry
        ? entry.run_id
        : "group_id" in entry
          ? entry.group_id
          : null;
    if (!id) return;
    map[id] = entry.rubric_ids ?? [];
  });
  return map;
}

function serializeRubricLinks(links: Record<string, string[]>) {
  return JSON.stringify(
    Object.entries(links)
      .map(([key, ids]) => [key, [...ids].sort()])
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

function buildRunRubricPayload(
  links: Record<string, string[]>
): Array<{ run_id: string; rubric_ids: string[] }> {
  return Object.entries(links)
    .filter(([, rubricIds]) => rubricIds.length > 0)
    .map(([runId, rubricIds]) => ({ run_id: runId, rubric_ids: rubricIds }));
}

function buildGroupRubricPayload(
  links: Record<string, string[]>
): Array<{ group_id: string; rubric_ids: string[] }> {
  return Object.entries(links)
    .filter(([, rubricIds]) => rubricIds.length > 0)
    .map(([groupId, rubricIds]) => ({
      group_id: groupId,
      rubric_ids: rubricIds,
    }));
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
  createFlagsAction,
  createAgentsAction,
  createRunsAction,
  createGroupsAction,
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
      agents: evalData.agents,
      rubrics: evalData.rubrics,
      runs: evalData.runs,
      groups: evalData.groups,
      run_rubrics: evalData.run_rubrics,
      group_rubrics: evalData.group_rubrics,
      available_model_runs: evalData.available_model_runs,
      available_groups: evalData.available_groups,
      basic_show_ai_generate: evalData.basic_show_ai_generate,
      group_id: evalData.group_id,
      can_edit: evalData.can_edit,
      disabled_reason: evalData.disabled_reason,
      draft_version: evalData.draft_version,
    };
  }, [evalData]);

  // Generation state for AI workflows
  const VALID_EVAL_RESOURCE_TYPES: EvalResourceType[] = [
    "names", "descriptions", "flags", "departments", "agents",
    "rubrics", "run_positions", "group_positions", "run_rubrics", "group_rubrics",
  ];
  const { isGenerating, makeOnGenerationComplete, generate } =
    useArtifactAi({
      artifactType: "eval",
      groupId: s?.group_id,
      validResourceTypes: VALID_EVAL_RESOURCE_TYPES,
    });

  // Modal state for generate/regenerate
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalMode, setModalMode] = useState<"generate" | "regenerate" | null>(
    null
  );
  const [modalResources, setModalResources] = useState<
    GenerateRegenerateModalResource[]
  >([]);
  const [modalInstructions, setModalInstructions] = useState("");

  // nuqs parsers for URL-backed state (will be passed to GenericForm)
  const evalSearchParamsClient = useMemo(
    () => ({
      draftId: parseAsString,
      agentSearch: parseAsString,
      agentShowSelected: parseAsBoolean,
      modelRunSearch: parseAsString,
      modelRunShowSelected: parseAsBoolean,
      groupSearch: parseAsString,
      groupShowSelected: parseAsBoolean,
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
      name_id: data?.names?.resource?.id ?? null,
      description_id: data?.descriptions?.resource?.id ?? null,
      active_flag_id: data?.active_flags?.resource?.flag_option_id ?? null,
      dynamic_flag_id: data?.dynamic_flags?.resource?.flag_option_id ?? null,
      groups_flag_id: data?.groups_flags?.resource?.flag_option_id ?? null,
      department_ids:
        data?.departments?.current
          ?.map((d) => d.department_id)
          .filter(Boolean)
          .map(String) ?? [],
      agent_ids:
        data?.agents?.current
          ?.map((a) => a.id)
          .filter(Boolean)
          .map(String) ?? [],
      run_rubric_links: normalizeRubricLinks(data?.run_rubrics),
      group_rubric_links: normalizeRubricLinks(data?.group_rubrics),
      model_run_ids:
        data?.runs?.current
          ?.map((r) => r.model_run_id)
          .filter(Boolean)
          .map(String) ?? [],
      group_ids:
        data?.groups?.current
          ?.map((g) => g.group_id)
          .filter(Boolean)
          .map(String) ?? [],
    };
  }, []);

  const [formState, setFormState] =
    useState<EvalFormState>(getInitialFormState);

  const currentAgentResources = useMemo(
    () =>
      s?.agents?.current?.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        generated: a.generated,
      })) ?? [],
    [s?.agents?.current]
  );

  const allAgentResources = useMemo(
    () =>
      s?.agents?.resources?.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        generated: a.generated,
      })) ?? [],
    [s?.agents?.resources]
  );

  const rubricOptions = useMemo(
    () =>
      s?.rubrics?.resources?.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        generated: r.generated,
      })) ?? [],
    [s?.rubrics?.resources]
  );

  const departmentIdsStr = useMemo(
    () =>
      JSON.stringify(
        s?.departments?.current
          ?.map((d) => d.department_id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.departments?.current]
  );
  const agentIdsStr = useMemo(
    () =>
      JSON.stringify(
        s?.agents?.current
          ?.map((a) => a.id)
          .filter(Boolean)
          .map(String) ?? []
      ),
    [s?.agents?.current]
  );

  // Sync form state when server data changes
  useEffect(() => {
    const nextState = getInitialFormState();
    setFormState((prev) => {
      const prevRunLinksStr = serializeRubricLinks(prev.run_rubric_links);
      const nextRunLinksStr = serializeRubricLinks(nextState.run_rubric_links);
      const prevGroupLinksStr = serializeRubricLinks(prev.group_rubric_links);
      const nextGroupLinksStr = serializeRubricLinks(
        nextState.group_rubric_links
      );

      if (
        prev.name_id !== nextState.name_id ||
        prev.description_id !== nextState.description_id ||
        prev.active_flag_id !== nextState.active_flag_id ||
        prev.dynamic_flag_id !== nextState.dynamic_flag_id ||
        prev.groups_flag_id !== nextState.groups_flag_id ||
        JSON.stringify(prev.department_ids) !==
          JSON.stringify(nextState.department_ids) ||
        JSON.stringify(prev.agent_ids) !==
          JSON.stringify(nextState.agent_ids) ||
        prevRunLinksStr !== nextRunLinksStr ||
        prevGroupLinksStr !== nextGroupLinksStr ||
        JSON.stringify(prev.model_run_ids) !==
          JSON.stringify(nextState.model_run_ids) ||
        JSON.stringify(prev.group_ids) !== JSON.stringify(nextState.group_ids)
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
    agentIdsStr,
    s?.run_rubrics,
    s?.group_rubrics,
    s?.runs,
    s?.groups,
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

  const draftPatchKey = useMemo(() => {
    return JSON.stringify({
      name_id: formState.name_id,
      description_id: formState.description_id,
      active_flag_id: formState.active_flag_id,
      dynamic_flag_id: formState.dynamic_flag_id,
      groups_flag_id: formState.groups_flag_id,
      department_ids: formState.department_ids,
      agent_ids: formState.agent_ids,
      model_run_ids: formState.model_run_ids,
      group_ids: formState.group_ids,
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
      formState.agent_ids.length > 0 ||
      formState.model_run_ids.length > 0 ||
      formState.group_ids.length > 0;

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
        const result = await patchEvalDraftActionRef.current({
          body: {
            input_draft_id: draftId || null,
            group_id: s?.group_id ?? null,
            name_id: formState.name_id,
            description_id: formState.description_id,
            flag_ids: flagIds.length > 0 ? flagIds : null,
            department_ids: formState.department_ids.length > 0 ? formState.department_ids : null,
            agent_ids: formState.agent_ids.length > 0 ? formState.agent_ids : null,
            model_run_ids: formState.model_run_ids.length > 0 ? formState.model_run_ids : null,
            group_ids: formState.group_ids.length > 0 ? formState.group_ids : null,
            run_position_ids: null,
            group_position_ids: null,
            expected_version: lastSavedVersionRef.current,
          },
        });

        lastPatchedKeyRef.current = draftPatchKey;

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

  // Set generation capability when eval data is loaded
  const hasAnyAiGenerate =
    s?.names?.show_ai_generate ||
    s?.descriptions?.show_ai_generate ||
    s?.active_flags?.show_ai_generate ||
    s?.dynamic_flags?.show_ai_generate ||
    s?.groups_flags?.show_ai_generate ||
    s?.departments?.show_ai_generate ||
    s?.agents?.show_ai_generate ||
    s?.rubrics?.show_ai_generate ||
    false;

  // Readonly logic using server-provided can_edit flag
  const disabled = useMemo(() => {
    if (!s) return false;
    return !s.can_edit;
  }, [s]);

  // Map available model runs to Runs component shape
  const availableRuns = useMemo(() => {
    return (s?.runs?.resources ?? s?.available_model_runs ?? []).map((run) => ({
      run_id: run.model_run_id,
      name: run.model_name ?? "Model run",
      description:
        run.agent_name || run.persona_name || run.profile_name || undefined,
      generated: null,
    }));
  }, [s?.runs?.resources, s?.available_model_runs]);

  // Map available groups to Groups component shape
  const availableGroups = useMemo(() => {
    return (s?.groups?.resources ?? s?.available_groups ?? []).map((group) => ({
      group_id: group.group_id,
      name: group.name ?? "Group",
      description: group.description ?? undefined,
      generated: null,
    }));
  }, [s?.groups?.resources, s?.available_groups]);

  const runLookup = useMemo(() => {
    const lookup: Record<string, { name?: string; description?: string }> = {};
    availableRuns.forEach((run) => {
      if (run.run_id) {
        lookup[run.run_id] = {
          name: run.name ?? undefined,
          description: run.description ?? undefined,
        };
      }
    });
    return lookup;
  }, [availableRuns]);

  const groupLookup = useMemo(() => {
    const lookup: Record<string, { name?: string; description?: string }> = {};
    availableGroups.forEach((group) => {
      if (group.group_id) {
        lookup[group.group_id] = {
          name: group.name ?? undefined,
          description: group.description ?? undefined,
        };
      }
    });
    return lookup;
  }, [availableGroups]);

  const handleModelRunIdsChange = useCallback(
    (ids: string[]) => {
      setFormState((prev) => {
        const nextLinks = { ...prev.run_rubric_links };
        Object.keys(nextLinks).forEach((runId) => {
          if (!ids.includes(runId)) {
            delete nextLinks[runId];
          }
        });
        return { ...prev, model_run_ids: ids, run_rubric_links: nextLinks };
      });
    },
    [setFormState]
  );

  const handleGroupIdsChange = useCallback(
    (ids: string[]) => {
      setFormState((prev) => {
        const nextLinks = { ...prev.group_rubric_links };
        Object.keys(nextLinks).forEach((groupId) => {
          if (!ids.includes(groupId)) {
            delete nextLinks[groupId];
          }
        });
        return { ...prev, group_ids: ids, group_rubric_links: nextLinks };
      });
    },
    [setFormState]
  );

  const handleRunRubricsChange = useCallback(
    (runId: string, rubricIds: string[]) => {
      setFormState((prev) => {
        const nextLinks = { ...prev.run_rubric_links };
        if (rubricIds.length === 0) {
          delete nextLinks[runId];
        } else {
          nextLinks[runId] = rubricIds;
        }
        return { ...prev, run_rubric_links: nextLinks };
      });
    },
    [setFormState]
  );

  const handleGroupRubricsChange = useCallback(
    (groupId: string, rubricIds: string[]) => {
      setFormState((prev) => {
        const nextLinks = { ...prev.group_rubric_links };
        if (rubricIds.length === 0) {
          delete nextLinks[groupId];
        } else {
          nextLinks[groupId] = rubricIds;
        }
        return { ...prev, group_rubric_links: nextLinks };
      });
    },
    [setFormState]
  );

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
        case "agents":
          return s.agents?.current?.some((a) => a.generated) ?? false;
        case "rubrics":
          return s.rubrics?.current?.some((r) => r.generated) ?? false;
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
      agents: ["agents"],
      runs: ["run_positions", "run_rubrics"],
      groups: ["group_positions", "group_rubrics"],
      all: [
        "names",
        "descriptions",
        "flags",
        "departments",
        "agents",
        "run_positions",
        "group_positions",
        "run_rubrics",
        "group_rubrics",
      ],
    }),
    []
  );

  const resourceLabels: Partial<Record<EvalResourceType, string>> = useMemo(
    () => ({
      names: "Names",
      descriptions: "Descriptions",
      flags: "Flags",
      departments: "Departments",
      agents: "Agents",
      rubrics: "Rubrics (Legacy)",
      run_positions: "Run Positions",
      group_positions: "Group Positions",
      run_rubrics: "Run Rubrics",
      group_rubrics: "Group Rubrics",
    }),
    []
  );

  const handleGenerateResources = useCallback(
    async (
      resourceTypes: EvalResourceType[],
      _agentType?: string | null,
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

  const handleGenerateAgents = useCallback(
    async () => handleGenerateResources(["agents"]),
    [handleGenerateResources]
  );

  const handleOpenStepCardModal = useCallback(
    (stepId: string, mode: "generate" | "regenerate") => {
      const resourceTypes = stepResources[stepId] || [];
      const resources: GenerateRegenerateModalResource[] = resourceTypes.map(
        (rt) => ({
          id: rt,
          label: resourceLabels[rt] ?? "",
          active: mode === "regenerate" ? canRegenerate(rt) : true,
        })
      );

      setModalResources(resources);
      setModalMode(mode);
      setModalInstructions("");
      setShowGenerateModal(true);
    },
    [stepResources, resourceLabels, canRegenerate]
  );

  const handleModalGenerate = useCallback(
    async (selectedResources: string[], instructions: string) => {
      const resourceTypes = selectedResources as EvalResourceType[];
      await handleGenerateResources(
        resourceTypes,
        null,
        instructions.trim() || undefined
      );
      setShowGenerateModal(false);
      setModalInstructions("");
    },
    [handleGenerateResources]
  );

  // Listen for full-page-generate event from layout
  useEffect(() => {
    const handleFullPageGenerate = () => {
      if (hasAnyAiGenerate) {
        handleOpenStepCardModal("all", "generate");
      }
    };
    window.addEventListener("full-page-generate", handleFullPageGenerate);
    return () =>
      window.removeEventListener("full-page-generate", handleFullPageGenerate);
  }, [handleOpenStepCardModal, hasAnyAiGenerate]);

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
        s?.agents?.required &&
        (!formState.agent_ids || formState.agent_ids.length === 0)
      ) {
        toast.error("Agents are required");
        throw new Error("Agents are required");
      }

      const useGroups = !!formState.groups_flag_id;
      const hasRubricsForRuns =
        formState.model_run_ids.length > 0 &&
        formState.model_run_ids.every(
          (runId) => (formState.run_rubric_links[runId]?.length ?? 0) > 0
        );
      const hasRubricsForGroups =
        formState.group_ids.length > 0 &&
        formState.group_ids.every(
          (groupId) => (formState.group_rubric_links[groupId]?.length ?? 0) > 0
        );

      if (s?.rubrics?.required) {
        if (useGroups) {
          if (!hasRubricsForGroups) {
            toast.error("Assign at least one rubric to each group");
            throw new Error("Group rubrics are required");
          }
        } else if (!hasRubricsForRuns) {
          toast.error("Assign at least one rubric to each run");
          throw new Error("Run rubrics are required");
        }
      }

      if (!profile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        throw new Error("Profile not loaded");
      }

      const saveAction = isEditMode ? updateEvalAction : createEvalAction;
      if (!saveAction) {
        toast.error("Save action not available");
        throw new Error("Save action not available");
      }

      try {
        if (!formState.name_id) {
          toast.error("Name is required");
          throw new Error("Name is required");
        }

        const saveFlagIds = [
          formState.active_flag_id,
          formState.dynamic_flag_id,
          formState.groups_flag_id,
        ].filter(Boolean) as string[];
        await saveAction({
          body: {
            input_eval_id: isEditMode && evalId ? evalId : null,
            name_id: formState.name_id!,
            description_id: formState.description_id,
            flag_ids: saveFlagIds.length > 0 ? saveFlagIds : null,
            department_ids: formState.department_ids.length > 0 ? formState.department_ids : null,
            agent_ids: formState.agent_ids.length > 0 ? formState.agent_ids : null,
            model_run_ids: formState.model_run_ids.length > 0 ? formState.model_run_ids : null,
            group_ids: formState.group_ids.length > 0 ? formState.group_ids : null,
            run_position_ids: null,
            group_position_ids: null,
            run_rubrics: buildRunRubricPayload(formState.run_rubric_links),
            group_rubrics: buildGroupRubricPayload(
              formState.group_rubric_links
            ),
          },
        });
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
      s?.agents?.required,
      s?.rubrics?.required,
    ]
  );

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string, _formData: Record<string, unknown>): StepStatus => {
      const hasName = !!formState.name_id;
      const hasDescription = !!formState.description_id;
      const hasDepartments = formState.department_ids.length > 0;
      const hasAgents = formState.agent_ids.length > 0;
      const hasRuns = formState.model_run_ids.length > 0;
      const hasGroups = formState.group_ids.length > 0;
      const useGroups = !!formState.groups_flag_id;
      const hasRunRubrics =
        formState.model_run_ids.length > 0 &&
        formState.model_run_ids.every(
          (runId) => (formState.run_rubric_links[runId]?.length ?? 0) > 0
        );
      const hasGroupRubrics =
        formState.group_ids.length > 0 &&
        formState.group_ids.every(
          (groupId) => (formState.group_rubric_links[groupId]?.length ?? 0) > 0
        );
      const requiresRubrics = s?.rubrics?.required ?? false;

      switch (stepId) {
        case "basic":
          return hasName && hasDescription ? "completed" : "active";
        case "agents":
          if (!hasName || !hasDescription) return "pending";
          return hasAgents ? "completed" : "active";
        case "runs":
          if (!hasName || !hasDescription || useGroups) return "pending";
          return hasRuns && (!requiresRubrics || hasRunRubrics)
            ? "completed"
            : "active";
        case "groups":
          if (!hasName || !hasDescription || !useGroups) return "pending";
          return hasGroups && (!requiresRubrics || hasGroupRubrics)
            ? "completed"
            : "active";
        default:
          return hasDepartments ? "completed" : "pending";
      }
    },
    [formState, s?.rubrics?.required]
  );

  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basics",
        description: "Name, description, flags, and departments.",
        resetFields: ["agentSearch"],
      },
      {
        id: "agents",
        title: "Agents",
        description: "Select agents to evaluate.",
        resetFields: ["agentSearch", "agentShowSelected"],
      },
      {
        id: "runs",
        title: "Model Runs",
        description: "Select model runs for evaluation.",
        resetFields: ["modelRunSearch", "modelRunShowSelected"],
      },
      {
        id: "groups",
        title: "Groups",
        description: "Select groups for evaluation.",
        resetFields: ["groupSearch", "groupShowSelected"],
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
      "agent_ids",
      "model_run_ids",
      "group_ids",
    ],
    []
  );

  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basics reset";
      case "agents":
        return "Agents reset";
      case "runs":
        return "Model runs reset";
      case "groups":
        return "Groups reset";
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
            dynamic_flag_id: null,
            groups_flag_id: null,
            department_ids: [],
          };
        case "agents":
          return {
            ...prev,
            agent_ids: [],
          };
        case "runs":
          return {
            ...prev,
            model_run_ids: [],
            run_rubric_links: {},
          };
        case "groups":
          return {
            ...prev,
            group_ids: [],
            group_rubric_links: {},
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
      onReset?: () => void;
    }) => {
      const useGroups = !!formState.groups_flag_id;
      const agentSearch =
        (stepFormData["agentSearch"] as string | null | undefined) || "";
      const modelRunSearch =
        (stepFormData["modelRunSearch"] as string | null | undefined) || "";
      const groupSearch =
        (stepFormData["groupSearch"] as string | null | undefined) || "";

      switch (stepId) {
        case "basic": {
          const basicHasAiGenerate = s?.basic_show_ai_generate ?? false;

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              actions={
                stepResources["basic"] &&
                stepResources["basic"].length > 0 &&
                basicHasAiGenerate ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "basic"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "basic",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["basic"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["basic"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["basic"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              customHeader={
                <Names
                  name_id={formState.name_id ?? null}
                  name_resource={s?.names?.resource ?? null}
                  show_name={s?.names?.show ?? true}
                  name_suggestions={s?.names?.suggestions?.map(String) ?? []}
                  names={s?.names?.resources ?? []}
                  disabled={disabled}
                  onNameIdChange={(nameId) =>
                    setFormState((prev) => ({ ...prev, name_id: nameId }))
                  }
                  onGenerate={handleGenerateNames}
                  group_id={s?.group_id ?? null}
                  agent_id={null}
                  createNamesAction={createNamesAction}
                  required={s?.names?.required ?? false}
                />
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
                    }))
                  }
                  onGenerate={handleGenerateDescriptions}
                  required={s?.descriptions?.required ?? false}
                  group_id={s?.group_id ?? null}
                  agent_id={null}
                  createDescriptionsAction={createDescriptionsAction}
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
                  group_id={s?.group_id ?? null}
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
                  group_id={s?.group_id ?? null}
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
                  group_id={s?.group_id ?? null}
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
                  group_id={s?.group_id ?? null}
                  agent_id={null}

                />
              </div>
            </StepCard>
          );
        }

        case "agents": {
          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              actions={
                stepResources["agents"] &&
                stepResources["agents"].length > 0 &&
                s?.agents?.show_ai_generate ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "agents"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "agents",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["agents"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["agents"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["agents"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              searchTerm={agentSearch}
              onSearchChange={(term) =>
                setStepFormData({ agentSearch: term || null })
              }
              searchPlaceholder="Search agents..."
              debounceMs={300}
            >
              <Agents
                agent_ids={formState.agent_ids ?? []}
                agent_resources={currentAgentResources}
                show_agents={s?.agents?.show ?? false}
                agent_suggestions={s?.agents?.suggestions?.map(String) ?? []}
                agents={allAgentResources}
                disabled={disabled}
                onChange={(ids) =>
                  setFormState((prev) => ({ ...prev, agent_ids: ids }))
                }
                onGenerate={handleGenerateAgents}
                required={s?.agents?.required ?? false}
                group_id={s?.group_id ?? null}
                agent_id={null}
                createAgentsAction={createAgentsAction}
              />
            </StepCard>
          );
        }

        case "runs": {
          if (useGroups) {
            return null;
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={modelRunSearch}
              onSearchChange={(term) =>
                setStepFormData({ modelRunSearch: term || null })
              }
              searchPlaceholder="Search model runs..."
              debounceMs={300}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["runs"] &&
                stepResources["runs"].length > 0 &&
                s?.rubrics?.show_ai_generate ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "runs"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "runs",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["runs"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["runs"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["runs"]!.some((rt) => canRegenerate(rt))
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Runs
                  run_ids={formState.model_run_ids ?? []}
                  run_resources={[]}
                  show_runs={availableRuns.length > 0}
                  runs={availableRuns}
                  disabled={disabled}
                  onChange={handleModelRunIdsChange}
                  group_id={s?.group_id ?? null}
                  createRunsAction={createRunsAction}
                />
                {formState.model_run_ids.length > 0 && (
                  <div className="space-y-4">
                    {formState.model_run_ids.map((runId) => (
                      <RunRubrics
                        key={runId}
                        run_id={runId}
                        run_name={runLookup[runId]?.name ?? null}
                        run_description={runLookup[runId]?.description ?? null}
                        show_rubrics={s?.rubrics?.show ?? false}
                        rubrics={rubricOptions}
                        disabled={disabled}
                        required={s?.rubrics?.required ?? false}
                        selected_rubric_ids={
                          formState.run_rubric_links[runId] ?? []
                        }
                        onChange={handleRunRubricsChange}
                      />
                    ))}
                  </div>
                )}
              </div>
            </StepCard>
          );
        }

        case "groups": {
          if (!useGroups) {
            return null;
          }

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={disabled}
              isEditMode={isEditMode}
              searchTerm={groupSearch}
              onSearchChange={(term) =>
                setStepFormData({ groupSearch: term || null })
              }
              searchPlaceholder="Search groups..."
              debounceMs={300}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
              actions={
                stepResources["groups"] &&
                stepResources["groups"].length > 0 &&
                s?.rubrics?.show_ai_generate ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const hasRegeneratable = stepResources[
                              "groups"
                            ]!.some((rt) => canRegenerate(rt));
                            handleOpenStepCardModal(
                              "groups",
                              hasRegeneratable ? "regenerate" : "generate"
                            );
                          }}
                          disabled={
                            disabled ||
                            stepResources["groups"]!.some((rt) =>
                              isGenerating(rt)
                            )
                          }
                        >
                          {stepResources["groups"]!.some((rt) =>
                            isGenerating(rt)
                          ) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {stepResources["groups"]!.some((rt) =>
                          canRegenerate(rt)
                        )
                          ? "Regenerate"
                          : "Generate"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : undefined
              }
            >
              <div className="space-y-4">
                <Groups
                  group_ids={formState.group_ids ?? []}
                  group_resources={[]}
                  show_groups={availableGroups.length > 0}
                  groups={availableGroups}
                  disabled={disabled}
                  onChange={handleGroupIdsChange}
                  group_id={s?.group_id ?? null}
                  createGroupsAction={createGroupsAction}
                />
                {formState.group_ids.length > 0 && (
                  <div className="space-y-4">
                    {formState.group_ids.map((groupId) => (
                      <GroupRubrics
                        key={groupId}
                        group_id={groupId}
                        group_name={groupLookup[groupId]?.name ?? null}
                        group_description={
                          groupLookup[groupId]?.description ?? null
                        }
                        show_rubrics={s?.rubrics?.show ?? false}
                        rubrics={rubricOptions}
                        disabled={disabled}
                        required={s?.rubrics?.required ?? false}
                        selected_rubric_ids={
                          formState.group_rubric_links[groupId] ?? []
                        }
                        onChange={handleGroupRubricsChange}
                      />
                    ))}
                  </div>
                )}
              </div>
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      s,
      formState,
      disabled,
      isEditMode,
      stepResources,
      handleOpenStepCardModal,
      canRegenerate,
      isGenerating,
      handleGenerateNames,
      handleGenerateDescriptions,
      handleGenerateFlags,
      handleGenerateDepartments,
      handleGenerateAgents,
      createNamesAction,
      createDescriptionsAction,
      createFlagsAction,

      createAgentsAction,
      createRunsAction,
      createGroupsAction,
      availableRuns,
      availableGroups,
      handleModelRunIdsChange,
      handleGroupIdsChange,
      handleRunRubricsChange,
      handleGroupRubricsChange,
      runLookup,
      groupLookup,
      s?.rubrics?.resources,
      s?.rubrics?.show,
      s?.rubrics?.show_ai_generate,
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

        {modalMode && (
          <GenerateRegenerateModal
            open={showGenerateModal}
            onOpenChange={setShowGenerateModal}
            resources={modalResources}
            onResourcesChange={setModalResources}
            instructions={modalInstructions}
            onInstructionsChange={setModalInstructions}
            onGenerate={handleModalGenerate}
            isGenerating={modalResources.some((r) =>
              isGenerating(r.id as EvalResourceType)
            )}
            mode={modalMode}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

export default React.memo(EvalComponent, (prevProps, nextProps) => {
  if (prevProps.evalId !== nextProps.evalId) {
    return false;
  }

  const prevEval = prevProps.evalDetail;
  const nextEval = nextProps.evalDetail;
  const toIds = (data?: EvalData) => ({
    name_id: data?.names?.resource?.id ?? null,
    description_id: data?.descriptions?.resource?.id ?? null,
    active_flag_id: data?.active_flags?.resource?.flag_option_id ?? null,
    dynamic_flag_id: data?.dynamic_flags?.resource?.flag_option_id ?? null,
    groups_flag_id: data?.groups_flags?.resource?.flag_option_id ?? null,
    department_ids:
      data?.departments?.current
        ?.map((d) => d.department_id)
        .filter(Boolean)
        .map(String) ?? [],
    agent_ids:
      data?.agents?.current
        ?.map((a) => a.id)
        .filter(Boolean)
        .map(String) ?? [],
    model_run_ids:
      data?.runs?.current
        ?.map((r) => r.model_run_id)
        .filter(Boolean)
        .map(String) ?? [],
    group_ids:
      data?.groups?.current
        ?.map((g) => g.group_id)
        .filter(Boolean)
        .map(String) ?? [],
    run_rubrics: JSON.stringify(data?.run_rubrics ?? []),
    group_rubrics: JSON.stringify(data?.group_rubrics ?? []),
  });

  const prevIds = toIds(prevEval);
  const nextIds = toIds(nextEval);

  if (JSON.stringify(prevIds) !== JSON.stringify(nextIds)) {
    return false;
  }

  return true;
});
