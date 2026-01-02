/**
 * Eval.tsx
 * Used to create and manage evals for the admin dashboard
 * Migrated to GenericForm pattern with nuqs and draft autosave
 */
"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { StepCard } from "@/components/common/forms/StepCard";
import { ModelRunCardGrid } from "@/components/common/evals/ModelRunCardGrid";
import { GroupCardGrid } from "@/components/common/evals/GroupCardGrid";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Check, Plus, Power, X } from "lucide-react";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

// Import types from new page (create action)
import type {
  CreateEvalIn,
  CreateEvalOut,
  EvalNewOut,
  PatchEvalDraftIn,
  PatchEvalDraftOut,
} from "@/app/(main)/engine/evals/new/page";
// Import types from edit page (update action)
import type {
  EvalDetailOut,
  UpdateEvalIn,
  UpdateEvalOut,
} from "@/app/(main)/engine/evals/e/[evalId]/page";

export interface EvalProps {
  evalId?: string;
  // Server-provided data (for server-side rendering)
  evalDetail?: EvalDetailOut;
  evalDetailDefault?: EvalNewOut;
  // Server actions (replaces useMutation)
  createEvalAction?: (input: CreateEvalIn) => Promise<CreateEvalOut>;
  updateEvalAction?: (input: UpdateEvalIn) => Promise<UpdateEvalOut>;
  // Draft action: Resource-specific prop name is acceptable since types are resource-specific
  patchEvalDraftAction?: (
    input: PatchEvalDraftIn
  ) => Promise<PatchEvalDraftOut>;
}

interface RubricGradeAgent {
  rubric_id: string;
  grade_text_agent_id: string;
}

function EvalComponent({
  evalId,
  evalDetail: serverEvalDetail,
  evalDetailDefault: serverEvalDetailDefault,
  createEvalAction,
  updateEvalAction,
  patchEvalDraftAction,
}: EvalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = !!evalId;
  const { effectiveProfile, selectedDraftId, setSelectedDraftId } =
    useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Stabilize server props to prevent unnecessary re-renders
  const stabilizeServerProp = React.useCallback(
    (
      data: typeof serverEvalDetail | typeof serverEvalDetailDefault
    ): string | null => {
      if (!data) return null;
      if (typeof data === "object" && data !== null) {
        if ("eval_id" in data && data.eval_id) {
          return `eval_id:${String(data.eval_id)}`;
        }
        const keyFields: Record<string, unknown> = {};
        if ("valid_department_ids" in data) {
          keyFields["valid_department_ids"] = Array.isArray(
            data["valid_department_ids"]
          )
            ? data["valid_department_ids"].sort().join(",")
            : data["valid_department_ids"];
        }
        if ("valid_agent_ids" in data) {
          keyFields["valid_agent_ids"] = Array.isArray(
            data["valid_agent_ids"]
          )
            ? data["valid_agent_ids"].sort().join(",")
            : data["valid_agent_ids"];
        }
        const sortedKeys = Object.keys(keyFields).sort();
        const hash = sortedKeys
          .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
          .join("|");
        return `new:${hash.length}:${hash.slice(0, 100)}`;
      }
      return String(data);
    },
    []
  );

  const evalDetailId = React.useMemo(
    () => stabilizeServerProp(serverEvalDetail),
    [serverEvalDetail, stabilizeServerProp]
  );
  const evalDetailDefaultId = React.useMemo(
    () => stabilizeServerProp(serverEvalDetailDefault),
    [serverEvalDetailDefault, stabilizeServerProp]
  );

  // Use refs to track latest server props
  const latestServerEvalDetailRef = React.useRef(serverEvalDetail);
  const latestServerEvalDetailDefaultRef = React.useRef(
    serverEvalDetailDefault
  );

  latestServerEvalDetailRef.current = serverEvalDetail;
  latestServerEvalDetailDefaultRef.current = serverEvalDetailDefault;

  // Use refs to track stable server props
  const stableEvalDetailRef = React.useRef<{
    data: typeof serverEvalDetail;
    id: string | null;
  }>({
    data: serverEvalDetail,
    id: evalDetailId,
  });
  const stableEvalDetailDefaultRef = React.useRef<{
    data: typeof serverEvalDetailDefault;
    id: string | null;
  }>({
    data: serverEvalDetailDefault,
    id: evalDetailDefaultId,
  });

  React.useEffect(() => {
    if (stableEvalDetailRef.current.id !== evalDetailId) {
      stableEvalDetailRef.current = {
        data: latestServerEvalDetailRef.current,
        id: evalDetailId,
      };
    }
  }, [evalDetailId]);

  React.useEffect(() => {
    if (stableEvalDetailDefaultRef.current.id !== evalDetailDefaultId) {
      stableEvalDetailDefaultRef.current = {
        data: latestServerEvalDetailDefaultRef.current,
        id: evalDetailDefaultId,
      };
    }
  }, [evalDetailDefaultId]);

  // Use stable references
  const evalDetail = stableEvalDetailRef.current.data;
  const evalDetailDefault = stableEvalDetailDefaultRef.current.data;

  // Use edit detail when editing, default detail when creating
  const evalDataId = React.useMemo(() => {
    const data = isEditMode ? evalDetail : evalDetailDefault;
    if (!data) return null;
    if (typeof data === "object" && data !== null) {
      if ("eval_id" in data && data.eval_id) {
        return `eval_id:${String(data.eval_id)}`;
      }
      const keyFields: Record<string, unknown> = {};
      if ("valid_department_ids" in data) {
        keyFields["valid_department_ids"] = Array.isArray(
          data["valid_department_ids"]
        )
          ? data["valid_department_ids"].sort().join(",")
          : data["valid_department_ids"];
      }
      if ("valid_agent_ids" in data) {
        keyFields["valid_agent_ids"] = Array.isArray(data["valid_agent_ids"])
          ? data["valid_agent_ids"].sort().join(",")
          : data["valid_agent_ids"];
      }
      const sortedKeys = Object.keys(keyFields).sort();
      const hash = sortedKeys
        .map((k) => `${k}:${JSON.stringify(keyFields[k])}`)
        .join("|");
      return `new:${hash.length}:${hash.slice(0, 100)}`;
    }
    return String(data);
  }, [isEditMode, evalDetail, evalDetailDefault]);

  const stableEvalDataRef = React.useRef<{
    data: typeof evalDetail | typeof evalDetailDefault;
    id: string | null;
  }>({
    data: isEditMode ? evalDetail : evalDetailDefault,
    id: evalDataId,
  });

  React.useEffect(() => {
    if (stableEvalDataRef.current.id !== evalDataId) {
      stableEvalDataRef.current = {
        data: isEditMode ? evalDetail : evalDetailDefault,
        id: evalDataId,
      };
    }
  }, [isEditMode, evalDetail, evalDetailDefault, evalDataId]);

  const evalData = stableEvalDataRef.current.data;

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primary_department_id ?? null
      ),
    [isSuperadmin, effectiveProfile?.primary_department_id]
  );

  // Inline parsers for URL-backed state (navigation/search params only)
  const evalSearchParamsClient = {
    // Draft ID (URL-backed, updated when draft is created)
    draftId: parseAsString,
    // Search params (URL-backed, updated via debounced callback in StepCard)
    agentSearch: parseAsString,
    agentShowSelected: parseAsBoolean,
    modelRunSearch: parseAsString,
    modelRunShowSelected: parseAsBoolean,
    groupSearch: parseAsString,
    groupShowSelected: parseAsBoolean,
  } as const;

  // URL-backed state using nuqs (only navigation/search params)
  const [urlParams, setUrlParams] = useQueryStates(evalSearchParamsClient, {
    history: "replace",
    shallow: true, // Use shallow routing to prevent server component re-renders
  });

  // Get draftId from URL (managed by nuqs via urlParams)
  const urlDraftId = urlParams.draftId || null;

  // Sync URL draftId to profile context
  useEffect(() => {
    if (urlDraftId !== selectedDraftId) {
      setSelectedDraftId(urlDraftId);
    }
  }, [urlDraftId, selectedDraftId, setSelectedDraftId]);

  const draftId = urlDraftId;

  // Local draft state (not in URL) - initialized from server data or draft payload
  type DraftState = {
    name: string;
    description: string;
    active: boolean;
    dynamic: boolean;
    use_groups: boolean;
    departmentIds: string[];
    agentIds: string[]; // Agents being evaluated
    modelRunIds: string[]; // Selected model runs
    groupIds: string[]; // Selected groups (if use_groups)
    // Nested structures for rubric_grade_agents
    rubricGradeAgents: RubricGradeAgent[]; // Global rubric/agent pairs
    runRubricGradeAgents: Record<string, RubricGradeAgent[]>; // Per-run pairs (run_id -> pairs)
    groupRubricGradeAgents: Record<string, RubricGradeAgent[]>; // Per-group pairs (group_id -> pairs)
  };

  // Initialize draft state from server data or draft payload
  const initialDraftState = useMemo((): DraftState => {
    const data = isEditMode ? evalDetail : evalDetailDefault;

    if (!data) {
    return {
      name: "",
      description: "",
      active: true,
      dynamic: false,
      use_groups: false,
        departmentIds: defaultDepartmentIds || [],
        agentIds: [],
        modelRunIds: [],
        groupIds: [],
        rubricGradeAgents: [],
        runRubricGradeAgents: {},
        groupRubricGradeAgents: {},
      };
    }

    // Initialize rubric_grade_agents from draft payload if available
    let rubricGradeAgents: RubricGradeAgent[] = [];
    let runRubricGradeAgents: Record<string, RubricGradeAgent[]> = {};
    let groupRubricGradeAgents: Record<string, RubricGradeAgent[]> = {};

    // Try to read from draft payload fields (returned by SQL when draft exists)
    if (data && "rubric_grade_agent_pairs" in data && data.rubric_grade_agent_pairs) {
      try {
        const parsed = typeof data.rubric_grade_agent_pairs === "string"
          ? JSON.parse(data.rubric_grade_agent_pairs)
          : data.rubric_grade_agent_pairs;
        if (parsed && typeof parsed === "object" && Array.isArray(parsed)) {
          rubricGradeAgents = parsed as RubricGradeAgent[];
        }
      } catch (e) {
        // Ignore parse errors, fall back to extracting from array data
      }
    }

    // Extract run rubric_grade_agents from draft payload
    if (data && "run_rubric_grade_agents" in data && data.run_rubric_grade_agents) {
      try {
        const parsed = typeof data.run_rubric_grade_agents === "string"
          ? JSON.parse(data.run_rubric_grade_agents)
          : data.run_rubric_grade_agents;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          runRubricGradeAgents = parsed as Record<string, RubricGradeAgent[]>;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Extract group rubric_grade_agents from draft payload
    if (data && "group_rubric_grade_agents" in data && data.group_rubric_grade_agents) {
      try {
        const parsed = typeof data.group_rubric_grade_agents === "string"
          ? JSON.parse(data.group_rubric_grade_agents)
          : data.group_rubric_grade_agents;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          groupRubricGradeAgents = parsed as Record<string, RubricGradeAgent[]>;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // If draft payload didn't have these fields, fall back to extracting from array data (edit mode only)
    if (
      rubricGradeAgents.length === 0 &&
      Object.keys(runRubricGradeAgents).length === 0 &&
      isEditMode &&
      evalDetail &&
      "model_runs" in evalDetail &&
      evalDetail.model_runs
    ) {
      // Extract from model_runs array
      evalDetail.model_runs.forEach((run: any) => {
        if (run.model_run_id && run.rubric_grade_agents) {
          runRubricGradeAgents[run.model_run_id] = (
            run.rubric_grade_agents || []
          ).map((rga: any) => ({
            rubric_id: rga.rubric_id,
            grade_text_agent_id: rga.agent_id,
          }));
        }
      });
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    const result = {
      name: data.name || "",
      description: data.description || "",
      active: data.active ?? true,
      dynamic: data.dynamic ?? false,
      use_groups: data.use_groups ?? false,
      departmentIds: data.department_ids || defaultDepartmentIds || [],
      agentIds: data.agent_ids || [],
      modelRunIds: data.model_run_ids || [],
      groupIds: [], // TODO: Extract when groups are implemented
      rubricGradeAgents,
      runRubricGradeAgents,
      groupRubricGradeAgents,
    };

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditMode,
    evalDetail,
    evalDetailDefault,
    evalDetailId,
    evalDetailDefaultId,
    draftId,
    urlDraftId,
    defaultDepartmentIds,
    // Include actual content fields so it recomputes when server data changes
    evalDetailDefault?.name,
    evalDetailDefault?.description,
    evalDetailDefault?.active,
    evalDetailDefault?.department_ids,
    evalDetailDefault?.agent_ids,
    evalDetailDefault?.model_run_ids,
    evalDetail?.name,
    evalDetail?.description,
    evalDetail?.active,
    evalDetail?.department_ids,
    evalDetail?.agent_ids,
    evalDetail?.model_runs,
  ]);

  const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

  // Track previous initialDraftState content to avoid unnecessary updates
  const prevInitialDraftStateRef = useRef<string>(
    JSON.stringify(initialDraftState)
  );

  // Update draft state when server data changes (e.g., draft selected)
  useEffect(() => {
    const currentStateStr = prevInitialDraftStateRef.current;
    const newStateStr = JSON.stringify(initialDraftState);

    if (currentStateStr !== newStateStr) {
      prevInitialDraftStateRef.current = newStateStr;
      setDraftState(initialDraftState);
    }
  }, [initialDraftState]);

  // Merge draftState with urlParams for formData (GenericForm expects single formData object)
  const formData = useMemo(() => {
    return {
      ...draftState,
      agentSearch: urlParams.agentSearch || null,
      agentShowSelected: urlParams.agentShowSelected ?? false,
      modelRunSearch: urlParams.modelRunSearch || null,
      modelRunShowSelected: urlParams.modelRunShowSelected ?? false,
      groupSearch: urlParams.groupSearch || null,
      groupShowSelected: urlParams.groupShowSelected ?? false,
    } as Record<string, unknown>;
  }, [
    draftState,
    urlParams.agentSearch,
    urlParams.agentShowSelected,
    urlParams.modelRunSearch,
    urlParams.modelRunShowSelected,
    urlParams.groupSearch,
    urlParams.groupShowSelected,
  ]);

  // Wrapper for setFormData that updates draftState for form fields, urlParams for navigation
  const setFormData = useCallback(
    (
      updates:
        | Partial<Record<string, unknown>>
        | ((prev: Record<string, unknown>) => Partial<Record<string, unknown>>)
    ) => {
      // Handle function form
      const resolvedUpdates =
        typeof updates === "function" ? updates(formData) : updates;

      const draftUpdates: Partial<DraftState> = {};
      const urlUpdates: Partial<Record<string, unknown>> = {};

      Object.entries(resolvedUpdates).forEach(([key, value]) => {
        if (
          key === "name" ||
          key === "description" ||
          key === "active" ||
          key === "dynamic" ||
          key === "use_groups" ||
          key === "departmentIds" ||
          key === "agentIds" ||
          key === "modelRunIds" ||
          key === "groupIds" ||
          key === "rubricGradeAgents" ||
          key === "runRubricGradeAgents" ||
          key === "groupRubricGradeAgents"
        ) {
          draftUpdates[key as keyof DraftState] = value as never;
        } else if (
          key === "agentSearch" ||
          key === "modelRunSearch" ||
          key === "groupSearch"
        ) {
          // Update URL params for search/filter operations
          urlUpdates[key] =
            (value as string) && (value as string).length > 0
              ? (value as string)
              : null;
        } else if (
          key === "agentShowSelected" ||
          key === "modelRunShowSelected" ||
          key === "groupShowSelected"
        ) {
          // Update URL params for filter operations
          urlUpdates[key] = value === true ? true : null;
        }
      });

      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }
      if (Object.keys(urlUpdates).length > 0) {
        // Check if URL params actually changed before updating
        const hasChanges = Object.keys(urlUpdates).some((key) => {
          const newValue = urlUpdates[key];
          const currentValue = urlParams[key as keyof typeof urlParams];
          return newValue !== currentValue;
        });

        if (hasChanges) {
          setUrlParams(urlUpdates as Parameters<typeof setUrlParams>[0]);
        }
      }
    },
    [formData, setUrlParams, urlParams]
  );

  // Set breadcrumb context when eval data is loaded
  useEffect(() => {
    if (evalDetail?.name && evalId && isEditMode) {
      setEntityMetadata({
        entityId: evalId,
        entityName: evalDetail.name,
        entityType: "eval",
      });
    }
    return () => clearEntityMetadata();
  }, [
    evalDetail,
    evalId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Draft autosave integration
  const {
    saveStatus: _saveStatus,
    saveNow: _saveNow,
    lastSavedVersion: _lastSavedVersion,
  } = useDraftAutosave({
    draftId,
    draftState,
    initialVersion: evalData?.draft_version ?? 0,
    patchDraftAction: patchEvalDraftAction
      ? async (input) => {
          // Transform camelCase keys to snake_case for draft payload (SQL expects snake_case)
          const camelToSnake: Record<string, string> = {
            departmentIds: "department_ids",
            agentIds: "agent_ids",
            modelRunIds: "model_run_ids",
            groupIds: "group_ids",
            rubricGradeAgents: "rubric_grade_agents",
            runRubricGradeAgents: "run_rubric_grade_agents",
            groupRubricGradeAgents: "group_rubric_grade_agents",
          };
          const transformedPatch: Record<string, unknown> = {};
          Object.entries(input.body.patch as Record<string, unknown>).forEach(
            ([key, value]) => {
              const snakeKey = camelToSnake[key] || key;
              transformedPatch[snakeKey] = value;
            }
          );

          // Transform input to match API structure (API uses input_draft_id, patch, expected_version)
          // Note: profile_id is added server-side from header
          const result = await patchEvalDraftAction({
            body: {
              input_draft_id: input.body.draft_id || null,
              patch: transformedPatch,
              expected_version: input.body.expected_version,
            } as PatchEvalDraftIn["body"],
          });
          // Transform response to match hook expectations (API returns draft_id, new_version, draft_exists)
          return {
            draftId: result.draft_id || "",
            newVersion: result.new_version || 0,
            draftExists: result.draft_exists || false,
          };
        }
      : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
    debounceMs: 1000,
    onDraftCreated: useCallback(
      (newDraftId: string) => {
        // Only update URL if draftId actually changed
        const currentUrlDraftId = searchParams.get("draftId");
        if (newDraftId === currentUrlDraftId) {
          return;
        }
        // Update URL with new draftId and trigger server-side refetch
        // This ensures the server component gets fresh data with the new draft
        const params = new URLSearchParams(searchParams.toString());
        params.set("draftId", newDraftId);
        const newUrl = `?${params.toString()}`;
        router.replace(newUrl, { scroll: false });
        // Force server components to re-render with updated search params
        router.refresh();
      },
      [router, searchParams]
    ),
  });

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !evalData) return false;
    return !evalData.can_edit;
  }, [isEditMode, evalData]);

  // Get valid agent IDs (agents being evaluated) - filtered by departments
  const validAgentIds = useMemo(() => {
    const baseIds = evalData?.valid_agent_ids || [];
    const selectedDeptIds = draftState.departmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Filter by department access (agents should be accessible based on departments)
    // For now, return all baseIds since agent filtering by department is handled server-side
    return baseIds;
  }, [evalData?.valid_agent_ids, draftState.departmentIds]);

  // Get valid rubric IDs
  const validRubricIds = useMemo(() => {
    return evalData?.valid_rubric_ids || [];
  }, [evalData?.valid_rubric_ids]);

  // Get eval agents array (agents with 'eval' role) - prefer eval_agents, fallback to agents
  const evalAgentsArray = useMemo(() => {
    return evalData?.eval_agents && evalData.eval_agents.length > 0
      ? evalData.eval_agents
      : evalData?.agents || [];
  }, [evalData?.eval_agents, evalData?.agents]);

  const validEvalAgentIds = useMemo(() => {
    return evalData?.valid_eval_agent_ids || evalData?.valid_agent_ids || [];
  }, [evalData?.valid_eval_agent_ids, evalData?.valid_agent_ids]);

  // Form initialization function for GenericForm
  const initializeForm = useCallback(
    (serverData: unknown, editMode: boolean) => {
      if (
        !editMode ||
        !serverData ||
        typeof serverData !== "object" ||
        !("name" in serverData)
      ) {
        return {};
      }

      const evalDetailData = serverData as EvalDetailOut;
      const deptIds = evalDetailData.department_ids || [];
      const agentIds = evalDetailData.agent_ids || [];
      const modelRunIds = evalDetailData.model_runs?.map((mr: any) => mr.model_run_id) || [];

      // Initialize rubric_grade_agents from model_runs
      const runRubricGradeAgents: Record<string, RubricGradeAgent[]> = {};
      if (evalDetailData.model_runs) {
        evalDetailData.model_runs.forEach((run: any) => {
          if (run.model_run_id && run.rubric_grade_agents) {
            runRubricGradeAgents[run.model_run_id] = (
              run.rubric_grade_agents || []
            ).map((rga: any) => ({
              rubric_id: rga.rubric_id,
              grade_text_agent_id: rga.agent_id,
            }));
          }
        });
      }

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (evalDetailData.name) draftUpdates.name = evalDetailData.name;
      if (evalDetailData.description)
        draftUpdates.description = evalDetailData.description;
      if (evalDetailData.active !== undefined)
        draftUpdates.active = evalDetailData.active ?? true;
      if (evalDetailData.dynamic !== undefined)
        draftUpdates.dynamic = evalDetailData.dynamic ?? false;
      if (evalDetailData.use_groups !== undefined)
        draftUpdates.use_groups = evalDetailData.use_groups ?? false;
      if (deptIds.length > 0) draftUpdates["departmentIds"] = deptIds;
      if (agentIds.length > 0) draftUpdates["agentIds"] = agentIds;
      if (modelRunIds.length > 0) draftUpdates["modelRunIds"] = modelRunIds;
      if (Object.keys(runRubricGradeAgents).length > 0)
        draftUpdates.runRubricGradeAgents = runRubricGradeAgents;

      // Apply updates to draftState
      if (Object.keys(draftUpdates).length > 0) {
        setDraftState((prev) => ({ ...prev, ...draftUpdates }));
      }

      // Return empty object for GenericForm compatibility (form fields are handled via draftState)
      return {};
    },
    []
  );

  // Submit handler for GenericForm (uses draftState, not formData parameter)
  const handleSubmit = useCallback(
    async (_formData: Record<string, unknown>) => {
      if (!draftState.name?.trim()) {
        toast.error("Eval name is required");
        throw new Error("Eval name is required");
      }

      if (draftState.agentIds.length === 0) {
      toast.error("Please select at least one agent");
        throw new Error("At least one agent is required");
      }

      // Validate rubric_grade_agents based on use_groups
      if (draftState.use_groups) {
        if (draftState.groupIds.length === 0) {
        toast.error("Please select at least one group");
          throw new Error("At least one group is required");
      }
        for (const groupId of draftState.groupIds) {
          const pairs = draftState.groupRubricGradeAgents[groupId] || [];
          if (pairs.length === 0) {
          toast.error(
              `Please add at least one rubric and grading agent pair for group ${groupId.slice(0, 8)}`
          );
            throw new Error(`Missing rubric/agent pairs for group ${groupId}`);
        }
          for (const rga of pairs) {
          if (!rga.rubric_id || !rga.grade_text_agent_id) {
            toast.error("Each rubric must have a grading agent selected");
              throw new Error("Invalid rubric/agent pair");
          }
        }
      }
    } else {
        if (draftState.modelRunIds.length === 0) {
        toast.error("Please select at least one model run");
          throw new Error("At least one model run is required");
      }
        for (const runId of draftState.modelRunIds) {
          const pairs = draftState.runRubricGradeAgents[runId] || [];
          if (pairs.length === 0) {
          toast.error(
              `Please add at least one rubric and grading agent pair for run ${runId.slice(0, 8)}`
          );
            throw new Error(`Missing rubric/agent pairs for run ${runId}`);
        }
          for (const rga of pairs) {
          if (!rga.rubric_id || !rga.grade_text_agent_id) {
            toast.error("Each rubric must have a grading agent selected");
              throw new Error("Invalid rubric/agent pair");
            }
          }
        }
      }

      const validDepartmentIds = evalData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        draftState.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      // Extract body types for type safety
      type CreateEvalBody = CreateEvalIn extends { body: infer B }
        ? B
        : never;
      type UpdateEvalBody = UpdateEvalIn extends { body: infer B }
        ? B
        : never;

      if (isEditMode) {
        if (!updateEvalAction) {
          toast.error("Update action not available");
          throw new Error("Update action not available");
        }
        try {
        const updateRequest: UpdateEvalBody = {
            eval_id: evalId!,
            name: draftState.name || "",
            description: draftState.description || "",
            agent_ids: draftState.agentIds,
            use_groups: draftState.use_groups ?? false,
          department_ids: finalDepartmentIds || [],
            active: draftState.active ?? true,
            dynamic: draftState.dynamic ?? false,
            model_run_ids: draftState.use_groups
              ? []
              : draftState.modelRunIds,
          };
          await updateEvalAction({ body: updateRequest });

        // TODO: Call separate endpoints to add runs/groups with rubric_grade_agents
        // For now, this is a placeholder - full implementation requires API endpoints for add_eval_runs/add_eval_groups
        toast.success("Eval updated successfully!");
          router.push("/engine/evals");
        } catch (error) {
          toast.error(
            `Failed to update eval: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      } else {
        if (!createEvalAction) {
          toast.error("Create action not available");
          throw new Error("Create action not available");
        }
        try {
        const createRequest: CreateEvalBody = {
            name: draftState.name || "",
            description: draftState.description || "",
            agent_ids: draftState.agentIds,
            use_groups: draftState.use_groups ?? false,
          department_ids: finalDepartmentIds || [],
            active: draftState.active || true,
            dynamic: draftState.dynamic || false,
            model_run_ids: draftState.use_groups
              ? []
              : draftState.modelRunIds,
          };
          await createEvalAction({ body: createRequest });

        // TODO: Call separate endpoints to add runs/groups with rubric_grade_agents
        // For now, this is a placeholder - full implementation requires API endpoints for add_eval_runs/add_eval_groups
        toast.success("Eval created successfully!");
          router.push("/engine/evals");
    } catch (error) {
      toast.error(
            `Failed to create eval: ${error instanceof Error ? error.message : "Unknown error"}`
          );
          throw error;
        }
      }
    },
    [
      draftState,
      isEditMode,
      evalId,
      isSuperadmin,
      evalData,
      updateEvalAction,
      createEvalAction,
      router,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(
        formData["name"] as string | null | undefined
      )?.trim();
      const hasAgents =
        ((formData["agentIds"] as string[] | null | undefined) || []).length >
        0;
      const hasRubricGradeAgents =
        ((formData["rubricGradeAgents"] as RubricGradeAgent[] | null | undefined) || []).length > 0;
      const useGroups = (formData["use_groups"] as boolean | null | undefined) ?? false;
      
      // Check if runs/groups have rubric_grade_agents based on use_groups
      let hasRunOrGroupRubricGradeAgents = false;
      if (useGroups) {
        const groupIds = (formData["groupIds"] as string[] | null | undefined) || [];
        const groupRubricGradeAgents = (formData["groupRubricGradeAgents"] as Record<string, RubricGradeAgent[]> | null | undefined) || {};
        hasRunOrGroupRubricGradeAgents = groupIds.length > 0 &&
          groupIds.every((groupId) => {
            const pairs = groupRubricGradeAgents[groupId] || [];
            return pairs.length > 0 && pairs.every((rga) => rga.rubric_id && rga.grade_text_agent_id);
          });
      } else {
        const modelRunIds = (formData["modelRunIds"] as string[] | null | undefined) || [];
        const runRubricGradeAgents = (formData["runRubricGradeAgents"] as Record<string, RubricGradeAgent[]> | null | undefined) || {};
        hasRunOrGroupRubricGradeAgents = modelRunIds.length > 0 &&
          modelRunIds.every((runId) => {
            const pairs = runRubricGradeAgents[runId] || [];
            return pairs.length > 0 && pairs.every((rga) => rga.rubric_id && rga.grade_text_agent_id);
          });
      }

      const hasRunsOrGroups = useGroups
        ? ((formData["groupIds"] as string[] | null | undefined) || []).length > 0
        : ((formData["modelRunIds"] as string[] | null | undefined) || []).length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasRubricGradeAgents ? "completed" : "active";
        case "agents":
          if (!hasName || !hasRubricGradeAgents) return "pending";
          return hasAgents ? "completed" : "active";
        case "modelRuns":
          if (!hasAgents) return "pending";
          return hasRunsOrGroups && hasRunOrGroupRubricGradeAgents ? "completed" : "active";
        case "groups":
          if (!hasAgents) return "pending";
          return hasRunsOrGroups && hasRunOrGroupRubricGradeAgents ? "completed" : "active";
        default:
          return "pending";
      }
    },
    []
  );

  // Steps configuration for GenericForm
  const steps = useMemo(
    () => [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the eval name, description, departments, active status, dynamic mode, and rubric/agent pairs.",
        resetFields: [
          "name",
          "description",
          "departmentIds",
          "active",
          "dynamic",
          "rubricGradeAgents",
        ] as string[],
      },
      {
        id: "agents",
        title: "Agents",
        description: "Select agents to evaluate.",
        resetFields: [
          "agentIds",
          "agentSearch",
          "agentShowSelected",
        ] as (keyof typeof evalSearchParamsClient)[],
      },
      {
        id: "modelRuns",
        title: "Model Runs",
        description: "Select model runs to evaluate.",
        resetFields: [
          "modelRunIds",
          "runRubricGradeAgents",
          "modelRunSearch",
          "modelRunShowSelected",
        ] as (keyof typeof evalSearchParamsClient | string)[],
      },
      {
        id: "groups",
        title: "Groups",
        description: "Select groups to evaluate.",
        resetFields: [
          "groupIds",
          "groupRubricGradeAgents",
          "groupSearch",
          "groupShowSelected",
        ] as (keyof typeof evalSearchParamsClient | string)[],
      },
    ],
    []
  );

  // Memoize formFieldKeys to prevent re-initialization loops
  const formFieldKeys = useMemo(
    () => [
      "name",
      "description",
      "active",
      "dynamic",
      "use_groups",
      "departmentIds",
      "agentIds",
      "modelRunIds",
      "groupIds",
      "rubricGradeAgents",
      "runRubricGradeAgents",
      "groupRubricGradeAgents",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "agents":
        return "Agents reset";
      case "modelRuns":
        return "Model runs reset";
      case "groups":
        return "Groups reset";
      default:
        return "Reset";
    }
  }, []);

  // Memoize submitButton to prevent GenericForm re-renders
  const submitButton = useMemo(
    () => ({
      backUrl: "/engine/evals",
      backLabel: "Back",
      createLabel: "Create Eval",
      updateLabel: "Update Eval",
    }),
    []
  );

  // Handler functions for rubric/agent pairs
  const handleAddRubricGradeAgent = useCallback(() => {
    setDraftState((prev) => ({
      ...prev,
      rubricGradeAgents: [
        ...prev.rubricGradeAgents,
        { rubric_id: "", grade_text_agent_id: "" },
      ],
    }));
  }, []);

  const handleRemoveRubricGradeAgent = useCallback((index: number) => {
    setDraftState((prev) => ({
      ...prev,
      rubricGradeAgents: prev.rubricGradeAgents.filter((_, i) => i !== index),
    }));
  }, []);

  const handleUpdateRubricGradeAgent = useCallback(
    (
      index: number,
      field: "rubric_id" | "grade_text_agent_id",
      value: string
    ) => {
      setDraftState((prev) => {
        const updated = [...prev.rubricGradeAgents];
        updated[index] = { ...updated[index], [field]: value };
        return { ...prev, rubricGradeAgents: updated };
      });
    },
    []
  );

  const handleAddRubricGradeAgentToRun = useCallback((runId: string) => {
    setDraftState((prev) => {
      const currentPairs = prev.runRubricGradeAgents[runId] || [];
      return {
        ...prev,
        runRubricGradeAgents: {
          ...prev.runRubricGradeAgents,
          [runId]: [
            ...currentPairs,
            { rubric_id: "", grade_text_agent_id: "" },
          ],
        },
      };
    });
  }, []);

  const handleRemoveRubricGradeAgentFromRun = useCallback(
    (runId: string, index: number) => {
      setDraftState((prev) => {
        const currentPairs = prev.runRubricGradeAgents[runId] || [];
        return {
          ...prev,
          runRubricGradeAgents: {
            ...prev.runRubricGradeAgents,
            [runId]: currentPairs.filter((_, i) => i !== index),
          },
        };
      });
    },
    []
  );

  const handleUpdateRubricGradeAgentInRun = useCallback(
    (
      runId: string,
      index: number,
      field: "rubric_id" | "grade_text_agent_id",
      value: string
    ) => {
      setDraftState((prev) => {
        const currentPairs = prev.runRubricGradeAgents[runId] || [];
        const updated = [...currentPairs];
        updated[index] = { ...updated[index], [field]: value };
        return {
          ...prev,
          runRubricGradeAgents: {
            ...prev.runRubricGradeAgents,
            [runId]: updated,
          },
        };
      });
    },
    []
  );

  const handleAddRubricGradeAgentToGroup = useCallback((groupId: string) => {
    setDraftState((prev) => {
      const currentPairs = prev.groupRubricGradeAgents[groupId] || [];
      return {
        ...prev,
        groupRubricGradeAgents: {
          ...prev.groupRubricGradeAgents,
          [groupId]: [
            ...currentPairs,
            { rubric_id: "", grade_text_agent_id: "" },
          ],
        },
      };
    });
  }, []);

  const handleRemoveRubricGradeAgentFromGroup = useCallback(
    (groupId: string, index: number) => {
      setDraftState((prev) => {
        const currentPairs = prev.groupRubricGradeAgents[groupId] || [];
        return {
          ...prev,
          groupRubricGradeAgents: {
            ...prev.groupRubricGradeAgents,
            [groupId]: currentPairs.filter((_, i) => i !== index),
          },
        };
      });
    },
    []
  );

  const handleUpdateRubricGradeAgentInGroup = useCallback(
    (
      groupId: string,
      index: number,
      field: "rubric_id" | "grade_text_agent_id",
      value: string
    ) => {
      setDraftState((prev) => {
        const currentPairs = prev.groupRubricGradeAgents[groupId] || [];
        const updated = [...currentPairs];
        updated[index] = { ...updated[index], [field]: value };
        return {
          ...prev,
          groupRubricGradeAgents: {
            ...prev.groupRubricGradeAgents,
            [groupId]: updated,
          },
        };
      });
    },
    []
  );

  // Memoize renderStep to prevent GenericForm re-renders
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
        case "basic":
  return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              editableTitle={{
                value:
                  (stepFormData["name"] as string | null | undefined) ?? "",
                onChange: (value) => setStepFormData({ name: value || null }),
                placeholder: "New Eval",
                defaultName: "New Eval",
                required: true,
              }}
              resetFields={
                [
                  "name",
                  "description",
                  "departmentIds",
                  "active",
                  "dynamic",
                  "rubricGradeAgents",
                ] as string[]
              }
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-eval-description"
                    value={
                      (stepFormData["description"] as
                        | string
                        | null
                        | undefined) || ""
                    }
                  onChange={(e) =>
                      setStepFormData({
                        description: e.target.value || null,
                      })
                  }
                  placeholder="Enter a brief description (optional)"
                  rows={3}
                  disabled={isReadonly}
                />
            </div>

            {/* Department Selection */}
            {evalData?.valid_department_ids &&
                evalData.valid_department_ids.length > 1 ? (
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                    <GenericPicker
                      items={evalData?.departments || []}
                      itemIds={evalData?.valid_department_ids || []}
                      selectedIds={
                        (stepFormData["departmentIds"] as
                          | string[]
                          | null
                          | undefined) || []
                      }
                      onSelect={(ids) =>
                        setStepFormData({
                          departmentIds: ids.length > 0 ? ids : null,
                        })
                      }
                      getId={(dept) => dept.department_id}
                      getLabel={(dept) => dept.name || ""}
                      getSearchText={(dept) =>
                        `${dept.name} ${dept.description || ""}`
                      }
                      placeholder="All Departments"
                      disabled={isReadonly}
                      multiSelect={true}
                      hideSelectedChips={true}
                      buttonClassName="w-full"
                    />
                </div>
                ) : null}

            {/* Rubrics and Grading Agents */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Rubrics and Grading Agents</Label>
                {!isReadonly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddRubricGradeAgent}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pair
                  </Button>
                )}
              </div>
                  {((stepFormData["rubricGradeAgents"] as RubricGradeAgent[] | null | undefined) || []).length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                  No rubric/agent pairs added. Click "Add Pair" to add one.
                </div>
              ) : (
                <div className="space-y-4">
                      {((stepFormData["rubricGradeAgents"] as RubricGradeAgent[] | null | undefined) || []).map((rga, index) => (
                    <Card key={index} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            Pair {index + 1}
                          </span>
                          {!isReadonly && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRemoveRubricGradeAgent(index)
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Rubric Selection */}
                          <div className="space-y-2">
                            <Label htmlFor={`rubric-${index}`}>Rubric</Label>
                            <GenericPicker
                              items={evalData?.rubrics || []}
                              itemIds={validRubricIds}
                              selectedIds={rga.rubric_id ? [rga.rubric_id] : []}
                              onSelect={(ids) =>
                                handleUpdateRubricGradeAgent(
                                  index,
                                  "rubric_id",
                                  ids[0] || ""
                                )
                              }
                              getId={(item) => item.rubric_id}
                              getLabel={(item) => item.name || ""}
                              getSearchText={(item) =>
                                `${item.name} ${item.description || ""}`
                              }
                              placeholder="Select rubric"
                              disabled={isReadonly}
                              multiSelect={false}
                              hideSelectedChips={true}
                              buttonClassName="w-full"
                            />
                          </div>
                          {/* Grading Agent Selection */}
                          <div className="space-y-2">
                            <Label htmlFor={`agent-${index}`}>
                              Grading Agent
                            </Label>
                            <GenericPicker
                              items={evalAgentsArray}
                              itemIds={validEvalAgentIds}
                              selectedIds={
                                rga.grade_text_agent_id
                                  ? [rga.grade_text_agent_id]
                                  : []
                              }
                              onSelect={(ids) =>
                                handleUpdateRubricGradeAgent(
                                  index,
                                  "grade_text_agent_id",
                                  ids[0] || ""
                                )
                              }
                              getId={(item) => item.agent_id}
                              getLabel={(item) => item.name || ""}
                              getSearchText={(item) =>
                                `${item.name} ${item.description || ""}`
                              }
                              placeholder="Select grading agent"
                              disabled={isReadonly}
                              multiSelect={false}
                              hideSelectedChips={true}
                              buttonClassName="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Active Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="active"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    Active
                  </Label>
                    <Switch
                      id="active"
                        checked={
                          (stepFormData["active"] as
                            | boolean
                            | null
                            | undefined) ??
                          (evalData as { active?: boolean })?.active ??
                          true
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ active: checked })
                        }
                      disabled={isReadonly}
                      data-testid="switch-eval-active"
                    />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive evals will not be shown
                </p>
              </div>
            </div>

            {/* Dynamic Switch */}
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="dynamic"
                    className="text-sm flex items-center gap-1.5"
                  >
                    Dynamic
                  </Label>
                    <Switch
                      id="dynamic"
                        checked={
                          (stepFormData["dynamic"] as
                            | boolean
                            | null
                            | undefined) ??
                          (evalData as { dynamic?: boolean })?.dynamic ??
                          false
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ dynamic: checked })
                        }
                      disabled={isReadonly}
                      data-testid="switch-eval-dynamic"
                    />
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                      When enabled, the agent being evaluated will be re-run
                      with a modified system prompt before grading
                </p>
              </div>
            </div>

                {/* Use Groups Switch */}
                <div className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="use_groups"
                        className="text-sm flex items-center gap-1.5"
                      >
                        Use Groups
                      </Label>
                      <Switch
                        id="use_groups"
                        checked={
                          (stepFormData["use_groups"] as
                            | boolean
                            | null
                            | undefined) ??
                          (evalData as { use_groups?: boolean })?.use_groups ??
                          false
                        }
                        onCheckedChange={(checked) =>
                          setStepFormData({ use_groups: checked })
                        }
                        disabled={isReadonly}
                        data-testid="switch-eval-use-groups"
                      />
              </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      When enabled, evaluate groups instead of individual model runs
                    </p>
              </div>
            </div>
                </div>
            </StepCard>
          );

        case "agents": {
          const agentShowSelected =
            (stepFormData["agentShowSelected"] as
              | boolean
              | null
              | undefined) ?? false;
          const selectedAgentIds =
            (stepFormData["agentIds"] as string[] | null | undefined) || [];
          const agentSearch =
            (stepFormData["agentSearch"] as string | null | undefined) || "";

          // Filter agents: department-based + client-side search/show_selected
          let filteredAgents = (evalData?.agents || []).filter((agent) =>
            validAgentIds.includes(agent.agent_id)
          );

          // Apply client-side search filter
          if (agentSearch.trim()) {
            const searchLower = agentSearch.toLowerCase();
            filteredAgents = filteredAgents.filter(
              (agent) =>
                agent.name?.toLowerCase().includes(searchLower) ||
                (agent.description || "").toLowerCase().includes(searchLower)
            );
          }

          // Apply client-side "show selected" filter
          if (agentShowSelected && selectedAgentIds.length > 0) {
            filteredAgents = filteredAgents.filter((agent) =>
              selectedAgentIds.includes(agent.agent_id)
            );
          }

          const createAgentFilterOnChange = (value: boolean) => {
            setStepFormData({ agentShowSelected: value });
          };

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              searchTerm={
                (stepFormData["agentSearch"] as
                  | string
                  | null
                  | undefined) || ""
              }
              onSearchChange={(term: string) =>
                setStepFormData({ agentSearch: term || null })
              }
              searchPlaceholder="Search agents..."
              debounceMs={300}
              filters={[
                {
                  key: "showSelected",
                  label: "Show selected",
                  value: agentShowSelected,
                  onChange: createAgentFilterOnChange,
                },
              ]}
              resetFields={[
                "agentIds",
                "agentSearch",
                "agentShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              <SelectableGrid
                items={filteredAgents}
                selectedId={null}
                selectedIds={selectedAgentIds}
                onSelect={(agentId) => {
                  const isSelected = selectedAgentIds.includes(agentId);
                  const newIds = isSelected
                    ? selectedAgentIds.filter((id) => id !== agentId)
                    : [...selectedAgentIds, agentId];
                  setStepFormData({
                    agentIds: newIds.length > 0 ? newIds : null,
                  });
                }}
                getId={(agent) => agent.agent_id}
                renderItem={(agent, isSelected) => (
                <div
                  className={cn(
                      "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                      "hover:shadow-md hover:bg-accent/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected && "ring-2 ring-primary bg-accent"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm leading-tight">
                          {agent.name || "Unnamed Agent"}
                        </h3>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {agent.description}
                          </p>
                  )}
                </div>
                </div>
              </div>
                )}
                emptyMessage="No agents found. Try adjusting your search or filters."
                disabled={isReadonly}
              />
            </StepCard>
          );
        }

        case "modelRuns": {
          // Only show if not using groups
          const useGroups = (stepFormData["use_groups"] as boolean | null | undefined) ?? false;
          if (useGroups) {
            return null;
          }

          const selectedModelRunIds =
            (stepFormData["modelRunIds"] as string[] | null | undefined) || [];
          const selectedAgentIds =
            (stepFormData["agentIds"] as string[] | null | undefined) || [];

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={[
                "modelRunIds",
                "runRubricGradeAgents",
                "modelRunSearch",
                "modelRunShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              {effectiveProfile?.id && (
                <ModelRunCardGrid
                  profileId={effectiveProfile.id}
                  selectedModelRunIds={selectedModelRunIds}
                  onSelect={(ids) => {
                    // Update modelRunIds and runRubricGradeAgents atomically
                    setDraftState((prev) => {
                      const existingRunIds = new Set(Object.keys(prev.runRubricGradeAgents));
                      const newRunIds = new Set(ids);
                      
                      // Remove runs that are no longer selected
                      const updatedRunRubricGradeAgents: Record<string, RubricGradeAgent[]> = {};
                      Object.entries(prev.runRubricGradeAgents).forEach(([runId, pairs]) => {
                        if (newRunIds.has(runId)) {
                          updatedRunRubricGradeAgents[runId] = pairs;
                        }
                      });
                      
                      // Add new runs that weren't in the list
                      ids.forEach((runId) => {
                        if (!existingRunIds.has(runId)) {
                          updatedRunRubricGradeAgents[runId] = [];
                        }
                      });
                      
                      return {
                        ...prev,
                        modelRunIds: ids,
                        runRubricGradeAgents: updatedRunRubricGradeAgents,
                      };
                    });
                    // Also update formData for GenericForm
                    setStepFormData({ modelRunIds: ids.length > 0 ? ids : null });
                  }}
                  agentIds={selectedAgentIds}
                  readonly={isReadonly}
                  evalId={evalId || undefined}
                />
              )}
            </StepCard>
          );
        }

        case "groups": {
          // Only show if using groups
          const useGroups = (stepFormData["use_groups"] as boolean | null | undefined) ?? false;
          if (!useGroups) {
            return null;
          }

          const selectedGroupIds =
            (stepFormData["groupIds"] as string[] | null | undefined) || [];

          return (
            <StepCard
              stepStatus={stepStatus}
              stepNumber={stepNumber}
              stepTitle={stepTitle}
              stepDescription={stepDescription}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
              resetFields={[
                "groupIds",
                "groupRubricGradeAgents",
                "groupSearch",
                "groupShowSelected",
              ]}
              {...(onReset ? { onReset } : {})}
              resetLabel="Reset"
            >
              {effectiveProfile?.id && (
                <GroupCardGrid
                    profileId={effectiveProfile.id}
                  selectedGroupIds={selectedGroupIds}
                  onSelect={(ids) => {
                    // Update groupIds and groupRubricGradeAgents atomically
                    setDraftState((prev) => {
                      const existingGroupIds = new Set(Object.keys(prev.groupRubricGradeAgents));
                      const newGroupIds = new Set(ids);
                      
                      // Remove groups that are no longer selected
                      const updatedGroupRubricGradeAgents: Record<string, RubricGradeAgent[]> = {};
                      Object.entries(prev.groupRubricGradeAgents).forEach(([groupId, pairs]) => {
                        if (newGroupIds.has(groupId)) {
                          updatedGroupRubricGradeAgents[groupId] = pairs;
                        }
                      });
                      
                      // Add new groups that weren't in the list
                      ids.forEach((groupId) => {
                        if (!existingGroupIds.has(groupId)) {
                          updatedGroupRubricGradeAgents[groupId] = [];
                        }
                      });
                      
                      return {
                        ...prev,
                        groupIds: ids,
                        groupRubricGradeAgents: updatedGroupRubricGradeAgents,
                      };
                    });
                    // Also update formData for GenericForm
                    setStepFormData({ groupIds: ids.length > 0 ? ids : null });
                  }}
                    readonly={isReadonly}
                  evalId={evalId || undefined}
                />
              )}
            </StepCard>
          );
        }

        default:
          return null;
      }
    },
    [
      evalData,
      validAgentIds,
      validRubricIds,
      evalAgentsArray,
      validEvalAgentIds,
      isReadonly,
      isEditMode,
      effectiveProfile?.id,
      handleAddRubricGradeAgent,
      handleRemoveRubricGradeAgent,
      handleUpdateRubricGradeAgent,
    ]
  );

  // Content sections for nested rubric/agent pair management
  const contentSections = useMemo(() => {
    const useGroups = draftState.use_groups ?? false;
    const modelRunIds = draftState.modelRunIds || [];
    const groupIds = draftState.groupIds || [];

    if (useGroups && groupIds.length === 0) {
      return [];
    }
    if (!useGroups && modelRunIds.length === 0) {
      return [];
    }

    const sections: Array<{
      id: string;
      insertAfter: string;
      render: (props: {
        formData: Record<string, unknown>;
        setFormData: (updates: Partial<Record<string, unknown>>) => void;
      }) => React.ReactNode;
    }> = [];

    if (useGroups) {
      // Add section for group rubric/agent pairs
      sections.push({
        id: "group-rubric-agent-pairs",
        insertAfter: "groups",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const groupRubricGradeAgents =
            (contentFormData["groupRubricGradeAgents"] as
              | Record<string, RubricGradeAgent[]>
              | null
              | undefined) || {};
          const groupIds =
            (contentFormData["groupIds"] as string[] | null | undefined) || [];

                          return (
            <StepCard
              stepStatus="completed"
              stepNumber={4}
              stepTitle="Rubrics and Grading Agents per Group"
              stepDescription="Configure rubric and grading agent pairs for each group."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="space-y-4">
                {groupIds.map((groupId) => {
                  const pairs = groupRubricGradeAgents[groupId] || [];
                  return (
                    <Card key={groupId} className="p-4">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                            Group {groupId.slice(0, 8)}
                                  </span>
                                </div>

                        {pairs.length === 0 ? (
                                  <div className="text-sm text-muted-foreground py-2 text-center border border-dashed rounded-md">
                            No rubric/agent pairs added. Click "Add Pair" to add
                            one.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                            {pairs.map((rga, index) => (
                                        <div
                                          key={index}
                                          className="grid grid-cols-2 gap-4 p-3 border rounded-md"
                                        >
                                          <div className="space-y-2">
                                            <Label
                                    htmlFor={`rubric-${groupId}-${index}`}
                                            >
                                              Rubric
                                            </Label>
                                            <GenericPicker
                                              items={evalData?.rubrics || []}
                                              itemIds={validRubricIds}
                                              selectedIds={
                                      rga.rubric_id ? [rga.rubric_id] : []
                                              }
                                              onSelect={(ids) =>
                                      handleUpdateRubricGradeAgentInGroup(
                                        groupId,
                                                  index,
                                                  "rubric_id",
                                                  ids[0] || ""
                                                )
                                              }
                                              getId={(item) => item.rubric_id}
                                    getLabel={(item) => item.name || ""}
                                              getSearchText={(item) =>
                                                `${item.name} ${item.description || ""}`
                                              }
                                              placeholder="Select rubric"
                                              disabled={isReadonly}
                                              multiSelect={false}
                                              hideSelectedChips={true}
                                              buttonClassName="w-full"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <Label
                                      htmlFor={`agent-${groupId}-${index}`}
                                              >
                                                Grading Agent
                                              </Label>
                                              {!isReadonly && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() =>
                                          handleRemoveRubricGradeAgentFromGroup(
                                            groupId,
                                                      index
                                                    )
                                                  }
                                                >
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                            <GenericPicker
                                              items={evalAgentsArray}
                                              itemIds={validEvalAgentIds}
                                              selectedIds={
                                                rga.grade_text_agent_id
                                                  ? [rga.grade_text_agent_id]
                                                  : []
                                              }
                                              onSelect={(ids) =>
                                      handleUpdateRubricGradeAgentInGroup(
                                        groupId,
                                                  index,
                                                  "grade_text_agent_id",
                                                  ids[0] || ""
                                                )
                                              }
                                              getId={(item) => item.agent_id}
                                    getLabel={(item) => item.name || ""}
                                              getSearchText={(item) =>
                                                `${item.name} ${item.description || ""}`
                                              }
                                              placeholder="Select grading agent"
                                              disabled={isReadonly}
                                              multiSelect={false}
                                              hideSelectedChips={true}
                                              buttonClassName="w-full"
                                            />
                                          </div>
                                        </div>
                            ))}
                                  </div>
                                )}

                                {!isReadonly && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                              handleAddRubricGradeAgentToGroup(groupId)
                                    }
                                    className="w-full"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Rubric/Agent Pair
                                  </Button>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
            </StepCard>
          );
        },
      });
    } else {
      // Add section for run rubric/agent pairs
      sections.push({
        id: "run-rubric-agent-pairs",
        insertAfter: "modelRuns",
        render: ({
          formData: contentFormData,
          setFormData: setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          const runRubricGradeAgents =
            (contentFormData["runRubricGradeAgents"] as
              | Record<string, RubricGradeAgent[]>
              | null
              | undefined) || {};
          const modelRunIds =
            (contentFormData["modelRunIds"] as string[] | null | undefined) ||
            [];

          return (
            <StepCard
              stepStatus="completed"
              stepNumber={4}
              stepTitle="Rubrics and Grading Agents per Run"
              stepDescription="Configure rubric and grading agent pairs for each model run."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
                      <div className="space-y-4">
                {modelRunIds.map((runId) => {
                  const pairs = runRubricGradeAgents[runId] || [];
                  const runData = evalData?.model_runs?.find(
                    (mr: any) => mr.model_run_id === runId
                  );
                  const runDisplayName = runData
                    ? `${runData.model_name || "Run"} - ${runData.agent_name || ""}`
                    : `Run ${runId.slice(0, 8)}`;

                          return (
                    <Card key={runId} className="p-4">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                            {runDisplayName}
                                  </span>
                                </div>

                        {pairs.length === 0 ? (
                                  <div className="text-sm text-muted-foreground py-2 text-center border border-dashed rounded-md">
                            No rubric/agent pairs added. Click "Add Pair" to add
                            one.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                            {pairs.map((rga, index) => (
                                        <div
                                          key={index}
                                          className="grid grid-cols-2 gap-4 p-3 border rounded-md"
                                        >
                                          <div className="space-y-2">
                                  <Label htmlFor={`rubric-${runId}-${index}`}>
                                              Rubric
                                            </Label>
                                            <GenericPicker
                                              items={evalData?.rubrics || []}
                                              itemIds={validRubricIds}
                                              selectedIds={
                                      rga.rubric_id ? [rga.rubric_id] : []
                                              }
                                              onSelect={(ids) =>
                                      handleUpdateRubricGradeAgentInRun(
                                        runId,
                                                  index,
                                                  "rubric_id",
                                                  ids[0] || ""
                                                )
                                              }
                                              getId={(item) => item.rubric_id}
                                    getLabel={(item) => item.name || ""}
                                              getSearchText={(item) =>
                                                `${item.name} ${item.description || ""}`
                                              }
                                              placeholder="Select rubric"
                                              disabled={isReadonly}
                                              multiSelect={false}
                                              hideSelectedChips={true}
                                              buttonClassName="w-full"
                                            />
                                          </div>
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                    <Label htmlFor={`agent-${runId}-${index}`}>
                                                Grading Agent
                                              </Label>
                                              {!isReadonly && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() =>
                                          handleRemoveRubricGradeAgentFromRun(
                                            runId,
                                                      index
                                                    )
                                                  }
                                                >
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                            <GenericPicker
                                              items={evalAgentsArray}
                                              itemIds={validEvalAgentIds}
                                              selectedIds={
                                                rga.grade_text_agent_id
                                                  ? [rga.grade_text_agent_id]
                                                  : []
                                              }
                                              onSelect={(ids) =>
                                      handleUpdateRubricGradeAgentInRun(
                                        runId,
                                                  index,
                                                  "grade_text_agent_id",
                                                  ids[0] || ""
                                                )
                                              }
                                              getId={(item) => item.agent_id}
                                    getLabel={(item) => item.name || ""}
                                              getSearchText={(item) =>
                                                `${item.name} ${item.description || ""}`
                                              }
                                              placeholder="Select grading agent"
                                              disabled={isReadonly}
                                              multiSelect={false}
                                              hideSelectedChips={true}
                                              buttonClassName="w-full"
                                            />
                                          </div>
                                        </div>
                            ))}
                                  </div>
                                )}

                                {!isReadonly && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                              handleAddRubricGradeAgentToRun(runId)
                                    }
                                    className="w-full"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Rubric/Agent Pair
                                  </Button>
                                )}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
            </StepCard>
          );
        },
      });
    }

    return sections;
  }, [
    draftState.use_groups,
    draftState.modelRunIds,
    draftState.groupIds,
    evalData?.model_runs,
    validRubricIds,
    evalAgentsArray,
    validEvalAgentIds,
    isReadonly,
    isEditMode,
    handleAddRubricGradeAgentToRun,
    handleRemoveRubricGradeAgentFromRun,
    handleUpdateRubricGradeAgentInRun,
    handleAddRubricGradeAgentToGroup,
    handleRemoveRubricGradeAgentFromGroup,
    handleUpdateRubricGradeAgentInGroup,
  ]);

  return (
    <TooltipProvider>
      <div
        className="w-full p-6 space-y-8"
        data-page={`eval-${isEditMode ? "edit" : "new"}`}
      >
        {isReadonly && (
          <div className="bg-muted border border-border rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-muted-foreground"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
        </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-foreground">
                  Eval is read-only
                </h3>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>
                    {evalData?.department_ids?.length === 0
                      ? "This is a default eval that cannot be edited. You can view the details but cannot make changes."
                      : "This eval cannot be edited. You can view the details but cannot make changes."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <GenericForm
          nuqsParsers={
            evalSearchParamsClient as Record<string, Parser<unknown>>
          }
          steps={steps}
          getStepStatus={getStepStatus}
          formData={formData}
          setFormData={setFormData}
          serverData={evalData}
          initializeForm={initializeForm}
          formFieldKeys={formFieldKeys}
          resetSuccessMessage={resetSuccessMessage}
          onSubmit={handleSubmit}
          submitButton={submitButton}
          isReadonly={isReadonly}
          isEditMode={isEditMode}
          renderStep={renderStep}
          contentSections={contentSections}
        />
    </div>
    </TooltipProvider>
  );
}

// Memoize component to prevent re-renders when only prop references change
export default React.memo(EvalComponent, (prevProps, nextProps) => {
  // Compare primitive props
  if (prevProps.evalId !== nextProps.evalId) {
    return false; // Props changed, re-render
  }

  // Compare server props by content (simplified - could be more sophisticated)
  const prevDetailId = prevProps.evalDetail?.eval_id;
  const nextDetailId = nextProps.evalDetail?.eval_id;
  if (prevDetailId !== nextDetailId) {
    return false; // Content changed, re-render
  }

  const prevDefaultId = prevProps.evalDetailDefault?.eval_id;
  const nextDefaultId = nextProps.evalDetailDefault?.eval_id;
  if (prevDefaultId !== nextDefaultId) {
    return false; // Content changed, re-render
  }

  // All props are equivalent (same content), skip re-render
  return true;
});

