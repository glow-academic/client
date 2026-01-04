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
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";

import {
  GenericForm,
  type StepStatus,
} from "@/components/common/forms/GenericForm";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
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
import { Power, Zap, Users } from "lucide-react";
import {
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

// Removed RubricGradeAgent interface - using per-agent settings like Simulation

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
    agentSelectionsByRole: Record<string, string>; // Role -> single agent ID (single-select)
    modelRunIds: string[]; // Selected model runs
    groupIds: string[]; // Selected groups (if use_groups)
    // Per-agent settings (like scenarioSettings in Simulation)
    agentSettings: Record<
      string,
      {
        rubric_ids?: string[]; // Array of rubric IDs (multi-select)
        grade_agent_ids?: string[]; // Array of grade agent IDs (multi-select) - will generate all permutations
      }
    >;
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
        agentSelectionsByRole: {},
        modelRunIds: [],
        groupIds: [],
        agentSettings: {},
      };
    }

    // Initialize agentSettings from draft payload or server data
    let agentSettings: Record<string, { rubric_ids?: string[]; grade_agent_ids?: string[] }> = {};

    // Try to read from draft payload fields (returned by SQL when draft exists)
    // Check for agent_settings first (new format)
    if (data && "agent_settings" in data && data.agent_settings) {
      try {
        const parsed = typeof data.agent_settings === "string"
          ? JSON.parse(data.agent_settings)
          : data.agent_settings;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          agentSettings = parsed as Record<string, { rubric_ids?: string[]; grade_agent_ids?: string[] }>;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Fallback: Extract from rubric_grade_agent_pairs (old format) - convert to agentSettings
    if (Object.keys(agentSettings).length === 0 && data && "rubric_grade_agent_pairs" in data && data.rubric_grade_agent_pairs) {
      try {
        const parsed = typeof data.rubric_grade_agent_pairs === "string"
          ? JSON.parse(data.rubric_grade_agent_pairs)
          : data.rubric_grade_agent_pairs;
        if (parsed && typeof parsed === "object" && Array.isArray(parsed)) {
          const pairs = parsed as Array<{rubric_id: string; grade_text_agent_id: string}>;
          // Group pairs by agent_id (assuming pairs are for agents being evaluated)
          // For now, create a default "global" entry - this will be refined when we have agent_id in pairs
          const rubricIdsSet = new Set<string>();
          const gradeAgentIdsSet = new Set<string>();
          pairs.forEach((pair) => {
            if (pair.rubric_id) rubricIdsSet.add(pair.rubric_id);
            if (pair.grade_text_agent_id) gradeAgentIdsSet.add(pair.grade_text_agent_id);
          });
          // Store in agentSettings with a default key - will be mapped to actual agents during initialization
          agentSettings["_global"] = {
            rubric_ids: Array.from(rubricIdsSet),
            grade_agent_ids: Array.from(gradeAgentIdsSet),
          };
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // If draft payload didn't have agentSettings, initialize from agentIds
    // Map _global settings to each agent if present
    if (Object.keys(agentSettings).length > 0 && agentSettings["_global"]) {
      const globalSettings = agentSettings["_global"];
      const agentIds = data.agent_ids || [];
      agentIds.forEach((agentId: string) => {
        if (!agentSettings[agentId]) {
          agentSettings[agentId] = {
            rubric_ids: globalSettings.rubric_ids || [],
            grade_agent_ids: globalSettings.grade_agent_ids || [],
          };
        }
      });
      delete agentSettings["_global"];
    }

    // Convert agentIds to agentSelectionsByRole (single-select per role)
    let agentSelectionsByRole: Record<string, string> = {};
    
    // Try to read from draft payload first (new format)
    if (data && "agent_selections_by_role" in data && data.agent_selections_by_role) {
      try {
        const parsed = typeof data.agent_selections_by_role === "string"
          ? JSON.parse(data.agent_selections_by_role)
          : data.agent_selections_by_role;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          // Convert arrays to single values (for backward compatibility)
          const converted: Record<string, string> = {};
          Object.entries(parsed as Record<string, string | string[]>).forEach(([role, value]) => {
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
              converted[role] = value[0]; // Take first agent if array
            } else if (typeof value === "string") {
              converted[role] = value;
            }
          });
          agentSelectionsByRole = converted;
        }
      } catch (e) {
        // Ignore parse errors, fall back to extracting from agent_ids
      }
    }
    
    // Fallback: Extract from agent_ids and group by role (take first agent per role)
    if (Object.keys(agentSelectionsByRole).length === 0 && data.agent_ids && Array.isArray(data.agent_ids)) {
      // Get agents from evalDetail or evalDetailDefault
      const agents = (isEditMode ? evalDetail : evalDetailDefault)?.agents || [];
      const agentRolesMap: Record<string, string> = {};
      
      data.agent_ids.forEach((agentId: string) => {
        const agent = agents.find((a: any) => a.agent_id === agentId);
        if (agent?.roles && Array.isArray(agent.roles) && agent.roles.length > 0) {
          agent.roles.forEach((role: string) => {
            // Only set if not already set (single-select - take first)
            if (!agentRolesMap[role]) {
              agentRolesMap[role] = agentId;
            }
          });
        } else {
          // If agent has no roles, put in a default "unknown" role
          if (!agentRolesMap["unknown"]) {
            agentRolesMap["unknown"] = agentId;
          }
        }
      });
      
      agentSelectionsByRole = agentRolesMap;
    }

    // If draftId exists, server should have merged draft payload into data
    // Otherwise, use server defaults
    const result = {
      name: data.name || "",
      description: data.description || "",
      active: data.active ?? true,
      dynamic: data.dynamic ?? false,
      use_groups: ("use_groups" in data && data.use_groups !== undefined ? data.use_groups : false) ?? false,
      departmentIds: data.department_ids || defaultDepartmentIds || [],
      agentSelectionsByRole,
      modelRunIds: ("model_run_ids" in data && data.model_run_ids ? data.model_run_ids : []) || [],
      groupIds: [], // TODO: Extract when groups are implemented
      agentSettings,
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
    evalDetail?.agents, // Need agents for role grouping
    evalDetailDefault?.agents, // Need agents for role grouping
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
          key === "agentSelectionsByRole" ||
          key === "modelRunIds" ||
          key === "groupIds" ||
          key === "agentSettings"
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
            agentSelectionsByRole: "agent_selections_by_role",
            modelRunIds: "model_run_ids",
            groupIds: "group_ids",
            agentSettings: "agent_settings",
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

  // Extract agent mapping - create dict from array (composite types) - similar to Simulation.tsx
  const agentMapping = useMemo(() => {
    const mapped: Record<
      string,
      { id: string; name: string; description: string; roles?: string[] }
    > = {};

    // Add agents from API response (arrays now)
    const agents = evalData?.agents || [];

    agents.forEach((agent: any) => {
      const key = String(agent.agent_id);
      mapped[key] =
        agent.roles && agent.roles.length > 0
          ? {
              id: key,
              name: agent.name || "",
              description: agent.description || "",
              roles: agent.roles.map(String),
            }
          : {
              id: key,
              name: agent.name || "",
              description: agent.description || "",
            };
    });

    // Add selected agents that aren't in the mapping (for backward compatibility)
    const allSelectedAgentIds = Object.values(draftState.agentSelectionsByRole || {}).flat();
    allSelectedAgentIds.forEach((agentId) => {
      if (!mapped[agentId]) {
        mapped[agentId] = {
          id: agentId,
          name: `Agent ${agentId.slice(0, 8)}...`,
          description: "Selected agent",
          roles: [],
        };
      }
    });

    return mapped;
  }, [evalData?.agents, draftState.agentSelectionsByRole]);

  // Extract unique agent roles from selected model runs/groups
  const extractedAgentRoles = useMemo(() => {
    const rolesSet = new Set<string>();
    const useGroups = draftState.use_groups ?? false;

    if (useGroups) {
      // For groups, we need to extract agent roles from model runs within groups
      // For now, we'll need to fetch group details or extract from available_model_runs
      // This is a placeholder - groups may need special handling
      const groupIds = draftState.groupIds || [];
      if (groupIds.length === 0) return [];
      
      // TODO: Extract agent roles from groups when group data structure is available
      // For now, return empty array - groups may not have direct agent info
      return [];
    } else {
      // Extract agent roles from selected model runs
      const modelRunIds = draftState.modelRunIds || [];
      if (modelRunIds.length === 0) return [];

      // Get model runs from evalData
      const availableModelRuns = evalData?.available_model_runs || [];
      
      modelRunIds.forEach((runId) => {
        const run = availableModelRuns.find((mr: any) => mr.model_run_id === runId);
        if (run?.agent_id) {
          const agent = agentMapping[run.agent_id];
          if (agent?.roles && agent.roles.length > 0) {
            agent.roles.forEach((role) => rolesSet.add(role));
          }
        }
      });
    }

    return Array.from(rolesSet).sort();
  }, [draftState.modelRunIds, draftState.groupIds, draftState.use_groups, evalData?.available_model_runs, agentMapping]);

  // Helper to get unique selected agents across all roles (single-select)
  const getUniqueSelectedAgents = useCallback((): string[] => {
    const allAgentIds = Object.values(draftState.agentSelectionsByRole || {}).filter((id): id is string => !!id);
    return Array.from(new Set(allAgentIds));
  }, [draftState.agentSelectionsByRole]);

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

      // Convert agentIds to agentSelectionsByRole (single-select per role)
      const agents = evalDetailData.agents || [];
      const agentSelectionsByRole: Record<string, string> = {};
      agentIds.forEach((agentId: string) => {
        const agent = agents.find((a: any) => a.agent_id === agentId);
        if (agent?.roles && Array.isArray(agent.roles) && agent.roles.length > 0) {
          agent.roles.forEach((role: string) => {
            // Only set if not already set (single-select - take first)
            if (!agentSelectionsByRole[role]) {
              agentSelectionsByRole[role] = agentId;
            }
          });
        } else {
          // If agent has no roles, put in a default "unknown" role
          if (!agentSelectionsByRole["unknown"]) {
            agentSelectionsByRole["unknown"] = agentId;
          }
        }
      });

      // Update draftState directly
      const draftUpdates: Partial<DraftState> = {};

      if (evalDetailData.name) draftUpdates.name = evalDetailData.name;
      if (evalDetailData.description)
        draftUpdates.description = evalDetailData.description;
      if (evalDetailData.active !== undefined)
        draftUpdates.active = evalDetailData.active ?? true;
      if (evalDetailData.dynamic !== undefined)
        draftUpdates.dynamic = evalDetailData.dynamic ?? false;
      if ("use_groups" in evalDetailData && evalDetailData.use_groups !== undefined)
        draftUpdates.use_groups = (evalDetailData as { use_groups?: boolean }).use_groups ?? false;
      if (deptIds.length > 0) draftUpdates["departmentIds"] = deptIds;
      if (Object.keys(agentSelectionsByRole).length > 0) draftUpdates["agentSelectionsByRole"] = agentSelectionsByRole;
      if (modelRunIds.length > 0) draftUpdates["modelRunIds"] = modelRunIds;

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

      // Validate that at least one model run/group is selected first
      if (draftState.use_groups) {
        if (draftState.groupIds.length === 0) {
          toast.error("Please select at least one group");
          throw new Error("At least one group is required");
        }
      } else {
        if (draftState.modelRunIds.length === 0) {
          toast.error("Please select at least one model run");
          throw new Error("At least one model run is required");
        }
      }

      // Validate that at least one agent is selected (across all role pickers)
      const uniqueAgentIds = getUniqueSelectedAgents();
      if (uniqueAgentIds.length === 0) {
        toast.error("Please select at least one agent");
        throw new Error("At least one agent is required");
      }

      // Validate agentSettings - each agent must have at least one rubric and one grade agent
      for (const agentId of uniqueAgentIds) {
        const settings = draftState.agentSettings[agentId] || {};
        const rubricIds = settings.rubric_ids || [];
        const gradeAgentIds = settings.grade_agent_ids || [];
        if (rubricIds.length === 0) {
          const agent = (evalData?.agents || []).find((a: any) => a.agent_id === agentId);
          toast.error(
            `Please select at least one rubric for agent ${agent?.name || agentId.slice(0, 8)}`
          );
          throw new Error(`Missing rubrics for agent ${agentId}`);
        }
        if (gradeAgentIds.length === 0) {
          const agent = (evalData?.agents || []).find((a: any) => a.agent_id === agentId);
          toast.error(
            `Please select at least one grading agent for agent ${agent?.name || agentId.slice(0, 8)}`
          );
          throw new Error(`Missing grade agents for agent ${agentId}`);
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
        const uniqueAgentIds = getUniqueSelectedAgents();
        const updateRequest: UpdateEvalBody = {
            eval_id: evalId!,
            name: draftState.name || "",
            description: draftState.description || "",
            agent_ids: uniqueAgentIds,
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
        const uniqueAgentIds = getUniqueSelectedAgents();
        const createRequest: CreateEvalBody = {
            name: draftState.name || "",
            description: draftState.description || "",
            agent_ids: uniqueAgentIds,
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
      getUniqueSelectedAgents,
    ]
  );

  // Step status logic (for GenericForm)
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      const hasName = !!(
        formData["name"] as string | null | undefined
      )?.trim();
      const useGroups = (formData["use_groups"] as boolean | null | undefined) ?? false;
      
      // Check if model runs/groups are selected
      const hasRunsOrGroups = useGroups
        ? ((formData["groupIds"] as string[] | null | undefined) || []).length > 0
        : ((formData["modelRunIds"] as string[] | null | undefined) || []).length > 0;
      
      // Note: agentSelectionsByRole, uniqueAgentIds, hasAgents and agentSettings are computed but not currently used - kept for future use
      // const agentSelectionsByRole = (formData["agentSelectionsByRole"] as Record<string, string> | null | undefined) || {};
      // const uniqueAgentIds = Object.values(agentSelectionsByRole).filter((id): id is string => !!id);
      // const hasAgents = uniqueAgentIds.length > 0;
      // const agentSettings = (formData["agentSettings"] as Record<string, { rubric_ids?: string[]; grade_agent_ids?: string[] }> | null | undefined) || {};
      // const hasAgentRubricSettings = hasAgents && Object.keys(agentSettings).length > 0 &&
      //   uniqueAgentIds.every((agentId) => {
      //     const settings = agentSettings[agentId] || {};
      //     return (settings.rubric_ids?.length || 0) > 0 && (settings.grade_agent_ids?.length || 0) > 0;
      // });

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "modelRuns":
          if (!hasName) return "pending";
          return hasRunsOrGroups ? "completed" : "active";
        case "groups":
          if (!hasName) return "pending";
          return hasRunsOrGroups ? "completed" : "active";
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
        ] as string[],
      },
      {
        id: "modelRuns",
        title: "Model Runs",
        description: "Select model runs to evaluate.",
        resetFields: [
          "modelRunIds",
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
      "agentSelectionsByRole",
      "modelRunIds",
      "groupIds",
      "agentSettings",
    ],
    []
  );

  // Memoize resetSuccessMessage to prevent GenericForm re-renders
  const resetSuccessMessage = useCallback((stepId: string) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
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

  // Helper to get agent settings (like getScenarioSettings in Simulation)
  const getAgentSettings = useCallback(
    (agentId: string) => {
      return draftState.agentSettings[agentId] || {
        rubric_ids: [],
        grade_agent_ids: [],
      };
    },
    [draftState.agentSettings]
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
                      getId={(dept) => dept.department_id || ""}
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
                    <Zap className="h-3.5 w-3.5 text-muted-foreground" />
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
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        Use Groups
                      </Label>
                      <Switch
                        id="use_groups"
                        checked={
                          (stepFormData["use_groups"] as
                            | boolean
                            | null
                            | undefined) ??
                          ("use_groups" in (evalData || {}) && (evalData as { use_groups?: boolean }).use_groups !== undefined ? (evalData as { use_groups?: boolean }).use_groups : false) ?? false
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


        case "modelRuns": {
          // Only show if not using groups
          const useGroups = (stepFormData["use_groups"] as boolean | null | undefined) ?? false;
          if (useGroups) {
            return null;
          }

          const selectedModelRunIds =
            (stepFormData["modelRunIds"] as string[] | null | undefined) || [];

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
                    setDraftState((prev) => ({
                      ...prev,
                      modelRunIds: ids,
                    }));
                    // Also update formData for GenericForm
                    setStepFormData({ modelRunIds: ids.length > 0 ? ids : null });
                  }}
                  readonly={isReadonly}
                  {...(evalId ? { evalId } : {})}
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
                    setDraftState((prev) => ({
                      ...prev,
                      groupIds: ids,
                    }));
                    // Also update formData for GenericForm
                    setStepFormData({ groupIds: ids.length > 0 ? ids : null });
                  }}
                    readonly={isReadonly}
                  {...(evalId ? { evalId } : {})}
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
    ]
  );

  // Content sections for nested rubric/agent pair management
  const contentSections = useMemo(() => {
    const useGroups = draftState.use_groups ?? false;
    const modelRunIds = draftState.modelRunIds || [];
    const groupIds = draftState.groupIds || [];
    const agentSelectionsByRole = draftState.agentSelectionsByRole || {};
    const uniqueAgentIds = getUniqueSelectedAgents();

    const sections: Array<{
      id: string;
      insertAfter: string;
      render: (props: {
        formData: Record<string, unknown>;
        setFormData: (updates: Partial<Record<string, unknown>>) => void;
      }) => React.ReactNode;
    }> = [];

    // Add dynamic agent role pickers section after modelRuns/groups step
    const hasRunsOrGroups = useGroups ? groupIds.length > 0 : modelRunIds.length > 0;
    if (hasRunsOrGroups && extractedAgentRoles.length > 0) {
      sections.push({
        id: "agent-roles",
        insertAfter: useGroups ? "groups" : "modelRuns",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          return (
            <StepCard
              stepStatus="completed"
              stepNumber={3}
              stepTitle="Agents"
              stepDescription="Select an agent for each role found in the selected model runs/groups."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {extractedAgentRoles.map((role) => {
                  const roleAgentId = agentSelectionsByRole[role] || "";
                  const roleFilteredIds = validAgentIds.filter((id) => {
                    const agent = agentMapping[id];
                    return agent?.roles?.includes(role);
                  });
                  
                  // Include selected agent even if it's not in filtered list (for backward compatibility)
                  const allRoleAgentIds = roleAgentId && !roleFilteredIds.includes(roleAgentId)
                    ? [...roleFilteredIds, roleAgentId]
                    : roleFilteredIds;

                  return (
                    <div key={role} className="space-y-2">
                      <Label htmlFor={`agent-role-${role}`}>
                        {role.charAt(0).toUpperCase() + role.slice(1)} Agent
                      </Label>
                      <GenericPicker
                        items={agentMapping}
                        itemIds={allRoleAgentIds}
                        selectedIds={roleAgentId ? [roleAgentId] : []}
                        onSelect={(ids) => {
                          setDraftState((prev) => ({
                            ...prev,
                            agentSelectionsByRole: {
                              ...prev.agentSelectionsByRole,
                              [role]: ids.length > 0 && ids[0] ? ids[0] : "",
                            },
                          }));
                        }}
                        getId={(item) => (item as unknown as { id: string }).id}
                        getLabel={(item) => item.name || ""}
                        getSearchText={(item) =>
                          `${item.name} ${item.description || ""}`
                        }
                        renderPreview={(item) => (
                          <div className="grid gap-2">
                            <h4 className="font-medium leading-none">
                              {item.name || "No agent selected"}
                            </h4>
                            <div className="text-sm text-muted-foreground">
                              {item.description || "No description available"}
                            </div>
                          </div>
                        )}
                        renderItem={(item, _isSelected) => (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="truncate">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        placeholder={`Select ${role} agent`}
                        disabled={isReadonly}
                        multiSelect={false}
                        hideSelectedChips={true}
                        buttonClassName="w-full"
                        groupHeading="Agents"
                      />
                    </div>
                  );
                })}
              </div>
            </StepCard>
          );
        },
      });
    }

    // Add rubric/agent settings section after agent roles (for unique agents)
    if (uniqueAgentIds.length > 0) {
      sections.push({
        id: "rubric-agents",
        insertAfter: useGroups ? "groups" : "modelRuns",
        render: ({
          formData: _contentFormData,
          setFormData: _setContentFormData,
        }: {
          formData: Record<string, unknown>;
          setFormData: (updates: Partial<Record<string, unknown>>) => void;
        }) => {
          return (
            <StepCard
              stepStatus="completed"
              stepNumber={4}
              stepTitle="Rubrics"
              stepDescription="Select rubrics and grading agents for each unique agent being evaluated."
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {uniqueAgentIds.map((agentId) => {
                  const agent = (evalData?.agents || []).find(
                    (a: any) => a.agent_id === agentId
                  );
                  const settings = getAgentSettings(agentId);
                  const selectedRubricIds = settings.rubric_ids || [];
                  const selectedGradeAgentIds = settings.grade_agent_ids || [];
                  // Filter to only valid grade agents
                  const validGradeAgentIds = selectedGradeAgentIds.filter(
                    (id: string) => validEvalAgentIds.includes(id)
                  );

                  // Filter rubrics to only those matching the agent's roles
                  const agentRoles = agent?.roles || [];
                  const allRubrics = evalData?.rubrics || [];
                  const validRubricsForAgent = allRubrics.filter((rubric: any) => {
                    // If agent has no roles, show all rubrics (backward compatibility)
                    if (!agentRoles || agentRoles.length === 0) return true;
                    // If rubric has no agent_role (NULL/empty/null), show it (general rubric)
                    const rubricRole = rubric?.agent_role;
                    if (rubricRole == null || rubricRole === '') return true;
                    // Show rubric if its agent_role matches any of the agent's roles
                    return agentRoles.includes(rubricRole);
                  });
                  const validRubricIdsForAgent = validRubricsForAgent.map((r: any) => r.rubric_id);

                  return (
                    <Card key={agentId} className="p-4">
                      <div className="space-y-3">
                        <h3 className="font-medium text-sm leading-tight truncate">
                          {agent?.name || "Unnamed Agent"}
                        </h3>
                        {agent?.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {agent.description}
                          </p>
                        )}
                        <div className="space-y-2">
                          <Label className="text-xs">
                            Rubrics (Multi-select)
                          </Label>
                          <GenericPicker
                            items={validRubricsForAgent}
                            itemIds={validRubricIdsForAgent}
                            selectedIds={selectedRubricIds}
                            onSelect={(ids) => {
                              setDraftState((prev) => {
                                const currentSettings =
                                  prev.agentSettings[agentId] || {};
                                const newSettings = {
                                  ...currentSettings,
                                  rubric_ids: ids.length > 0 ? ids : [],
                                };
                                return {
                                  ...prev,
                                  agentSettings: {
                                    ...prev.agentSettings,
                                    [agentId]: newSettings,
                                  },
                                };
                              });
                            }}
                            getId={(item) => item.rubric_id || ""}
                            getLabel={(item) => item.name || ""}
                            getSearchText={(item) =>
                              `${item.name} ${item.description || ""}`
                            }
                            placeholder="Select rubrics"
                            disabled={isReadonly}
                            multiSelect={true}
                            hideSelectedChips={false}
                            buttonClassName="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">
                            Grade Agents (Multi-select)
                          </Label>
                          <GenericPicker
                            items={evalAgentsArray}
                            itemIds={validEvalAgentIds}
                            selectedIds={validGradeAgentIds}
                            onSelect={(ids) => {
                              setDraftState((prev) => ({
                                ...prev,
                                agentSettings: {
                                  ...prev.agentSettings,
                                  [agentId]: {
                                    ...prev.agentSettings[agentId],
                                    grade_agent_ids: ids.length > 0 ? ids : [],
                                  },
                                },
                              }));
                            }}
                            getId={(item) => item.agent_id || ""}
                            getLabel={(item) => item.name || ""}
                            getSearchText={(item) =>
                              `${item.name} ${item.description || ""}`
                            }
                            placeholder="Select grade agents"
                            disabled={isReadonly}
                            multiSelect={true}
                            hideSelectedChips={false}
                            buttonClassName="w-full"
                          />
                        </div>
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
    draftState.agentSelectionsByRole,
    extractedAgentRoles,
    evalData?.rubrics,
    evalData?.agents,
    validRubricIds,
    validAgentIds,
    evalAgentsArray,
    validEvalAgentIds,
    agentMapping,
    isReadonly,
    isEditMode,
    getAgentSettings,
    getUniqueSelectedAgents,
    draftState.agentSettings,
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

