/**
 * Cohort.tsx
 * Used to create and manage cohorts for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
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

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SimulationCardGrid } from "@/components/common/cohorts/SimulationCardGrid";
import { CohortSimulationSection } from "@/components/common/cohorts/CohortSimulationSection";
import { Accordion } from "@/components/ui/accordion";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import { cn } from "@/lib/utils";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import {
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Power,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Import types from new page (create action)
import type {
  CohortNewOut,
  CreateCohortIn,
  CreateCohortOut,
} from "@/app/(main)/create/cohorts/new/page";
// Import types from edit page (update action)
import type {
  CohortDetailOut,
  UpdateCohortIn,
  UpdateCohortOut,
} from "@/app/(main)/create/cohorts/c/[cohortId]/page";

export interface CohortProps {
  cohortId?: string;
  // Server-provided data (for server-side rendering)
  cohortDetail?: CohortDetailOut;
  cohortDetailDefault?: CohortNewOut;
  // Server actions (replaces useMutation)
  createCohortAction?: (input: CreateCohortIn) => Promise<CreateCohortOut>;
  updateCohortAction?: (input: UpdateCohortIn) => Promise<UpdateCohortOut>;
}

interface FormErrors {
  title?: string;
}
interface FormData {
  title: string;
  description: string;
  active: boolean;
  departmentIds: string[] | null;
}

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
}

export default function Cohort({
  cohortId,
  cohortDetail: serverCohortDetail,
  cohortDetailDefault: serverCohortDetailDefault,
  createCohortAction,
  updateCohortAction,
}: CohortProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const isEditMode = !!cohortId;

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

  // State for accordion (only one section open at a time)
  const [openAccordionItem, setOpenAccordionItem] = useState<string | null>(
    null
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

  const initialFormData: FormData = {
    title: "",
    description: "",
    active: true,
    departmentIds: defaultDepartmentIds,
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [originalFormData, setOriginalFormData] =
    useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Simulation active state management (staged changes)
  const [simulationActiveStates, setSimulationActiveStates] = useState<
    Record<string, boolean>
  >({});
  const [originalSimulationActiveStates, setOriginalSimulationActiveStates] =
    useState<Record<string, boolean>>({});

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const cohortDetail = serverCohortDetail;
  const cohortDetailDefault = serverCohortDetailDefault;

  // Use edit detail when editing, default detail when creating
  const cohortData = isEditMode ? cohortDetail : cohortDetailDefault;

  // Set breadcrumb context when cohort data is loaded
  useEffect(() => {
    if (cohortDetail?.title && cohortId && isEditMode) {
      setEntityMetadata({
        entityId: cohortId,
        entityName: cohortDetail.title,
        entityType: "cohort",
      });
    }
    return () => clearEntityMetadata();
  }, [
    cohortDetail,
    cohortId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Extract body types for type safety
  type CreateCohortBody = CreateCohortIn extends { body: infer B } ? B : never;
  type UpdateCohortBody = UpdateCohortIn extends { body: infer B } ? B : never;

  // Server action handlers
  const handleCreateCohort = async (body: CreateCohortBody) => {
    if (!createCohortAction) {
      throw new Error("createCohortAction is required");
    }
    await createCohortAction({ body });
  };

  const handleUpdateCohort = async (body: UpdateCohortBody) => {
    if (!updateCohortAction) {
      throw new Error("updateCohortAction is required");
    }
    await updateCohortAction({ body });
  };

  // State for junction data
  const [currentSimulationIds, setCurrentSimulationIds] = useState<string[]>(
    []
  );

  // Readonly logic using server-provided can_edit flag
  const isReadonly = useMemo(() => {
    if (!isEditMode || !cohortData) return false;
    return !cohortData.can_edit;
  }, [isEditMode, cohortData]);

  // Filter valid IDs based on selected departments
  const departmentMapping = useMemo(
    () => cohortData?.department_mapping || {},
    [cohortData?.department_mapping]
  );

  const validSimulationIds = useMemo(() => {
    const baseIds = cohortData?.valid_simulation_ids || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of simulation_ids from selected departments
    const deptSimulationIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.simulation_ids && Array.isArray(deptData.simulation_ids)) {
        deptData.simulation_ids.forEach((id) => deptSimulationIds.add(id));
      }
    });

    // Filter base IDs to only include those in department simulation IDs
    return baseIds.filter((id) => deptSimulationIds.has(id));
  }, [
    cohortData?.valid_simulation_ids,
    formData?.departmentIds,
    departmentMapping,
  ]);

  // Handle simulation selection from picker
  const handleSimulationSelection = useCallback(
    (simulationIds: string[]) => {
      setCurrentSimulationIds(simulationIds);
      // Update URL params when simulations are selected
      updateUrlParams({
        simulationIds: simulationIds.length > 0 ? simulationIds : null,
      });
    },
    [updateUrlParams]
  );

  // Sync simulation IDs from URL params (DHH-style: compute when needed, not in effects)
  // Only sync FROM URL TO state when URL changes (browser navigation, direct URL entry)
  // IMPORTANT: Compare order-preserving arrays, not sorted arrays
  useEffect(() => {
    const simulationIdsFromUrl =
      searchParams.get("simulationIds")?.split(",").filter(Boolean) || [];
    
    // Compare arrays preserving order (not sorted)
    const arraysEqual = 
      simulationIdsFromUrl.length === currentSimulationIds.length &&
      simulationIdsFromUrl.every((id, idx) => id === currentSimulationIds[idx]);
    
    if (!arraysEqual) {
      setCurrentSimulationIds(simulationIdsFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only watch searchParams - don't re-run when state changes

  // Position handlers for simulations
  const handleSimulationMoveUp = useCallback(
    (simulationId: string) => {
      // Get ordered simulation IDs from searchParams (source of truth) - ALWAYS use searchParams first
      const orderedIds =
        searchParams.get("simulationIds")?.split(",").filter(Boolean) ||
        [...currentSimulationIds];

      const index = orderedIds.indexOf(simulationId);
      if (index <= 0) return;

      // Swap with previous item
      const reorderedIds = [...orderedIds];
      [reorderedIds[index - 1], reorderedIds[index]] = [
        reorderedIds[index],
        reorderedIds[index - 1],
      ];

      // Update state and URL params (URL params are source of truth)
      setCurrentSimulationIds(reorderedIds);
      updateUrlParams({
        simulationIds: reorderedIds.length > 0 ? reorderedIds : null,
      });
    },
    [currentSimulationIds, isEditMode, searchParams, updateUrlParams]
  );

  const handleSimulationMoveDown = useCallback(
    (simulationId: string) => {
      // Get ordered simulation IDs from searchParams (source of truth) - ALWAYS use searchParams first
      const orderedIds =
        searchParams.get("simulationIds")?.split(",").filter(Boolean) ||
        [...currentSimulationIds];

      const index = orderedIds.indexOf(simulationId);
      if (index < 0 || index >= orderedIds.length - 1) return;

      // Swap with next item
      const reorderedIds = [...orderedIds];
      [reorderedIds[index], reorderedIds[index + 1]] = [
        reorderedIds[index + 1],
        reorderedIds[index],
      ];

      // Update state and URL params (URL params are source of truth)
      setCurrentSimulationIds(reorderedIds);
      updateUrlParams({
        simulationIds: reorderedIds.length > 0 ? reorderedIds : null,
      });
    },
    [currentSimulationIds, isEditMode, searchParams, updateUrlParams]
  );

  // Handle simulation active toggle
  const handleSimulationActiveToggle = useCallback(
    (simulationId: string, active: boolean) => {
      setSimulationActiveStates((prev) => ({
        ...prev,
        [simulationId]: active,
      }));
    },
    []
  );

  // Load cohort data from V2 API response
  useEffect(() => {
    if (cohortData && isEditMode) {
      const deptIds = cohortData.department_ids || [];
      const cohortFormData = {
        title: cohortData.title || "",
        description: cohortData.description || "",
        active: cohortData.active ?? true,
        departmentIds: deptIds,
      };

      // Only update if the data has actually changed to prevent infinite loops
      setFormData((prev) => {
        const hasChanged =
          prev.title !== cohortFormData.title ||
          prev.description !== cohortFormData.description ||
          prev.active !== cohortFormData.active ||
          JSON.stringify(prev.departmentIds?.sort()) !==
            JSON.stringify(cohortFormData.departmentIds?.sort());

        return hasChanged ? cohortFormData : prev;
      });

      setOriginalFormData((prev) => {
        const hasChanged =
          prev.title !== cohortFormData.title ||
          prev.description !== cohortFormData.description ||
          prev.active !== cohortFormData.active ||
          JSON.stringify(prev.departmentIds?.sort()) !==
            JSON.stringify(cohortFormData.departmentIds?.sort());

        return hasChanged ? cohortFormData : prev;
      });

      // Load simulation IDs
      // Prioritize URL params if they exist, otherwise use server data
      const simulationIdsFromUrl =
        searchParams.get("simulationIds")?.split(",").filter(Boolean) || [];
      const orderedSimulationIds =
        simulationIdsFromUrl.length > 0
          ? simulationIdsFromUrl
          : cohortData.simulation_ids || [];

      setCurrentSimulationIds((prev) => {
        // Compare arrays preserving order (not sorted)
        const hasChanged =
          prev.length !== orderedSimulationIds.length ||
          prev.some((id, idx) => id !== orderedSimulationIds[idx]);
        return hasChanged ? orderedSimulationIds : prev;
      });

      // Update URL params if we're using server data and URL is empty (only in edit mode)
      // Only do this once to prevent infinite loops
      if (
        isEditMode &&
        !hasInitializedUrlParamsRef.current &&
        simulationIdsFromUrl.length === 0 &&
        orderedSimulationIds.length > 0
      ) {
        hasInitializedUrlParamsRef.current = true;
        updateUrlParams({
          simulationIds: orderedSimulationIds,
        });
      }

      // Initialize simulation active states from server data
      if (cohortData.simulations) {
        const activeStates: Record<string, boolean> = {};
        cohortData.simulations.forEach((sim) => {
          activeStates[sim.simulation_id] = sim.active;
        });
        setSimulationActiveStates(activeStates);
        setOriginalSimulationActiveStates(activeStates);
      }
    }
  }, [cohortData, isEditMode, searchParams, updateUrlParams]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    // Get original simulation IDs from cohortData
    const originalSimulationIds = cohortData?.simulation_ids || [];

    return (
      current.title !== original.title ||
      current.description !== original.description ||
      current.active !== original.active ||
      JSON.stringify(current.departmentIds?.sort()) !==
        JSON.stringify(original.departmentIds?.sort()) ||
      JSON.stringify([...currentSimulationIds].sort()) !==
        JSON.stringify(originalSimulationIds.sort()) ||
      JSON.stringify(simulationActiveStates) !==
        JSON.stringify(originalSimulationActiveStates)
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    currentSimulationIds,
    cohortData?.simulation_ids,
    simulationActiveStates,
    originalSimulationActiveStates,
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
      const hasTitle = !!formData?.title?.trim();
      const hasSimulations = currentSimulationIds.length > 0;

      switch (stepId) {
        case "basic":
          return hasTitle ? "completed" : "active";
        case "simulations":
          if (!hasTitle) return "pending";
          return hasSimulations ? "completed" : "active";
        default:
          // Handle simulation-specific steps (format: "simulation-{simulationId}")
          if (stepId.startsWith("simulation-")) {
            if (!hasSimulations) return "pending";
            // Always mark as completed since there's nothing to verify
            return "completed";
          }
          return "pending";
      }
    },
    [formData?.title, currentSimulationIds.length]
  );

  // Steps array
  const steps: Step[] = useMemo(() => {
    return [
      {
        id: "basic",
        title: "Basic Information",
        description: "Set the cohort name, description, departments, and active status.",
        status: getStepStatus("basic"),
      },
      {
        id: "simulations",
        title: "Simulations",
        description: "Select simulations to include in this cohort.",
        status: getStepStatus("simulations"),
      },
    ];
  }, [getStepStatus]);

  // Compute ordered simulation items for display
  const orderedSimulationItems = useMemo(() => {
    // Get ordered simulation IDs from searchParams (source of truth)
    const orderedIds =
      searchParams.get("simulationIds")?.split(",").filter(Boolean) ||
      currentSimulationIds;

    // Track which simulation IDs are in saved cohort data
    const savedSimulationIds = new Set(
      cohortData?.simulations?.map((s) => s.simulation_id) || []
    );

    return orderedIds.map((simulationId, index) => {
      const simulation = cohortData?.simulation_mapping[simulationId];
      const simulationData = cohortData?.simulations?.find(
        (s) => s.simulation_id === simulationId
      );

      // A simulation is "new" if it's selected but not in saved cohort data
      const isNew = !savedSimulationIds.has(simulationId);

      return {
        simulationId,
        simulationName: simulation?.name || "Unnamed Simulation",
        simulationDescription: simulation?.description || "",
        position: index + 1,
        active: simulationActiveStates[simulationId] ?? simulationData?.active ?? true,
        isNew,
      };
    });
  }, [
    searchParams,
    currentSimulationIds,
    cohortData?.simulation_mapping,
    cohortData?.simulations,
    simulationActiveStates,
  ]);

  // Set first accordion item as open by default when simulations are available
  useEffect(() => {
    if (
      orderedSimulationItems.length > 0 &&
      openAccordionItem === null &&
      !isReadonly
    ) {
      const firstSimulationId = orderedSimulationItems[0]?.simulationId;
      if (firstSimulationId) {
        setOpenAccordionItem(`simulation:${firstSimulationId}`);
      }
    }
  }, [orderedSimulationItems.length, isReadonly]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = "Title is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setOriginalFormData(initialFormData);
    setEditingCohortId(null);
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const validDepartmentIds = cohortData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        validDepartmentIds
      );

      const targetCohortId = cohortId || editingCohortId;
      if (targetCohortId) {
        // UPDATE mode
        const updateRequest: UpdateCohortBody = {
          cohortId: targetCohortId,
          title: formData.title || "",
          description: formData.description || null,
          department_ids: finalDepartmentIds || [],
          active: formData.active ?? true,
          profile_ids: [], // Profile management moved to staff page
          simulation_ids: currentSimulationIds,
        };
        await handleUpdateCohort(updateRequest);

        toast.success("Cohort updated successfully!");
      } else {
        // CREATE mode
        const createRequest: CreateCohortBody = {
          title: formData.title || "",
          description: formData.description || null,
          department_ids: finalDepartmentIds || [],
          active: formData.active || true,
          profile_ids: [], // Profile management moved to staff page
          simulation_ids: currentSimulationIds,
        };
        await handleCreateCohort(createRequest);

        toast.success("Cohort created successfully!");
      }

      resetFormAndState();
      router.push(`/create/cohorts`);
    } catch (error) {
      const targetCohortId = cohortId || editingCohortId;
      toast.error(
        `Failed to ${targetCohortId ? "update" : "create"} cohort: ${error instanceof Error ? error.message : "Unknown error"}`
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

  // Get can_remove map for simulations
  const simulationCanRemoveMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (cohortData?.simulations) {
      cohortData.simulations.forEach((sim) => {
        map[sim.simulation_id] = sim.can_remove ?? false;
      });
    }
    return map;
  }, [cohortData?.simulations]);


  return (
    <div
      className="w-full p-6 space-y-8"
      data-page={`cohort-${isEditMode ? "edit" : "new"}`}
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
                Cohort is read-only
              </h3>
              <div className="mt-2 text-sm text-muted-foreground">
                <p>
                  {cohortData?.department_ids?.length === 0
                    ? "This is a default cohort that cannot be edited. You can view the details but cannot make changes."
                    : "This cohort cannot be edited. You can view the details but cannot make changes."}
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
                {formData?.title !== undefined ? (
                  <input
                    type="text"
                    id="title"
                    data-testid="input-cohort-title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    className={cn(
                      "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
                      errors.title && "border-destructive"
                    )}
                    placeholder="New Cohort"
                    disabled={isReadonly}
                  />
                ) : null}
                <p className="text-xs text-muted-foreground mt-1 px-2">
                  {formData?.title === "" || !formData?.title
                    ? "Click to edit • Name will be auto-generated if unchanged"
                    : "Click to edit"}
                </p>
                {errors.title && (
                  <p className="text-sm text-destructive mt-1 px-2">
                    {errors.title}
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
                  data-testid="input-cohort-description"
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
            {cohortData?.valid_department_ids &&
              cohortData.valid_department_ids.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  {formData?.departmentIds !== undefined ? (
                    <GenericPicker
                      items={cohortData?.department_mapping || {}}
                      itemIds={cohortData?.valid_department_ids || []}
                      selectedIds={formData.departmentIds || []}
                      onSelect={(ids) => handleInputChange("departmentIds", ids)}
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
                      onCheckedChange={(checked) =>
                        handleInputChange("active", checked)
                      }
                      disabled={isReadonly}
                      data-testid="switch-cohort-active"
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground pl-5">
                  Inactive cohorts will not be shown
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Simulations Selection */}
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
                  {steps[1]?.title || "Simulations"}
                </CardTitle>
                <CardDescription>
                  {steps[1]?.description ||
                    "Select simulations to include in this cohort."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-6">
            <SimulationCardGrid
              simulationMapping={cohortData?.simulation_mapping || {}}
              validSimulationIds={validSimulationIds}
              selectedSimulationIds={
                // Use searchParams as source of truth for ordering (like Simulation.tsx)
                searchParams.get("simulationIds")?.split(",").filter(Boolean) ||
                currentSimulationIds
              }
              onSelect={handleSimulationSelection}
              readonly={isReadonly}
              canRemoveMap={simulationCanRemoveMap}
            />
          </CardContent>
        </Card>

        {/* Individual Simulation Configuration Steps */}
        {orderedSimulationItems.length > 0 && (
          <Accordion
            type="single"
            collapsible
            value={openAccordionItem || undefined}
            onValueChange={(value) => setOpenAccordionItem(value || null)}
            className="space-y-4"
          >
            {orderedSimulationItems.map((item) => {
              const accordionValue = `simulation:${item.simulationId}`;
              const stepId = `simulation-${item.simulationId}`;
              return (
                <CohortSimulationSection
                  key={item.simulationId}
                  simulationId={item.simulationId}
                  simulationName={item.simulationName}
                  simulationDescription={item.simulationDescription}
                  position={item.position}
                  totalItems={orderedSimulationItems.length}
                  active={item.active}
                  isNew={item.isNew}
                  onActiveToggle={handleSimulationActiveToggle}
                  onMoveUp={handleSimulationMoveUp}
                  onMoveDown={handleSimulationMoveDown}
                  readonly={isReadonly}
                  stepStatus={getStepStatus(stepId)}
                  stepNumber={item.position + 2} // After basic (1) and simulations (2)
                  isEditMode={isEditMode}
                  accordionValue={accordionValue}
                  isAccordionOpen={openAccordionItem === accordionValue}
                  onAccordionToggle={(open) =>
                    setOpenAccordionItem(open ? accordionValue : null)
                  }
                />
              );
            })}
          </Accordion>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            type="button"
            onClick={() => router.push("/create/cohorts")}
            data-testid="btn-cancel-cohort"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={
              isSubmitting || isReadonly || (isEditMode && !hasChanges)
            }
            className="min-w-[120px]"
            data-testid="btn-submit-cohort"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {cohortId || editingCohortId ? "Updating..." : "Creating..."}
              </>
            ) : cohortId || editingCohortId ? (
              "Update Cohort"
            ) : (
              "Create Cohort"
            )}
          </Button>
        </div>
      </form>

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent
          aria-labelledby="update-cohort-title"
          data-testid="dialog-update-cohort"
        >
          <AlertDialogHeader>
            <AlertDialogTitle id="update-cohort-title">
              Update Cohort
            </AlertDialogTitle>
            <AlertDialogDescription>
              This cohort is currently used by {currentSimulationIds.length || 0}{" "}
              simulation{(currentSimulationIds.length || 0) !== 1 ? "s" : ""}:
              <ul className="mt-2 list-disc list-inside">
                {currentSimulationIds.map((simId) => {
                  const sim = cohortData?.simulation_mapping[simId];
                  return (
                    <li key={simId} className="text-sm">
                      {sim?.name || "Unknown Simulation"}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 text-sm font-medium">
                Updating this cohort will affect all simulations that use it.
                Are you sure you want to proceed?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isSubmitting}
              data-testid="btn-cancel-update"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUpdate}
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="btn-confirm-update"
            >
              {isSubmitting ? "Updating..." : "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
