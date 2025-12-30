/**
 * Eval.tsx
 * Used to create and manage evals for the admin dashboard
 * Consolidated from EvalForm, EvalDetail, and ModelRunsSelector
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

// UI Components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { AgentCardGrid } from "@/components/common/evals/AgentCardGrid";
import { GroupCardGrid } from "@/components/common/evals/GroupCardGrid";
import { ModelRunCardGrid } from "@/components/common/evals/ModelRunCardGrid";
import { RubricCardGrid } from "@/components/common/evals/RubricCardGrid";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { Check, Loader2, Plus, Power, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Import types from new page (create action)
import type {
  CreateEvalIn,
  CreateEvalOut,
  EvalNewOut,
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
}

interface FormErrors {
  name?: string;
}

interface RubricGradeAgent {
  rubric_id: string;
  grade_text_agent_id: string;
}

interface EvalRun {
  run_id: string;
  rubric_grade_agents: RubricGradeAgent[];
}

interface EvalGroup {
  group_id: string;
  rubric_grade_agents: RubricGradeAgent[];
}

interface FormData {
  name: string;
  description: string;
  active: boolean;
  dynamic: boolean;
  use_groups: boolean;
  departmentIds: string[] | null;
  eval_runs: EvalRun[];
  eval_groups: EvalGroup[];
}

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

export default function Eval({
  evalId,
  evalDetail: serverEvalDetail,
  evalDetailDefault: serverEvalDetailDefault,
  createEvalAction,
  updateEvalAction,
}: EvalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEvalId, setEditingEvalId] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const isEditMode = !!evalId;

  // Helper function to update URL with query parameters
  const updateUrlParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          // Use comma-separated values to match how page.tsx reads them
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      });

      const newParamsString = params.toString();
      router.replace(`${pathname}?${newParamsString}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

  // Track if we've initialized URL params from server data to prevent infinite loops
  const hasInitializedUrlParamsRef = useRef(false);

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  const initialFormData: FormData = useMemo(() => {
    return {
      name: "",
      description: "",
      active: true,
      dynamic: false,
      use_groups: false,
      departmentIds: defaultDepartmentIds,
      eval_runs: [],
      eval_groups: [],
    };
  }, [defaultDepartmentIds]);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [originalFormData, setOriginalFormData] =
    useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // State for selected agents (being evaluated)
  const [currentAgentIds, setCurrentAgentIds] = useState<string[]>([]);
  // State for selected model runs
  const [currentModelRunIds, setCurrentModelRunIds] = useState<string[]>([]);
  // State for selected groups
  const [currentGroupIds, setCurrentGroupIds] = useState<string[]>([]);

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const evalDetail = serverEvalDetail;
  const evalDetailDefault = serverEvalDetailDefault;

  // Use edit detail when editing, default detail when creating
  const evalData = isEditMode ? evalDetail : evalDetailDefault;

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
  }, [evalDetail, evalId, isEditMode, setEntityMetadata, clearEntityMetadata]);

  // Extract body types for type safety using InputOf directly
  type CreateEvalBody = CreateEvalIn["body"];
  type UpdateEvalBody = UpdateEvalIn["body"];

  // Server action handlers
  const handleCreateEval = async (body: CreateEvalBody) => {
    if (!createEvalAction) {
      throw new Error("createEvalAction is required");
    }
    await createEvalAction({ body });
  };

  const handleUpdateEval = async (body: UpdateEvalBody) => {
    if (!updateEvalAction) {
      throw new Error("updateEvalAction is required");
    }
    await updateEvalAction({ body });
  };

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !evalData) return false;
    return !evalData.can_edit;
  }, [isEditMode, evalData]);

  // Get valid agent IDs (agents being evaluated) - filtered by departments
  const validAgentIds = useMemo(() => {
    const baseIds = evalData?.valid_agent_ids || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Filter by department access (agents should be accessible based on departments)
    // For now, return all baseIds since agent filtering by department is handled server-side
    return baseIds;
  }, [evalData?.valid_agent_ids, formData?.departmentIds]);

  // Get valid rubric IDs (no longer filtered by agent_role - removed in migration)
  const validRubricIds = useMemo(() => {
    return evalData?.valid_rubric_ids || [];
  }, [evalData?.valid_rubric_ids]);

  // Build filtered rubrics array (for RubricCardGrid)
  const filteredRubrics = useMemo(() => {
    const allRubrics = evalData?.rubrics || [];
    const validIds = new Set(validRubricIds);
    return allRubrics.filter((rubric) => validIds.has(rubric.rubric_id));
  }, [evalData?.rubrics, validRubricIds]);

  // Handle agent selection from picker (multiple selection allowed)
  const handleAgentSelection = useCallback(
    (agentIds: string[]) => {
      setCurrentAgentIds(agentIds);
      // Update URL params when agents are selected
      updateUrlParams({
        agentIds: agentIds.length > 0 ? agentIds : null,
      });
    },
    [updateUrlParams]
  );

  // Handle model run selection
  const handleModelRunSelection = useCallback(
    (modelRunIds: string[]) => {
      setCurrentModelRunIds(modelRunIds);
      // Update formData.eval_runs to match selected runs
      setFormData((prev) => {
        const existingRunIds = new Set(prev.eval_runs.map((r) => r.run_id));
        const newRunIds = new Set(modelRunIds);

        // Remove runs that are no longer selected
        const updatedRuns = prev.eval_runs.filter((r) =>
          newRunIds.has(r.run_id)
        );

        // Add new runs that weren't in the list
        const runsToAdd = modelRunIds
          .filter((id) => !existingRunIds.has(id))
          .map((runId) => ({
            run_id: runId,
            rubric_grade_agents: [] as RubricGradeAgent[],
          }));

        return {
          ...prev,
          eval_runs: [...updatedRuns, ...runsToAdd],
        };
      });
      updateUrlParams({
        modelRunIds: modelRunIds.length > 0 ? modelRunIds : null,
      });
    },
    [updateUrlParams]
  );

  // Sync selections from URL params
  useEffect(() => {
    const agentIdsFromUrl =
      searchParams.get("agentIds")?.split(",").filter(Boolean) || [];
    const modelRunIdsFromUrl =
      searchParams.get("modelRunIds")?.split(",").filter(Boolean) || [];

    // Compare arrays preserving order
    const agentIdsEqual =
      agentIdsFromUrl.length === currentAgentIds.length &&
      agentIdsFromUrl.every((id, idx) => id === currentAgentIds[idx]);

    const modelRunIdsEqual =
      modelRunIdsFromUrl.length === currentModelRunIds.length &&
      modelRunIdsFromUrl.every((id, idx) => id === currentModelRunIds[idx]);

    if (!agentIdsEqual) {
      setCurrentAgentIds(agentIdsFromUrl);
    }
    if (!modelRunIdsEqual) {
      setCurrentModelRunIds(modelRunIdsFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only watch searchParams

  // Load eval data from server response
  useEffect(() => {
    if (evalData && isEditMode) {
      const deptIds = evalData.department_ids || [];
      const useGroups = evalData.use_groups ?? false;

      // Extract eval_runs with rubric_grade_agents from model_runs
      const evalRuns: EvalRun[] = (evalData.model_runs || []).map(
        (run: any) => ({
          run_id: run.model_run_id,
          rubric_grade_agents: (run.rubric_grade_agents || []).map(
            (rga: any) => ({
              rubric_id: rga.rubric_id,
              grade_text_agent_id: rga.agent_id,
            })
          ),
        })
      );

      // TODO: Extract eval_groups when groups are implemented
      const evalGroups: EvalGroup[] = [];

      const evalFormData = {
        name: evalData.name || "",
        description: evalData.description || "",
        active: evalData.active ?? true,
        dynamic: evalData.dynamic ?? false,
        use_groups: useGroups,
        departmentIds: deptIds,
        eval_runs: evalRuns,
        eval_groups: evalGroups,
      };

      // Only update if the data has actually changed to prevent infinite loops
      setFormData((prev) => {
        const hasChanged =
          prev.name !== evalFormData.name ||
          prev.description !== evalFormData.description ||
          prev.active !== evalFormData.active ||
          prev.dynamic !== evalFormData.dynamic ||
          prev.use_groups !== evalFormData.use_groups ||
          JSON.stringify(prev.departmentIds?.sort()) !==
            JSON.stringify(evalFormData.departmentIds?.sort()) ||
          JSON.stringify(prev.eval_runs) !==
            JSON.stringify(evalFormData.eval_runs) ||
          JSON.stringify(prev.eval_groups) !==
            JSON.stringify(evalFormData.eval_groups);

        return hasChanged ? evalFormData : prev;
      });

      setOriginalFormData((prev) => {
        const hasChanged =
          prev.name !== evalFormData.name ||
          prev.description !== evalFormData.description ||
          prev.active !== evalFormData.active ||
          prev.dynamic !== evalFormData.dynamic ||
          JSON.stringify(prev.departmentIds?.sort()) !==
            JSON.stringify(evalFormData.departmentIds?.sort()) ||
          prev.eval_agent_id !== evalFormData.eval_agent_id;

        return hasChanged ? evalFormData : prev;
      });

      // Load agent IDs, rubric ID, and model run IDs from eval data
      // Prioritize URL params if they exist, otherwise use server data
      const agentIdsFromUrl =
        searchParams.get("agentIds")?.split(",").filter(Boolean) || [];
      const rubricIdFromUrl = searchParams.get("rubricId") || null;
      const modelRunIdsFromUrl =
        searchParams.get("modelRunIds")?.split(",").filter(Boolean) || [];

      // Get agent_ids from eval data (now an array)
      const serverAgentIds: string[] = evalData.agent_ids || [];

      const orderedAgentIds =
        agentIdsFromUrl.length > 0 ? agentIdsFromUrl : serverAgentIds;
      const orderedRubricId = rubricIdFromUrl || evalData.rubric_id || null;
      const orderedModelRunIds =
        modelRunIdsFromUrl.length > 0
          ? modelRunIdsFromUrl
          : evalData.model_runs?.map((mr) => mr.model_run_id) || [];

      setCurrentAgentIds((prev) => {
        const hasChanged =
          prev.length !== orderedAgentIds.length ||
          prev.some((id, idx) => id !== orderedAgentIds[idx]);
        return hasChanged ? orderedAgentIds : prev;
      });

      setCurrentRubricId((prev) => {
        return prev !== orderedRubricId ? orderedRubricId : prev;
      });

      setCurrentModelRunIds((prev) => {
        const hasChanged =
          prev.length !== orderedModelRunIds.length ||
          prev.some((id, idx) => id !== orderedModelRunIds[idx]);
        return hasChanged ? orderedModelRunIds : prev;
      });

      // Update URL params if we're using server data and URL is empty (only in edit mode)
      // Only do this once to prevent infinite loops
      if (
        isEditMode &&
        !hasInitializedUrlParamsRef.current &&
        agentIdsFromUrl.length === 0 &&
        orderedAgentIds.length > 0
      ) {
        hasInitializedUrlParamsRef.current = true;
        updateUrlParams({
          agentIds: orderedAgentIds,
          rubricId: orderedRubricId,
          modelRunIds: orderedModelRunIds,
        });
      }
    } else if (!isEditMode && evalData) {
      // Create mode - initialize with defaults
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);

      // Initialize from URL params in create mode (only if URL params exist)
      // Don't set state if URL params are empty to avoid unnecessary updates
      const agentIdsFromUrl =
        searchParams.get("agentIds")?.split(",").filter(Boolean) || [];
      const rubricIdFromUrl = searchParams.get("rubricId") || null;
      const modelRunIdsFromUrl =
        searchParams.get("modelRunIds")?.split(",").filter(Boolean) || [];

      if (agentIdsFromUrl.length > 0) {
        setCurrentAgentIds(agentIdsFromUrl);
      }
      if (rubricIdFromUrl) {
        setCurrentRubricId(rubricIdFromUrl);
      }
      if (modelRunIdsFromUrl.length > 0) {
        setCurrentModelRunIds(modelRunIdsFromUrl);
      }
    }
    // Remove searchParams and updateUrlParams from dependencies to prevent infinite loops
    // searchParams is read inside the effect but we don't want to react to its changes
    // updateUrlParams is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalData, isEditMode, initialFormData]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    // Get original selections from evalData
    const originalAgentIds: string[] = evalData?.agent_ids || [];
    const originalRubricId = evalData?.rubric_id || null;
    const originalModelRunIds =
      evalData?.model_runs?.map((mr) => mr.model_run_id) || [];

    return (
      current.name !== original.name ||
      current.description !== original.description ||
      current.active !== original.active ||
      current.dynamic !== original.dynamic ||
      JSON.stringify(current.departmentIds?.sort()) !==
        JSON.stringify(original.departmentIds?.sort()) ||
      current.eval_agent_id !== original.eval_agent_id ||
      JSON.stringify([...currentAgentIds].sort()) !==
        JSON.stringify(originalAgentIds.sort()) ||
      currentRubricId !== originalRubricId ||
      JSON.stringify([...currentModelRunIds].sort()) !==
        JSON.stringify(originalModelRunIds.sort())
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    currentAgentIds,
    currentRubricId,
    currentModelRunIds,
    evalData,
  ]);

  const handleInputChange = (
    field: keyof FormData,
    value: string | boolean | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Step status logic
  const getStepStatus = useCallback(
    (stepId: string): StepStatus => {
      const hasName = !!formData?.name?.trim();
      const hasAgents = currentAgentIds.length > 0;
      // Check if runs/groups have rubric_grade_agents based on use_groups
      const hasRubricGradeAgents = formData.use_groups
        ? formData.eval_groups.length > 0 &&
          formData.eval_groups.every(
            (g) =>
              g.rubric_grade_agents.length > 0 &&
              g.rubric_grade_agents.every(
                (rga) => rga.rubric_id && rga.grade_text_agent_id
              )
          )
        : formData.eval_runs.length > 0 &&
          formData.eval_runs.every(
            (r) =>
              r.rubric_grade_agents.length > 0 &&
              r.rubric_grade_agents.every(
                (rga) => rga.rubric_id && rga.grade_text_agent_id
              )
          );
      const hasRunsOrGroups = formData.use_groups
        ? formData.eval_groups.length > 0
        : formData.eval_runs.length > 0;

      switch (stepId) {
        case "basic":
          return hasName && hasRubricGradeAgents ? "completed" : "active";
        case "agents":
          if (!hasName || !hasRubricGradeAgents) return "pending";
          return hasAgents ? "completed" : "active";
        case "modelRuns":
          if (!hasAgents) return "pending";
          return hasRunsOrGroups ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [
      formData?.name,
      formData?.use_groups,
      formData?.eval_runs,
      formData?.eval_groups,
      currentAgentIds.length,
      currentModelRunIds.length,
    ]
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description:
          "Set the eval name, description, departments, active status, and rubric/agent pairs.",
        status: getStepStatus("basic"),
      },
      {
        id: "agents",
        title: "Agents",
        description: "Select agents to evaluate.",
        status: getStepStatus("agents"),
      },
      {
        id: "modelRuns",
        title: "Model Runs",
        description: "Select model runs to evaluate.",
        status: getStepStatus("modelRuns"),
      },
    ];
  }, [getStepStatus]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name?.trim()) {
      newErrors.name = "Name is required";
    }

    if (currentAgentIds.length === 0) {
      toast.error("Please select at least one agent");
      return false;
    }

    // Validate runs/groups have rubric_grade_agents based on use_groups
    if (formData.use_groups) {
      if (formData.eval_groups.length === 0) {
        toast.error("Please select at least one group");
        return false;
      }
      for (const group of formData.eval_groups) {
        if (group.rubric_grade_agents.length === 0) {
          toast.error(
            `Please add at least one rubric and grading agent pair for group ${group.group_id.slice(0, 8)}`
          );
          return false;
        }
        for (const rga of group.rubric_grade_agents) {
          if (!rga.rubric_id || !rga.grade_text_agent_id) {
            toast.error("Each rubric must have a grading agent selected");
            return false;
          }
        }
      }
    } else {
      if (formData.eval_runs.length === 0) {
        toast.error("Please select at least one model run");
        return false;
      }
      for (const run of formData.eval_runs) {
        if (run.rubric_grade_agents.length === 0) {
          toast.error(
            `Please add at least one rubric and grading agent pair for run ${run.run_id.slice(0, 8)}`
          );
          return false;
        }
        for (const rga of run.rubric_grade_agents) {
          if (!rga.rubric_id || !rga.grade_text_agent_id) {
            toast.error("Each rubric must have a grading agent selected");
            return false;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setOriginalFormData(initialFormData);
    setEditingEvalId(null);
    setErrors({});
    setCurrentAgentIds([]);
    setCurrentModelRunIds([]);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const validDepartmentIds = evalData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      const targetEvalId = evalId || editingEvalId;

      if (targetEvalId) {
        // UPDATE mode - convert camelCase to snake_case
        const updateRequest: UpdateEvalBody = {
          eval_id: targetEvalId,
          name: formData.name || "",
          description: formData.description || "",
          agent_ids: currentAgentIds, // Agents being evaluated (array)
          use_groups: formData.use_groups ?? false,
          department_ids: finalDepartmentIds || [],
          active: formData.active ?? true,
          dynamic: formData.dynamic ?? false,
          model_run_ids: formData.use_groups
            ? []
            : formData.eval_runs.map((r) => r.run_id),
        };
        await handleUpdateEval(updateRequest);

        // TODO: Call separate endpoints to add runs/groups with rubric_grade_agents
        // For now, this is a placeholder - full implementation requires API endpoints for add_eval_runs/add_eval_groups
        toast.success("Eval updated successfully!");
      } else {
        // CREATE mode - already using snake_case
        const createRequest: CreateEvalBody = {
          name: formData.name || "",
          description: formData.description || "",
          agent_ids: currentAgentIds, // Agents being evaluated (array)
          use_groups: formData.use_groups ?? false,
          department_ids: finalDepartmentIds || [],
          active: formData.active || true,
          dynamic: formData.dynamic || false,
          model_run_ids: formData.use_groups
            ? []
            : formData.eval_runs.map((r) => r.run_id),
        };
        const createResult = await handleCreateEval(createRequest);

        // TODO: Call separate endpoints to add runs/groups with rubric_grade_agents
        // For now, this is a placeholder - full implementation requires API endpoints for add_eval_runs/add_eval_groups
        toast.success("Eval created successfully!");
      }

      resetFormAndState();
      router.push(`/engine/evals`);
    } catch (error) {
      const targetEvalId = evalId || editingEvalId;
      toast.error(
        `Failed to ${targetEvalId ? "update" : "create"} eval: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClick = () => {
    handleSubmit();
  };

  const handleConfirmUpdate = () => {
    setShowUpdateDialog(false);
    handleSubmit();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateClick();
  };

  // Get eval agents array (agents with 'eval' role) - prefer eval_agents, fallback to agents
  const evalAgentsArray = useMemo(() => {
    return evalData?.eval_agents && evalData.eval_agents.length > 0
      ? evalData.eval_agents
      : evalData?.agents || [];
  }, [evalData?.eval_agents, evalData?.agents]);

  const validEvalAgentIds = useMemo(() => {
    return evalData?.valid_eval_agent_ids || evalData?.valid_agent_ids || [];
  }, [evalData?.valid_eval_agent_ids, evalData?.valid_agent_ids]);

  return (
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
      <form onSubmit={handleFormSubmit} className="space-y-8">
        {/* Step 1: Basic Information */}
        <Card className="transition-all">
          <CardContent className="pt-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                  steps[0]?.status === "completed"
                    ? "bg-green-500 text-white"
                    : steps[0]?.status === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                )}
              >
                {steps[0]?.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>1</span>
                )}
              </div>
              <div className="flex-1">
                {formData?.name !== undefined ? (
                  <input
                    type="text"
                    id="name"
                    data-testid="input-eval-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className={cn(
                      "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                      errors.name && "border-destructive"
                    )}
                    placeholder="New Eval"
                    disabled={isReadonly}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  Click to edit
                </p>
                {errors.name && (
                  <p className="text-sm text-destructive mt-1 px-2">
                    {errors.name}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardContent className="pt-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              {formData?.description !== undefined ? (
                <Textarea
                  id="description"
                  data-testid="input-eval-description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Enter a brief description (optional)"
                  rows={3}
                  disabled={isReadonly}
                />
              ) : null}
            </div>

            {/* Department Selection */}
            {evalData?.valid_department_ids &&
              evalData.valid_department_ids.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  {formData?.departmentIds !== undefined ? (
                    <GenericPicker
                      items={evalData?.departments || []}
                      itemIds={evalData?.valid_department_ids || []}
                      selectedIds={formData.departmentIds || []}
                      onSelect={(ids) =>
                        handleInputChange("departmentIds", ids)
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
                  ) : null}
                </div>
              )}

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
              {formData.rubric_grade_agents.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                  No rubric/agent pairs added. Click "Add Pair" to add one.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.rubric_grade_agents.map((rga, index) => (
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
                  {formData.active !== undefined ? (
                    <Switch
                      id="active"
                      checked={formData.active ?? true}
                      onCheckedChange={(checked) => {
                        handleInputChange("active", checked);
                      }}
                      disabled={isReadonly}
                      data-testid="switch-eval-active"
                    />
                  ) : null}
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
                  {formData.dynamic !== undefined ? (
                    <Switch
                      id="dynamic"
                      checked={formData.dynamic ?? false}
                      onCheckedChange={(checked) => {
                        handleInputChange("dynamic", checked);
                      }}
                      disabled={isReadonly}
                      data-testid="switch-eval-dynamic"
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  When enabled, the agent being evaluated will be re-run with a
                  modified system prompt before grading
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Agent Selection */}
        <Card
          className={cn(
            "transition-all",
            !isEditMode &&
              steps[1]?.status === "active" &&
              "ring-2 ring-primary",
            !isEditMode && steps[1]?.status === "pending" && "opacity-50"
          )}
        >
          <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  steps[1]?.status === "completed"
                    ? "bg-green-500 text-white"
                    : steps[1]?.status === "active"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                )}
              >
                {steps[1]?.status === "completed" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>2</span>
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {steps[1]?.title || "Agents"}
                </CardTitle>
                <CardDescription>
                  {steps[1]?.description || "Select agents to evaluate."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-6">
            <AgentCardGrid
              agents={evalData?.agents || []}
              validAgentIds={validAgentIds}
              selectedAgentIds={
                searchParams.get("agentIds")?.split(",").filter(Boolean) ||
                currentAgentIds
              }
              onSelect={handleAgentSelection}
              readonly={isReadonly}
            />
          </CardContent>
        </Card>

        {/* Step 3: Rubric Selection */}
        {currentAgentIds.length > 0 && (
          <Card
            className={cn(
              "transition-all",
              !isEditMode &&
                steps[2]?.status === "active" &&
                "ring-2 ring-primary",
              !isEditMode && steps[2]?.status === "pending" && "opacity-50"
            )}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    steps[2]?.status === "completed"
                      ? "bg-green-500 text-white"
                      : steps[2]?.status === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  )}
                >
                  {steps[2]?.status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>3</span>
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {steps[2]?.title || "Rubrics"}
                  </CardTitle>
                  <CardDescription>
                    {steps[2]?.description || "Select a rubric for evaluation."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-6">
              {validRubricIds.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">
                  No rubrics available for the selected agent role(s).
                </div>
              ) : (
                <RubricCardGrid
                  rubrics={filteredRubrics}
                  validRubricIds={validRubricIds}
                  selectedRubricId={
                    searchParams.get("rubricId") || currentRubricId
                  }
                  onSelect={handleRubricSelection}
                  readonly={isReadonly}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Model Runs Selection */}
        {formData.rubric_grade_agents.length > 0 && (
          <Card
            className={cn(
              "transition-all",
              !isEditMode &&
                steps[2]?.status === "active" &&
                "ring-2 ring-primary",
              !isEditMode && steps[2]?.status === "pending" && "opacity-50"
            )}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    steps[2]?.status === "completed"
                      ? "bg-green-500 text-white"
                      : steps[2]?.status === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  )}
                >
                  {steps[2]?.status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>3</span>
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {steps[2]?.title || "Model Runs"}
                  </CardTitle>
                  <CardDescription>
                    {steps[2]?.description || "Select model runs to evaluate."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-6">
              {effectiveProfile?.id && (
                <>
                  <ModelRunCardGrid
                    profileId={effectiveProfile.id}
                    selectedModelRunIds={
                      searchParams
                        .get("modelRunIds")
                        ?.split(",")
                        .filter(Boolean) || currentModelRunIds
                    }
                    onSelect={handleModelRunSelection}
                    agentIds={currentAgentIds}
                    readonly={isReadonly}
                    evalId={evalId || editingEvalId || undefined}
                  />

                  {/* Rubric/Agent Pairs for Selected Runs */}
                  {formData.eval_runs.length > 0 && (
                    <div className="space-y-4 mt-6 pt-6 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">
                          Rubrics and Grading Agents per Run
                        </Label>
                      </div>
                      <div className="space-y-4">
                        {formData.eval_runs.map((evalRun) => {
                          const runData = evalData?.model_runs?.find(
                            (mr) => mr.model_run_id === evalRun.run_id
                          );
                          const runDisplayName = runData
                            ? `${runData.model_name || "Run"} - ${runData.agent_name || ""}`
                            : `Run ${evalRun.run_id.slice(0, 8)}`;

                          return (
                            <Card key={evalRun.run_id} className="p-4">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {runDisplayName}
                                  </span>
                                </div>

                                {evalRun.rubric_grade_agents.length === 0 ? (
                                  <div className="text-sm text-muted-foreground py-2 text-center border border-dashed rounded-md">
                                    No rubric/agent pairs added. Click "Add
                                    Pair" to add one.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {evalRun.rubric_grade_agents.map(
                                      (rga, index) => (
                                        <div
                                          key={index}
                                          className="grid grid-cols-2 gap-4 p-3 border rounded-md"
                                        >
                                          <div className="space-y-2">
                                            <Label
                                              htmlFor={`rubric-${evalRun.run_id}-${index}`}
                                            >
                                              Rubric
                                            </Label>
                                            <GenericPicker
                                              items={evalData?.rubrics || []}
                                              itemIds={validRubricIds}
                                              selectedIds={
                                                rga.rubric_id
                                                  ? [rga.rubric_id]
                                                  : []
                                              }
                                              onSelect={(ids) =>
                                                handleUpdateRubricGradeAgentInRun(
                                                  evalRun.run_id,
                                                  index,
                                                  "rubric_id",
                                                  ids[0] || ""
                                                )
                                              }
                                              getId={(item) => item.rubric_id}
                                              getLabel={(item) =>
                                                item.name || ""
                                              }
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
                                                htmlFor={`agent-${evalRun.run_id}-${index}`}
                                              >
                                                Grading Agent
                                              </Label>
                                              {!isReadonly && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() =>
                                                    handleRemoveRubricGradeAgentFromRun(
                                                      evalRun.run_id,
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
                                                  evalRun.run_id,
                                                  index,
                                                  "grade_text_agent_id",
                                                  ids[0] || ""
                                                )
                                              }
                                              getId={(item) => item.agent_id}
                                              getLabel={(item) =>
                                                item.name || ""
                                              }
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
                                      )
                                    )}
                                  </div>
                                )}

                                {!isReadonly && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleAddRubricGradeAgentToRun(
                                        evalRun.run_id
                                      )
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
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Groups Selection */}
        {formData.use_groups && currentAgentIds.length > 0 && (
          <Card
            className={cn(
              "transition-all",
              !isEditMode &&
                steps[2]?.status === "active" &&
                "ring-2 ring-primary",
              !isEditMode && steps[2]?.status === "pending" && "opacity-50"
            )}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    steps[2]?.status === "completed"
                      ? "bg-green-500 text-white"
                      : steps[2]?.status === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  )}
                >
                  {steps[2]?.status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>3</span>
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {steps[2]?.title || "Groups"}
                  </CardTitle>
                  <CardDescription>
                    {steps[2]?.description || "Select groups to evaluate."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-6">
              {effectiveProfile?.id && (
                <>
                  <GroupCardGrid
                    profileId={effectiveProfile.id}
                    selectedGroupIds={currentGroupIds}
                    onSelect={(ids) => {
                      setCurrentGroupIds(ids);
                      // Update formData.eval_groups to match selected groups
                      setFormData((prev) => {
                        const existingGroupIds = new Set(
                          prev.eval_groups.map((g) => g.group_id)
                        );
                        const newGroupIds = new Set(ids);

                        // Remove groups that are no longer selected
                        const updatedGroups = prev.eval_groups.filter((g) =>
                          newGroupIds.has(g.group_id)
                        );

                        // Add new groups that weren't in the list
                        const groupsToAdd = ids
                          .filter((id) => !existingGroupIds.has(id))
                          .map((groupId) => ({
                            group_id: groupId,
                            rubric_grade_agents: [] as RubricGradeAgent[],
                          }));

                        return {
                          ...prev,
                          eval_groups: [...updatedGroups, ...groupsToAdd],
                        };
                      });
                    }}
                    readonly={isReadonly}
                    evalId={evalId || editingEvalId || undefined}
                  />

                  {/* Rubric/Agent Pairs for Selected Groups */}
                  {formData.eval_groups.length > 0 && (
                    <div className="space-y-4 mt-6 pt-6 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">
                          Rubrics and Grading Agents per Group
                        </Label>
                      </div>
                      <div className="space-y-4">
                        {formData.eval_groups.map((evalGroup) => {
                          const groupDisplayName = `Group ${evalGroup.group_id.slice(0, 8)}`;

                          return (
                            <Card key={evalGroup.group_id} className="p-4">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">
                                    {groupDisplayName}
                                  </span>
                                </div>

                                {evalGroup.rubric_grade_agents.length === 0 ? (
                                  <div className="text-sm text-muted-foreground py-2 text-center border border-dashed rounded-md">
                                    No rubric/agent pairs added. Click "Add
                                    Pair" to add one.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {evalGroup.rubric_grade_agents.map(
                                      (rga, index) => (
                                        <div
                                          key={index}
                                          className="grid grid-cols-2 gap-4 p-3 border rounded-md"
                                        >
                                          <div className="space-y-2">
                                            <Label
                                              htmlFor={`rubric-${evalGroup.group_id}-${index}`}
                                            >
                                              Rubric
                                            </Label>
                                            <GenericPicker
                                              items={evalData?.rubrics || []}
                                              itemIds={validRubricIds}
                                              selectedIds={
                                                rga.rubric_id
                                                  ? [rga.rubric_id]
                                                  : []
                                              }
                                              onSelect={(ids) =>
                                                handleUpdateRubricGradeAgentInGroup(
                                                  evalGroup.group_id,
                                                  index,
                                                  "rubric_id",
                                                  ids[0] || ""
                                                )
                                              }
                                              getId={(item) => item.rubric_id}
                                              getLabel={(item) =>
                                                item.name || ""
                                              }
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
                                                htmlFor={`agent-${evalGroup.group_id}-${index}`}
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
                                                      evalGroup.group_id,
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
                                                  evalGroup.group_id,
                                                  index,
                                                  "grade_text_agent_id",
                                                  ids[0] || ""
                                                )
                                              }
                                              getId={(item) => item.agent_id}
                                              getLabel={(item) =>
                                                item.name || ""
                                              }
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
                                      )
                                    )}
                                  </div>
                                )}

                                {!isReadonly && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleAddRubricGradeAgentToGroup(
                                        evalGroup.group_id
                                      )
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
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push("/engine/evals")}
            data-testid="btn-cancel-eval"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || isReadonly || (isEditMode && !hasChanges)}
            className="min-w-[120px]"
            data-testid="btn-submit-eval"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {evalId || editingEvalId ? "Updating..." : "Creating..."}
              </>
            ) : evalId || editingEvalId ? (
              "Update Eval"
            ) : (
              "Create Eval"
            )}
          </Button>
        </div>
      </form>

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent
          aria-labelledby="update-eval-title"
          data-testid="dialog-update-eval"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="update-eval-title">
              Update Eval
            </AlertDialogTitle>
            <AlertDialogDescription>
              This eval is currently being used. Are you sure you want to
              proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? "Updating..." : "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
