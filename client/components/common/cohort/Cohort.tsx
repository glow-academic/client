/**
 * Cohort.tsx
 * Used to create and manage cohorts for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { StaffDataTable } from "@/components/management/staff/StaffDataTable";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  useCohortDetail,
  useCohortDetailDefault,
  useCreateCohort,
  useRemoveProfilesFromCohort,
  useUpdateCohort,
} from "@/lib/api/v2/hooks/cohorts";
import type { ProfileListItem } from "@/lib/api/v2/schemas/profile";
import { BarChart3, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SimulationPicker } from "./SimulationPicker";

export interface CohortProps {
  cohortId?: string;
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
export default function Cohort({ cohortId }: CohortProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [draggedSimulation, setDraggedSimulation] = useState<string | null>(
    null
  );
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const isEditMode = !!cohortId;

  const initialFormData: FormData = {
    title: "",
    description: "",
    active: true,
    departmentIds: effectiveProfile?.primaryDepartmentId
      ? [effectiveProfile.primaryDepartmentId]
      : [],
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [originalFormData, setOriginalFormData] =
    useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Staff management state (for StaffDataTable)
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Staged profiles to be added when cohort is updated
  // Store minimal profile data for immediate display
  interface StagedProfile {
    profileId: string;
    firstName?: string;
    lastName?: string;
    alias?: string;
    role?: string;
    requestsPerDay?: number | null;
    totalRequests?: number;
  }
  const [stagedProfilesToAdd, setStagedProfilesToAdd] = useState<
    StagedProfile[]
  >([]);

  // Simulation active state management (staged changes)
  const [simulationActiveStates, setSimulationActiveStates] = useState<
    Record<string, boolean>
  >({});
  const [originalSimulationActiveStates, setOriginalSimulationActiveStates] =
    useState<Record<string, boolean>>({});

  // Memoize callback functions to prevent unnecessary re-renders
  // Mutation hooks for removing profiles
  const removeProfilesFromCohortMutation = useRemoveProfilesFromCohort();

  // V2 API hooks
  const {
    data: cohortDetail,
    isLoading: isLoadingCohortDetail,
    refetch: refetchCohortDetail,
  } = useCohortDetail(
    cohortId || "",
    effectiveProfile?.id || "",
    !!cohortId && isEditMode
  );

  const { data: cohortDetailDefault, isLoading: isLoadingCohortDefault } =
    useCohortDetailDefault(effectiveProfile?.id || "", !isEditMode);

  // Use edit detail when editing, default detail when creating
  const cohortData = isEditMode ? cohortDetail : cohortDetailDefault;
  const isLoadingData = isEditMode
    ? isLoadingCohortDetail
    : isLoadingCohortDefault;

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

  // Mutation hooks
  const createCohortMutation = useCreateCohort();
  const updateCohortMutation = useUpdateCohort();

  // State for junction data
  const [currentSimulationIds, setCurrentSimulationIds] = useState<string[]>(
    []
  );

  const isLoading = isLoadingData;

  // Readonly logic using v2 permission flags
  const isReadonly = useMemo(() => {
    if (!isEditMode || !cohortData) return false;
    // V2 API doesn't return explicit can_edit flag in detail response
    // Infer from default_cohort and user role
    const isDefaultCohort = cohortData?.department_ids?.length === 0;
    if (isDefaultCohort && effectiveProfile?.role !== "superadmin") {
      return true; // Only superadmins can edit default cohorts
    }
    return false; // Otherwise editable (permissions handled server-side)
  }, [isEditMode, cohortData, effectiveProfile?.role]);

  // Filter valid IDs based on selected departments
  const departmentMapping = useMemo(
    () => cohortData?.department_mapping || {},
    [cohortData?.department_mapping]
  );

  // Staged selections per department (preserved when departments are deselected)
  type StagedSelections = {
    simulation_ids?: string[];
    profile_ids?: string[];
  };
  const [_stagedSelections, setStagedSelections] = useState<
    Record<string, StagedSelections>
  >({});
  const [previousDepartmentIds, setPreviousDepartmentIds] = useState<string[]>(
    []
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

  const validProfileIds = useMemo(() => {
    const baseIds = cohortData?.valid_profile_ids || [];
    const selectedDeptIds = formData?.departmentIds || [];

    // If no departments selected, return all valid IDs
    if (selectedDeptIds.length === 0) {
      return baseIds;
    }

    // Get union of staff_ids from selected departments
    const deptStaffIds = new Set<string>();
    selectedDeptIds.forEach((deptId) => {
      const deptData = departmentMapping[deptId];
      if (deptData?.staff_ids && Array.isArray(deptData.staff_ids)) {
        deptData.staff_ids.forEach((id) => deptStaffIds.add(id));
      }
    });

    // Filter base IDs to only include those in department staff IDs
    return baseIds.filter((id) => deptStaffIds.has(id));
  }, [
    cohortData?.valid_profile_ids,
    formData?.departmentIds,
    departmentMapping,
  ]);

  // Track department changes and manage staged selections
  useEffect(() => {
    const currentDeptIds = formData?.departmentIds || [];
    const prevDeptIds = previousDepartmentIds || [];

    // Skip if no change (initial load or same selection)
    if (
      currentDeptIds.length === prevDeptIds.length &&
      currentDeptIds.every((id, idx) => id === prevDeptIds[idx])
    ) {
      // Initialize on first load
      if (prevDeptIds.length === 0 && currentDeptIds.length > 0) {
        setPreviousDepartmentIds(currentDeptIds);
      }
      return;
    }

    // Find departments that were deselected
    const deselectedDepts = prevDeptIds.filter(
      (id) => !currentDeptIds.includes(id)
    );

    // Find departments that were newly selected
    const newlySelectedDepts = currentDeptIds.filter(
      (id) => !prevDeptIds.includes(id)
    );

    // Save selections for deselected departments
    if (deselectedDepts.length > 0) {
      setStagedSelections((prev) => {
        const updated = { ...prev };
        deselectedDepts.forEach((deptId) => {
          updated[deptId] = {
            simulation_ids: [...currentSimulationIds],
            profile_ids: cohortData?.staff?.map((p) => p.profile_id) || [],
          };
        });
        return updated;
      });
    }

    // Restore selections for newly selected departments
    if (newlySelectedDepts.length > 0) {
      setStagedSelections((prev) => {
        newlySelectedDepts.forEach((deptId) => {
          const staged = prev[deptId];
          if (staged) {
            // Restore simulations if valid
            if (staged.simulation_ids && staged.simulation_ids.length > 0) {
              const validSimSet = new Set(validSimulationIds);
              const validSims = staged.simulation_ids.filter((id) =>
                validSimSet.has(id)
              );
              if (validSims.length > 0) {
                setCurrentSimulationIds((prevSims) => {
                  const combined = new Set([...prevSims, ...validSims]);
                  return Array.from(combined);
                });
              }
            }

            // Profile restoration is handled via StaffDataTable API calls - profiles are managed directly through the API
          }
        });
        return prev;
      });
    }

    // Update previous department IDs
    setPreviousDepartmentIds(currentDeptIds);
  }, [
    formData?.departmentIds,
    previousDepartmentIds,
    currentSimulationIds,
    cohortData?.staff,
    validSimulationIds,
    validProfileIds,
    cohortData?.profile_mapping,
  ]);

  // Clean up staged selections for departments that are no longer valid
  useEffect(() => {
    const validDeptIds = new Set(cohortData?.valid_department_ids || []);
    setStagedSelections((prev) => {
      const cleaned: Record<string, StagedSelections> = {};
      Object.keys(prev).forEach((deptId) => {
        const staged = prev[deptId];
        if (validDeptIds.has(deptId) && staged) {
          cleaned[deptId] = staged;
        }
      });
      return cleaned;
    });
  }, [cohortData?.valid_department_ids]);

  // Clear selections when they become invalid after department changes
  // (but preserve cross-department entities and staged selections)
  useEffect(() => {
    // Clear simulations that are no longer valid
    if (currentSimulationIds.length > 0) {
      const validSet = new Set(validSimulationIds);
      const filtered = currentSimulationIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentSimulationIds.length) {
        setCurrentSimulationIds(filtered);
      }
    }
  }, [currentSimulationIds, validSimulationIds]);

  // Profile validation is handled via StaffDataTable and API calls

  // Handle simulation selection from picker (V2 uses IDs directly)
  const handleSimulationSelection = useCallback((simulationIds: string[]) => {
    setCurrentSimulationIds(simulationIds);
  }, []);

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
      // Initialize previousDepartmentIds when loading cohort data
      setPreviousDepartmentIds((prev) => (prev.length === 0 ? deptIds : prev));

      // Load simulation IDs
      setCurrentSimulationIds((prev) => {
        const newIds = cohortData.simulation_ids;
        const hasChanged =
          JSON.stringify(prev.sort()) !== JSON.stringify(newIds.sort());
        return hasChanged ? newIds : prev;
      });

      // Initialize simulation active states from server data
      if (cohortData.simulations) {
        const activeStates: Record<string, boolean> = {};
        cohortData.simulations.forEach((sim) => {
          activeStates[sim.simulation_id] = sim.active;
        });
        setSimulationActiveStates(activeStates);
        setOriginalSimulationActiveStates(activeStates);
      }

      // Staff profiles are now loaded via cohortData.staff and managed by StaffDataTable
    }
  }, [cohortData, isEditMode]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    // Get original simulation IDs from cohortData
    const originalSimulationIds = cohortData?.simulation_ids || [];
    // Profile changes are handled via StaffDataTable API calls, not form submission

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

  // Simulation management handlers
  const removeSimulation = (simulationId: string) => {
    setCurrentSimulationIds((prev) => prev.filter((id) => id !== simulationId));
  };

  const handleDragStartSimulation = (
    e: React.DragEvent,
    simulationId: string
  ) => {
    setDraggedSimulation(simulationId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetSimulationId: string) => {
    e.preventDefault();

    if (!draggedSimulation) return;

    const newOrder = [...currentSimulationIds];
    const draggedIndex = newOrder.findIndex((id) => id === draggedSimulation);
    const targetIndex = newOrder.findIndex((id) => id === targetSimulationId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      const insertIndex =
        draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
      newOrder.splice(insertIndex, 0, removed!);

      setCurrentSimulationIds(newOrder);
    }

    setDraggedSimulation(null);
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = "Title is required";
    }

    // For instructional users, ensure they are always in the cohort
    if (effectiveProfile?.role === "instructional" && !isEditMode) {
      const isUserInCohort =
        cohortData?.staff?.some(
          (profile) => profile.profile_id === effectiveProfile.id
        ) || false;
      if (!isUserInCohort) {
        newErrors.title = "You must be included in the cohort to create it";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetFormAndState = () => {
    setFormData(initialFormData);
    setOriginalFormData(initialFormData);
    setEditingCohortId(null);
    setErrors({});
    setSelectedStaffIds([]);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare profile IDs from current cohort staff + staged profiles to add
      const existingProfileIds =
        cohortId && cohortData?.staff
          ? cohortData.staff.map((s) => s.profile_id)
          : [];
      const stagedProfileIds = stagedProfilesToAdd.map((p) => p.profileId);
      const profileIds = [...existingProfileIds, ...stagedProfileIds];

      const targetCohortId = cohortId || editingCohortId;
      if (targetCohortId) {
        // UPDATE mode - V2 API handles junction tables with active states
        await updateCohortMutation.mutateAsync({
          cohortId: targetCohortId,
          title: formData.title || "",
          description: formData.description || "",
          department_ids: formData.departmentIds || null,
          active: formData.active ?? true,
          simulation_ids: currentSimulationIds.map((simId) => ({
            simulation_id: simId,
            active: simulationActiveStates[simId] ?? true,
          })),
          profile_ids: profileIds,
        });

        toast.success("Cohort updated successfully!");
        // Clear staged profiles after successful update
        setStagedProfilesToAdd([]);
      } else {
        // CREATE mode - V2 API handles junction tables with active states
        await createCohortMutation.mutateAsync({
          title: formData.title || "",
          description: formData.description || "",
          department_ids: formData.departmentIds || null,
          active: formData.active || true,
          simulation_ids: currentSimulationIds.map((simId) => ({
            simulation_id: simId,
            active: simulationActiveStates[simId] ?? true,
          })),
          profile_ids: profileIds,
        });

        toast.success("Cohort created successfully!");
        // Clear staged profiles after successful create
        setStagedProfilesToAdd([]);
      }

      resetFormAndState();
      router.push(`/cohorts`);
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

  const editSimulation = (simulationId: string) => {
    window.open(`/create/simulations/s/${simulationId}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {isReadonly && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
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
              <h3 className="text-sm font-medium text-yellow-800">
                {cohortData?.department_ids?.length === 0 &&
                effectiveProfile?.role !== "superadmin"
                  ? "Default cohort cannot be edited"
                  : "You don't have permission to edit this cohort"}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  {cohortData?.department_ids?.length === 0 &&
                  effectiveProfile?.role !== "superadmin" ? (
                    <>
                      This is a default cohort template restricted to
                      superadmins. You can view details but cannot make changes.
                    </>
                  ) : (
                    <>
                      You can view the details but cannot make changes due to
                      your current permissions.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Basic Cohort Information */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          {formData.title !== undefined && !isLoading ? (
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter cohort title"
              className={errors.title ? "border-destructive" : ""}
              disabled={isReadonly}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined && !isLoading ? (
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter cohort description (optional)"
              rows={3}
              disabled={isReadonly}
            />
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </div>

        {/* Department Selection */}
        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          {formData?.departmentIds !== undefined && !isLoading ? (
            <DepartmentPicker
              mapping={cohortData?.department_mapping || {}}
              validIds={cohortData?.valid_department_ids || []}
              selectedIds={formData.departmentIds || []}
              onSelect={(ids) => handleInputChange("departmentIds", ids)}
              placeholder="All Departments"
              disabled={isReadonly}
              multiSelect={true}
            />
          ) : (
            <Skeleton className="h-10 w-full" />
          )}
        </div>

        {/* Switches - Horizontal Layout */}
        <div className="flex gap-8">
          {/* Active/Inactive Switch */}
          <div className="flex items-center gap-2">
            <Label htmlFor="active" className="text-sm">
              Cohort Active
            </Label>
            {formData.active !== undefined && !isLoading ? (
              <Switch
                id="active"
                checked={formData.active ?? true}
                onCheckedChange={(checked) =>
                  handleInputChange("active", checked)
                }
                disabled={isReadonly}
              />
            ) : (
              <Skeleton className="h-6 w-11" />
            )}
          </div>
        </div>

        {/* Simulations */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="simulations">Simulations</Label>
            </div>
            {!isReadonly && (
              <div className="flex gap-2">
                {!isLoading ? (
                  <SimulationPicker
                    simulationMapping={cohortData?.simulation_mapping || {}}
                    validSimulationIds={validSimulationIds}
                    selectedSimulationIds={currentSimulationIds}
                    onSelect={handleSimulationSelection}
                    placeholder="Add simulation"
                    showLabel={false}
                    buttonClassName="w-48"
                  />
                ) : (
                  <Skeleton className="h-10 w-48" />
                )}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-3 min-h-[180px]">
                  <div className="space-y-3 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-1/2" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded" />
                          <Skeleton className="h-6 w-6 rounded" />
                          <Skeleton className="h-4 w-4 rounded" />
                        </div>
                      </div>
                      <div className="space-y-2 mt-2">
                        <Skeleton className="h-3 w-full" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-20 rounded" />
                          <Skeleton className="h-5 w-20 rounded" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : currentSimulationIds.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
              <div>
                <p className="font-medium mb-1">No simulations selected</p>
                <p className="text-sm">
                  Use the dropdown above to add simulations to this cohort
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentSimulationIds.map((simulationId) => {
                const simulation = cohortData?.simulation_mapping[simulationId];
                if (!simulation) return null;

                // Get simulation data from simulations array (with statistics)
                const simulationData = cohortData?.simulations?.find(
                  (s) => s.simulation_id === simulationId
                );

                // Determine if this is an existing simulation (in original server data)
                const isExistingSimulation =
                  cohortData?.simulation_ids.includes(simulationId) ?? false;

                // Determine if Remove button should show
                const shouldShowRemove = isExistingSimulation
                  ? (simulationData?.can_remove ?? false)
                  : true; // New simulations always show remove

                // Get active state for styling
                const isSimulationActive =
                  simulationActiveStates[simulationId] ?? true;

                // Helper function to format last used date
                const formatLastUsed = (date: string | null): string => {
                  if (!date) return "Never";
                  const d = new Date(date);
                  return d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                };

                return (
                  <Card
                    key={simulationId}
                    className={`p-4 cursor-move hover:shadow-md transition-all flex flex-col h-full ${
                      draggedSimulation === simulationId ? "opacity-50" : ""
                    } ${!isSimulationActive ? "opacity-50 bg-muted" : ""}`}
                    draggable={!isReadonly}
                    onDragStart={(e) =>
                      !isReadonly && handleDragStartSimulation(e, simulationId)
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => !isReadonly && handleDrop(e, simulationId)}
                  >
                    {/* Header: Title, Description, and Active Switch */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm line-clamp-1">
                          {simulation.name || "Unnamed Simulation"}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-4 mt-2">
                          {simulation.description || "No description provided"}
                        </p>
                      </div>
                      {isExistingSimulation && !isReadonly && (
                        <Switch
                          checked={simulationActiveStates[simulationId] ?? true}
                          onCheckedChange={(checked) =>
                            setSimulationActiveStates((prev) => ({
                              ...prev,
                              [simulationId]: checked,
                            }))
                          }
                        />
                      )}
                    </div>

                    {/* Content area with flex-grow */}
                    <div className="flex-grow flex flex-col">
                      {/* Bottom section - Statistics and Actions */}
                      <div className="space-y-2 mt-auto">
                        {/* Statistics Row - Only for existing simulations */}
                        {isExistingSimulation && simulationData && (
                          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
                            <div className="flex items-center gap-1">
                              <BarChart3 className="h-3 w-3" />
                              <span>Usage: {simulationData.usage_count}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>
                                Last: {formatLastUsed(simulationData.last_used)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>
                                Success: {simulationData.success_rate}%
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between border-t pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => editSimulation(simulationId)}
                          >
                            View Details
                          </Button>

                          {!isReadonly && shouldShowRemove && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeSimulation(simulationId)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Staff Management */}
        {cohortId &&
          cohortData &&
          (() => {
            // Merge existing staff with staged profiles
            const existingStaff = cohortData.staff || [];
            const existingStaffIds = new Set(
              existingStaff.map((s) => s.profile_id)
            );

            // Get staged profiles with minimal details (we'll show them immediately)
            const stagedWithDetails: (ProfileListItem & {
              isStaged?: boolean;
            })[] = stagedProfilesToAdd
              .map((staged) => {
                // Create minimal ProfileListItem from staged data
                const firstName = staged.firstName || "";
                const lastName = staged.lastName || "";
                const alias = staged.alias || "";
                return {
                  profile_id: staged.profileId,
                  first_name: firstName,
                  last_name: lastName,
                  alias: alias,
                  name: `${firstName} ${lastName}`.trim() || alias,
                  role: staged.role || "ta",
                  email: alias
                    ? `${alias}@${process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}`
                    : "",
                  initials:
                    `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() ||
                    "??",
                  active: true,
                  last_active: null,
                  cohort_ids: cohortId ? [cohortId] : [],
                  department_ids:
                    formData.departmentIds && formData.departmentIds.length > 0
                      ? formData.departmentIds
                      : [],
                  requests_per_day: staged.requestsPerDay ?? null,
                  total_requests: staged.totalRequests ?? 0,
                  default_profile: false,
                  requests_in_last_day: 0,
                  can_edit: false,
                  can_delete: false,
                  isStaged: true,
                };
              })
              .filter((p) => !existingStaffIds.has(p.profile_id));

            // Combine existing staff with staged profiles
            const mergedStaff = [...existingStaff, ...stagedWithDetails];

            return (
              <div className="space-y-4">
                <StaffDataTable
                  data={mergedStaff}
                  cohortMapping={cohortData.cohort_mapping || {}}
                  departmentMapping={
                    cohortData.department_mapping_for_staff || {}
                  }
                  roleOptions={[
                    { value: "superadmin", label: "Super Administrator" },
                    { value: "admin", label: "Administrator" },
                    { value: "instructional", label: "Instructional Staff" },
                    { value: "ta", label: "Teaching Assistant" },
                    { value: "guest", label: "Guest" },
                  ]}
                  cohortOptions={Object.entries(
                    cohortData.cohort_mapping || {}
                  ).map(([id, item]) => ({
                    value: id,
                    label: item.name,
                  }))}
                  activityOptions={[
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                  lastActiveOptions={[
                    { value: "recent", label: "Recently Active (< 7 days)" },
                    {
                      value: "moderate",
                      label: "Moderately Active (7-30 days)",
                    },
                    { value: "old", label: "Inactive (> 30 days)" },
                    { value: "never", label: "Never Active" },
                  ]}
                  isRefreshing={isRefreshing}
                  onRefresh={async () => {
                    setIsRefreshing(true);
                    await refetchCohortDetail();
                    setIsRefreshing(false);
                  }}
                  cohortId={cohortId}
                  {...(cohortId && { cohortIds: [cohortId] })}
                  {...(formData.departmentIds &&
                    formData.departmentIds.length > 0 && {
                      departmentIds: formData.departmentIds,
                    })}
                  selectedStaffIds={selectedStaffIds}
                  onStaffSelect={(id, checked) =>
                    setSelectedStaffIds((prev) =>
                      checked ? [...prev, id] : prev.filter((x) => x !== id)
                    )
                  }
                  onSelectAll={(checked, visibleRowIds) => {
                    if (checked && visibleRowIds) {
                      setSelectedStaffIds((prev) => {
                        const newSelection = [...prev];
                        visibleRowIds.forEach((id) => {
                          if (!newSelection.includes(id)) {
                            newSelection.push(id);
                          }
                        });
                        return newSelection;
                      });
                    } else {
                      setSelectedStaffIds((prev) =>
                        prev.filter((id) => !visibleRowIds?.includes(id))
                      );
                    }
                  }}
                  onCreate={async (
                    stagedProfiles?: Array<{
                      profileId: string;
                      firstName?: string;
                      lastName?: string;
                      alias?: string;
                      role?: string;
                      requestsPerDay?: number | null;
                      totalRequests?: number;
                    }>
                  ) => {
                    // Add staged profiles to staging list
                    if (stagedProfiles && stagedProfiles.length > 0) {
                      setStagedProfilesToAdd((prev) => {
                        // Avoid duplicates by checking profileId
                        const existingIds = new Set(
                          prev.map((p) => p.profileId)
                        );
                        const newProfiles = stagedProfiles.filter(
                          (p) => !existingIds.has(p.profileId)
                        );
                        return [...prev, ...newProfiles];
                      });
                    }
                    // Refetch to show any changes
                    setIsRefreshing(true);
                    await refetchCohortDetail();
                    setIsRefreshing(false);
                  }}
                  onPreview={(staff) => {
                    window.open(
                      `/analytics/reports/p/${staff.profile_id}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  onEdit={() => {
                    // Edit handled via modal if needed
                  }}
                  onDelete={() => {
                    // Delete not available in scoped view
                  }}
                  onRemoveFromCohort={async (staff) => {
                    // Check if this is a staged profile
                    const isStaged = (
                      staff as ProfileListItem & { isStaged?: boolean }
                    ).isStaged;

                    if (isStaged) {
                      // Remove from staging list
                      setStagedProfilesToAdd((prev) =>
                        prev.filter((p) => p.profileId !== staff.profile_id)
                      );
                      toast.success("Removed staged profile");
                    } else {
                      // Remove from cohort (existing profile)
                      try {
                        await removeProfilesFromCohortMutation.mutateAsync({
                          cohortId: cohortId,
                          profileIds: [staff.profile_id],
                        });
                        toast.success("Removed profile from cohort");
                        setIsRefreshing(true);
                        await refetchCohortDetail();
                        setIsRefreshing(false);
                      } catch (error) {
                        toast.error(
                          `Failed to remove profile: ${error instanceof Error ? error.message : "Unknown error"}`
                        );
                      }
                    }
                  }}
                  onBulkEdit={() => {
                    // Bulk edit can be implemented if needed
                  }}
                  onBulkDelete={async () => {
                    if (selectedStaffIds.length === 0) return;
                    try {
                      await removeProfilesFromCohortMutation.mutateAsync({
                        cohortId: cohortId,
                        profileIds: selectedStaffIds,
                      });
                      toast.success(
                        `Removed ${selectedStaffIds.length} profile(s) from cohort`
                      );
                      setSelectedStaffIds([]);
                      setIsRefreshing(true);
                      await refetchCohortDetail();
                      setIsRefreshing(false);
                    } catch (error) {
                      toast.error(
                        `Failed to remove profiles: ${error instanceof Error ? error.message : "Unknown error"}`
                      );
                    }
                  }}
                  canDelete={() => true} // All profiles can be removed from cohort
                  deletableCount={selectedStaffIds.length}
                  canEdit={() => false} // Edit not available in scoped view
                  editableCount={0}
                />
              </div>
            );
          })()}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          {!isLoading ? (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={() => router.push("/cohorts")}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting || isReadonly || (isEditMode && !hasChanges)
                }
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {cohortId || editingCohortId
                      ? "Updating..."
                      : "Creating..."}
                  </>
                ) : cohortId || editingCohortId ? (
                  "Update Cohort"
                ) : (
                  "Create Cohort"
                )}
              </Button>
            </>
          ) : (
            <>
              <Skeleton className="h-10 w-16" />
              <Skeleton className="h-10 w-32" />
            </>
          )}
        </div>
      </form>

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              This cohort is currently used by{" "}
              {currentSimulationIds.length || 0} simulation
              {(currentSimulationIds.length || 0) !== 1 ? "s" : ""}:
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
                The cohort has {cohortData?.staff?.length || 0} member
                {(cohortData?.staff?.length || 0) !== 1 ? "s" : ""} assigned.
                Updating this cohort will affect all simulations that use it.
                Are you sure you want to proceed?
              </div>
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
