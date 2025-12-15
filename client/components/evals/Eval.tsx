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
import { Check, Loader2, Power } from "lucide-react";
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

interface FormData {
  name: string;
  description: string;
  active: boolean;
  departmentIds: string[] | null;
  eval_agent_id: string | null;
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
      departmentIds: defaultDepartmentIds,
      eval_agent_id: null,
    };
  }, [defaultDepartmentIds]);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [originalFormData, setOriginalFormData] =
    useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // State for selected agents (being evaluated)
  const [currentAgentIds, setCurrentAgentIds] = useState<string[]>([]);
  // State for selected rubric
  const [currentRubricId, setCurrentRubricId] = useState<string | null>(null);
  // State for selected model runs
  const [currentModelRunIds, setCurrentModelRunIds] = useState<string[]>([]);

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

  // Extract body types for type safety
  type CreateEvalBody = CreateEvalIn extends { body: infer B } ? B : never;
  type UpdateEvalBody = UpdateEvalIn extends { body: infer B } ? B : never;

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

  // Filter valid IDs based on selected departments
  const departmentMapping = useMemo(
    () => evalData?.department_mapping || {},
    [evalData?.department_mapping]
  );

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

  // Get valid rubric IDs - filtered by selected agent role(s)
  const validRubricIds = useMemo(() => {
    const baseIds = evalData?.valid_rubric_ids || [];
    const selectedAgentIds = currentAgentIds;

    // If no agents selected, return all valid IDs
    if (selectedAgentIds.length === 0) {
      return baseIds;
    }

    // Get agent roles from selected agents
    const agentRoles = new Set<string>();
    selectedAgentIds.forEach((agentId) => {
      const agent = evalData?.agent_mapping?.[agentId];
      if (agent?.roles && agent.roles.length > 0) {
        agent.roles.forEach((role) => agentRoles.add(role));
      }
    });

    // Filter rubrics by agent role
    // Rubric mapping includes agent_role field
    const rubricMapping = evalData?.rubric_mapping || {};
    return baseIds.filter((rubricId) => {
      const rubric = rubricMapping[rubricId];
      if (!rubric) return false;
      const rubricAgentRole = (rubric as { agent_role?: string })?.agent_role;
      if (!rubricAgentRole) return true; // Include if no agent_role specified
      return agentRoles.has(rubricAgentRole);
    });
  }, [
    evalData?.valid_rubric_ids,
    evalData?.rubric_mapping,
    evalData?.agent_mapping,
    currentAgentIds,
  ]);

  // Build rubric mapping filtered by valid rubric IDs
  const rubricMapping = useMemo(() => {
    const allMapping = evalData?.rubric_mapping || {};
    const validIds = new Set(validRubricIds);
    const filtered: Record<
      string,
      { name: string; description?: string; agent_role?: string }
    > = {};
    Object.entries(allMapping).forEach(([id, rubric]) => {
      if (validIds.has(id)) {
        filtered[id] = rubric as {
          name: string;
          description?: string;
          agent_role?: string;
        };
      }
    });
    return filtered;
  }, [evalData?.rubric_mapping, validRubricIds]);

  // Handle agent selection from picker (single selection only)
  const handleAgentSelection = useCallback(
    (agentIds: string[]) => {
      // Only allow single agent selection - take the first one if any
      const singleAgentId =
        agentIds.length > 0 && agentIds[0] ? [agentIds[0]] : [];
      setCurrentAgentIds(singleAgentId);
      // Update URL params when agents are selected
      updateUrlParams({
        agentIds: singleAgentId.length > 0 ? singleAgentId : null,
      });
      // Reset rubric selection if agent changes and current rubric is invalid
      if (currentRubricId && !validRubricIds.includes(currentRubricId)) {
        setCurrentRubricId(null);
        updateUrlParams({ rubricId: null });
      }
    },
    [updateUrlParams, currentRubricId, validRubricIds]
  );

  // Handle rubric selection
  const handleRubricSelection = useCallback(
    (rubricId: string | null) => {
      setCurrentRubricId(rubricId);
      updateUrlParams({
        rubricId: rubricId || null,
      });
    },
    [updateUrlParams]
  );

  // Handle model run selection
  const handleModelRunSelection = useCallback(
    (modelRunIds: string[]) => {
      setCurrentModelRunIds(modelRunIds);
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
    const rubricIdFromUrl = searchParams.get("rubricId") || null;
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
    if (rubricIdFromUrl !== currentRubricId) {
      setCurrentRubricId(rubricIdFromUrl);
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
      const evalFormData = {
        name: evalData.name || "",
        description: evalData.description || "",
        active: evalData.active ?? true,
        departmentIds: deptIds,
        eval_agent_id: evalData.eval_agent_id || null,
      };

      // Only update if the data has actually changed to prevent infinite loops
      setFormData((prev) => {
        const hasChanged =
          prev.name !== evalFormData.name ||
          prev.description !== evalFormData.description ||
          prev.active !== evalFormData.active ||
          JSON.stringify(prev.departmentIds?.sort()) !==
            JSON.stringify(evalFormData.departmentIds?.sort()) ||
          prev.eval_agent_id !== evalFormData.eval_agent_id;

        return hasChanged ? evalFormData : prev;
      });

      setOriginalFormData((prev) => {
        const hasChanged =
          prev.name !== evalFormData.name ||
          prev.description !== evalFormData.description ||
          prev.active !== evalFormData.active ||
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

      // Get agent_ids from eval data (if available)
      // Note: eval detail might have agent_id (single) or we need to derive from model_runs
      const serverAgentIds: string[] = [];
      if (evalData.agent_id) {
        serverAgentIds.push(evalData.agent_id);
      }
      // Also get unique agent_ids from model_runs
      evalData.model_runs?.forEach((mr) => {
        if (mr.agent_id && !serverAgentIds.includes(mr.agent_id)) {
          serverAgentIds.push(mr.agent_id);
        }
      });

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
    const originalAgentIds: string[] = [];
    if (evalData?.agent_id) {
      originalAgentIds.push(evalData.agent_id);
    }
    evalData?.model_runs?.forEach((mr) => {
      if (mr.agent_id && !originalAgentIds.includes(mr.agent_id)) {
        originalAgentIds.push(mr.agent_id);
      }
    });
    const originalRubricId = evalData?.rubric_id || null;
    const originalModelRunIds =
      evalData?.model_runs?.map((mr) => mr.model_run_id) || [];

    return (
      current.name !== original.name ||
      current.description !== original.description ||
      current.active !== original.active ||
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
      const hasRubric = !!currentRubricId;
      const hasModelRuns = currentModelRunIds.length > 0;

      switch (stepId) {
        case "basic":
          return hasName ? "completed" : "active";
        case "agents":
          if (!hasName) return "pending";
          return hasAgents ? "completed" : "active";
        case "rubrics":
          if (!hasAgents) return "pending";
          return hasRubric ? "completed" : "active";
        case "modelRuns":
          if (!hasRubric) return "pending";
          return hasModelRuns ? "completed" : "active";
        default:
          return "pending";
      }
    },
    [
      formData?.name,
      currentAgentIds.length,
      currentRubricId,
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
          "Set the eval name, description, departments, active status, and eval agent.",
        status: getStepStatus("basic"),
      },
      {
        id: "agents",
        title: "Agents",
        description: "Select agents to evaluate.",
        status: getStepStatus("agents"),
      },
      {
        id: "rubrics",
        title: "Rubrics",
        description: "Select a rubric for evaluation.",
        status: getStepStatus("rubrics"),
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

    if (!currentRubricId) {
      toast.error("Please select a rubric");
      return false;
    }

    if (currentModelRunIds.length === 0) {
      toast.error("Please select at least one model run");
      return false;
    }

    if (!formData.eval_agent_id) {
      toast.error("Please select an eval agent");
      return false;
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
    setCurrentRubricId(null);
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
        // UPDATE mode
        const updateRequest: UpdateEvalBody = {
          evalId: targetEvalId,
          name: formData.name || "",
          description: formData.description || "",
          rubric_id: currentRubricId || "",
          agent_id: currentAgentIds[0] || null, // For now, use first agent (can be extended to support multiple)
          eval_agent_id: formData.eval_agent_id || "",
          department_ids: finalDepartmentIds || [],
          active: formData.active ?? true,
          model_run_ids: currentModelRunIds,
        };
        await handleUpdateEval(updateRequest);

        toast.success("Eval updated successfully!");
      } else {
        // CREATE mode
        const createRequest: CreateEvalBody = {
          name: formData.name || "",
          description: formData.description || "",
          rubric_id: currentRubricId || "",
          agent_id: currentAgentIds[0] || "", // For now, use first agent
          eval_agent_id: formData.eval_agent_id || "",
          department_ids: finalDepartmentIds || [],
          active: formData.active || true,
          model_run_ids: currentModelRunIds,
        };
        await handleCreateEval(createRequest);

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

  // Get eval agent mapping (agents with 'eval' role)
  const evalAgentMapping = useMemo(() => {
    return evalData?.eval_agent_mapping || evalData?.agent_mapping || {};
  }, [evalData?.eval_agent_mapping, evalData?.agent_mapping]);

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
                  {formData?.name === "" || !formData?.name
                    ? "Click to edit • Name will be auto-generated if unchanged"
                    : "Click to edit"}
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
                      items={evalData?.department_mapping || {}}
                      itemIds={evalData?.valid_department_ids || []}
                      selectedIds={formData.departmentIds || []}
                      onSelect={(ids) =>
                        handleInputChange("departmentIds", ids)
                      }
                      getId={(dept) => (dept as unknown as { id: string }).id}
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

            {/* Eval Agent Selection */}
            {validEvalAgentIds.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="eval_agent_id">Eval Agent</Label>
                {formData?.eval_agent_id !== undefined ? (
                  <GenericPicker
                    items={evalAgentMapping}
                    itemIds={validEvalAgentIds}
                    selectedIds={
                      formData.eval_agent_id ? [formData.eval_agent_id] : []
                    }
                    onSelect={(ids) =>
                      handleInputChange("eval_agent_id", ids[0] || null)
                    }
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
                    placeholder="Select eval agent"
                    disabled={isReadonly}
                    multiSelect={false}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                    groupHeading="Agents"
                  />
                ) : null}
              </div>
            )}

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
              agentMapping={evalData?.agent_mapping || {}}
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
                  rubricMapping={rubricMapping}
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

        {/* Step 4: Model Runs Selection */}
        {currentRubricId && (
          <Card
            className={cn(
              "transition-all",
              !isEditMode &&
                steps[3]?.status === "active" &&
                "ring-2 ring-primary",
              !isEditMode && steps[3]?.status === "pending" && "opacity-50"
            )}
          >
            <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    steps[3]?.status === "completed"
                      ? "bg-green-500 text-white"
                      : steps[3]?.status === "active"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                  )}
                >
                  {steps[3]?.status === "completed" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>4</span>
                  )}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {steps[3]?.title || "Model Runs"}
                  </CardTitle>
                  <CardDescription>
                    {steps[3]?.description || "Select model runs to evaluate."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-6">
              {effectiveProfile?.id && (
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
                />
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
