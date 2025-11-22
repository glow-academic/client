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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// Import types from new page (create action)
import type {
  CohortDetailDefaultOut,
  CreateCohortIn,
  CreateCohortOut,
} from "@/app/(main)/cohorts/new/page";
// Import types from edit page (update action)
import type {
  CohortDetailOut,
  UpdateCohortIn,
  UpdateCohortOut,
} from "@/app/(main)/cohorts/e/[cohortId]/page";
import type {
  CreateStaffDataOut,
  ProfileListItem,
  SearchStaffOut,
} from "@/app/(main)/system/staff/page";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { SimulationPicker } from "@/components/common/forms/SimulationPicker";
import StaffBulkEditModal from "@/components/common/staff/StaffBulkEditModal";
import { StaffDataTable } from "@/components/common/staff/StaffDataTable";
import StaffEditModal from "@/components/common/staff/StaffEditModal";
import type {
  BulkCreateOrUpdateStaffAction,
  BulkUpdateStaffAction,
  ProcessCSVAction,
  SearchStaffAction,
  UpdateStaffAction,
} from "@/components/staff/Staff";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";

// Import staff item types from API responses
import type { CohortStaffItem } from "@/app/(main)/cohorts/e/[cohortId]/page";
import type { CohortDefaultStaffItem } from "@/app/(main)/cohorts/new/page";
import { BarChart3, CheckCircle2, Clock, Loader2, Power } from "lucide-react";
import { useRouter } from "next/navigation";

// Helper to normalize cohort staff item to ProfileListItem format
// Note: ProfileListItem doesn't have can_remove, so we extend it
type ProfileListItemWithRemove = ProfileListItem & { can_remove?: boolean };

const normalizeCohortStaffItem = (
  item: CohortStaffItem | CohortDefaultStaffItem
): ProfileListItemWithRemove => {
  const department_ids = item.department_ids ?? [];
  // Prefer primary_department_id from API if available, otherwise fall back to department_id or first department
  const primary_department_id = item.primary_department_id;

  return {
    profile_id: item.profile_id,
    first_name: item.first_name,
    last_name: item.last_name,
    email: item.email,
    name: item.name,
    role: item.role,
    email: item.email,
    initials: item.initials,
    active: item.active,
    last_active: item.lastActive ?? null,
    cohort_ids: item.cohort_ids ?? [],
    department_ids: department_ids,
    primary_department_id: primary_department_id,
    requests_per_day: item.requests_per_day ?? null,
    total_requests: item.total_requests ?? 0,
    default_profile: item.default_profile,
    intro_completed: item.intro_completed ?? false,
    chat_completed: item.chat_completed ?? false,
    requests_in_last_day: item.requests_in_last_day ?? 0,
    can_edit: item.can_edit,
    can_delete: item.can_delete,
    can_remove: "can_remove" in item ? item.can_remove : false,
  };
};

export interface CohortProps {
  cohortId?: string;
  // Server-provided data (for server-side rendering)
  cohortDetail?: CohortDetailOut;
  cohortDetailDefault?: CohortDetailDefaultOut;
  // Server actions (replaces useMutation)
  createCohortAction?: (input: CreateCohortIn) => Promise<CreateCohortOut>;
  updateCohortAction?: (input: UpdateCohortIn) => Promise<UpdateCohortOut>;
  // Staff actions for StaffDataTable
  processCSVAction?: ProcessCSVAction;
  bulkCreateOrUpdateStaffAction?: BulkCreateOrUpdateStaffAction;
  searchStaffAction?: SearchStaffAction;
  initialSearchData?: SearchStaffOut;
  initialCreateStaffData?: CreateStaffDataOut;
  // Staff edit actions
  updateStaffAction?: UpdateStaffAction;
  bulkUpdateStaffAction?: BulkUpdateStaffAction;
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
export default function Cohort({
  cohortId,
  cohortDetail: serverCohortDetail,
  cohortDetailDefault: serverCohortDetailDefault,
  createCohortAction,
  updateCohortAction,
  processCSVAction,
  bulkCreateOrUpdateStaffAction,
  searchStaffAction,
  initialSearchData,
  initialCreateStaffData,
  updateStaffAction,
  bulkUpdateStaffAction,
}: CohortProps) {
  const router = useRouter();
  const { effectiveProfile, scopedRoles } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [draggedSimulation, setDraggedSimulation] = useState<string | null>(
    null
  );
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const isEditMode = !!cohortId;

  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId ?? null,
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId],
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

  // Staff management state (for StaffDataTable)
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Modal state management
  const [editProfileId, setEditProfileId] = useState<string | null>(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showBulkRemoveDialog, setShowBulkRemoveDialog] = useState(false);
  // Staged profiles to be added when cohort is updated
  // Store minimal profile data for immediate display
  interface StagedProfile {
    profileId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    requestsPerDay?: number | null;
    totalRequests?: number;
  }
  const [stagedProfilesToAdd, setStagedProfilesToAdd] = useState<
    StagedProfile[]
  >([]);
  // Staged profiles to be removed when cohort is updated
  const [stagedProfilesToRemove, setStagedProfilesToRemove] = useState<
    string[]
  >([]);

  // Simulation active state management (staged changes)
  const [simulationActiveStates, setSimulationActiveStates] = useState<
    Record<string, boolean>
  >({});
  const [originalSimulationActiveStates, setOriginalSimulationActiveStates] =
    useState<Record<string, boolean>>({});

  // Memoize callback functions to prevent unnecessary re-renders

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

  // Role options from scopedRoles
  const roleOptions = useMemo(() => {
    const roleLabels: Record<string, string> = {
      superadmin: "Super Administrator",
      admin: "Administrator",
      instructional: "Instructional Staff",
      ta: "Teaching Assistant",
      guest: "Guest",
    };
    return (scopedRoles || []).map((role) => ({
      value: role,
      label: roleLabels[role] || role,
    }));
  }, [scopedRoles]);

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
        JSON.stringify(originalSimulationActiveStates) ||
      stagedProfilesToAdd.length > 0 || // Check for staged profiles to add
      stagedProfilesToRemove.length > 0 // Check for staged profiles to remove
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    currentSimulationIds,
    cohortData?.simulation_ids,
    simulationActiveStates,
    originalSimulationActiveStates,
    stagedProfilesToAdd.length,
    stagedProfilesToRemove.length,
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
      // Exclude staged profiles to remove
      const existingProfileIds =
        cohortId && cohortData?.staff
          ? cohortData.staff
              .map((s) => s.profile_id)
              .filter((id) => !stagedProfilesToRemove.includes(id))
          : [];
      const stagedProfileIds = stagedProfilesToAdd.map((p) => p.profileId);
      const profileIds = [...existingProfileIds, ...stagedProfileIds];

      const validDepartmentIds = cohortData?.valid_department_ids || [];
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        validDepartmentIds,
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
          simulation_ids: currentSimulationIds,
          profile_ids: profileIds,
        };
        await handleUpdateCohort(updateRequest);

        toast.success("Cohort updated successfully!");
        // Clear staged profiles after successful update
        setStagedProfilesToAdd([]);
        setStagedProfilesToRemove([]);
      } else {
        // CREATE mode
        const createRequest: CreateCohortBody = {
          title: formData.title || "",
          description: formData.description || null,
          department_ids: finalDepartmentIds || [],
          active: formData.active || true,
          simulation_ids: currentSimulationIds,
          profile_ids: profileIds,
        };
        await handleCreateCohort(createRequest);

        toast.success("Cohort created successfully!");
        // Clear staged profiles after successful create
        setStagedProfilesToAdd([]);
        setStagedProfilesToRemove([]);
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
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
                Cohort is read-only
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
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
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Basic Cohort Information */}
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          {formData.title !== undefined ? (
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="Enter cohort title"
              className={errors.title ? "border-destructive" : ""}
              disabled={isReadonly}
              data-testid="input-cohort-title"
            />
          ) : null}
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          {formData.description !== undefined ? (
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter cohort description (optional)"
              rows={3}
              disabled={isReadonly}
              data-testid="input-cohort-description"
            />
          ) : null}
        </div>

        {/* Department Selection */}
        {cohortData?.valid_department_ids &&
          cohortData.valid_department_ids.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              {formData?.departmentIds !== undefined ? (
                <DepartmentPicker
                  mapping={cohortData?.department_mapping || {}}
                  validIds={cohortData?.valid_department_ids || []}
                  selectedIds={formData.departmentIds || []}
                  onSelect={(ids) => handleInputChange("departmentIds", ids)}
                  placeholder="All Departments"
                  disabled={isReadonly}
                  multiSelect={true}
                  triggerProps={{ "data-testid": "picker-department" }}
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

        {/* Simulations */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="simulations">Simulations</Label>
            </div>
            <div className="flex gap-2">
              <SimulationPicker
                simulationMapping={cohortData?.simulation_mapping || {}}
                validSimulationIds={validSimulationIds}
                selectedSimulationIds={currentSimulationIds}
                onSelect={handleSimulationSelection}
                placeholder="Add simulation"
                showLabel={false}
                buttonClassName="w-48"
                disabled={isReadonly}
              />
            </div>
          </div>

          {currentSimulationIds.length === 0 ? (
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
                    data-testid="simulation-card"
                    data-simulation-id={simulationId}
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
                            data-testid="btn-view-simulation-details"
                          >
                            View Details
                          </Button>

                          {!isReadonly && shouldShowRemove && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeSimulation(simulationId)}
                              data-testid="btn-remove-simulation"
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
                const email = staged.email || "";
                return {
                  profile_id: staged.profileId,
                  first_name: firstName,
                  last_name: lastName,
                  email: email,
                  name: `${firstName} ${lastName}`.trim() || email,
                  role: staged.role || "ta",
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
                  primary_department_id: (formData.departmentIds &&
                  formData.departmentIds.length > 0
                    ? formData.departmentIds[0]
                    : "") as string,
                  requests_per_day: staged.requestsPerDay ?? null,
                  total_requests: staged.totalRequests ?? 0,
                  default_profile: false,
                  intro_completed: false,
                  chat_completed: false,
                  requests_in_last_day: 0,
                  can_edit: false,
                  can_delete: false,
                  can_remove: true, // Staged profiles can always be removed
                  isStaged: true,
                };
              })
              .filter((p) => !existingStaffIds.has(p.profile_id));

            // Filter out staged removals from display
            const stagedRemovalsSet = new Set(stagedProfilesToRemove);
            const filteredExistingStaff = existingStaff.filter(
              (s) => !stagedRemovalsSet.has(s.profile_id)
            );

            // Normalize API staff items to ProfileListItem format
            const normalizedExistingStaff = filteredExistingStaff.map(
              normalizeCohortStaffItem
            );

            // Combine existing staff with staged profiles (staged profiles first)
            const mergedStaff: (ProfileListItemWithRemove & {
              isStaged?: boolean;
            })[] = [...stagedWithDetails, ...normalizedExistingStaff];

            return (
              <div className="space-y-4">
                <StaffDataTable
                  data={mergedStaff}
                  cohortMapping={cohortData.cohort_mapping || {}}
                  departmentMapping={
                    cohortData.department_mapping_for_staff || {}
                  }
                  roleOptions={roleOptions}
                  cohortOptions={Object.entries(
                    cohortData.cohort_mapping || {}
                  ).map(([id, item]) => ({
                    value: id,
                    label: item.name,
                  }))}
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
                    // No need to refetch here, as we are using server data
                    setIsRefreshing(false);
                  }}
                  cohortId={cohortId}
                  {...(cohortId && { cohortIds: [cohortId] })}
                  selectedStaffIds={selectedStaffIds}
                  readonly={isReadonly}
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
                      email?: string;
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
                    // No need to refetch here, as we are using server data
                    setIsRefreshing(true);
                    setIsRefreshing(false);
                  }}
                  onPreview={(staff) => {
                    window.open(
                      `/analytics/reports/p/${staff.profile_id}`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  onEdit={(staff) => {
                    setEditProfileId(staff.profile_id);
                  }}
                  onDelete={() => {
                    // Delete not available in scoped view
                  }}
                  onRemoveFromCohort={(staff) => {
                    // Check if this is a staged profile
                    const isStaged = (
                      staff as ProfileListItemWithRemove & {
                        isStaged?: boolean;
                      }
                    ).isStaged;

                    if (isStaged) {
                      // Remove from staging list immediately (no confirmation needed)
                      setStagedProfilesToAdd((prev) =>
                        prev.filter((p) => p.profileId !== staff.profile_id)
                      );
                      toast.success("Removed staged profile");
                    } else {
                      // Use server-side can_remove flag
                      if (!(staff as ProfileListItemWithRemove).can_remove) {
                        toast.error(
                          "You cannot remove this staff member from the cohort."
                        );
                        return;
                      }
                      // Stage removal immediately (no confirmation needed)
                      setStagedProfilesToRemove((prev) => {
                        if (!prev.includes(staff.profile_id)) {
                          return [...prev, staff.profile_id];
                        }
                        return prev;
                      });
                      toast.success(
                        "Staff member staged for removal. Changes will be applied when you save."
                      );
                    }
                  }}
                  onBulkEdit={() => setShowBulkEditModal(true)}
                  onBulkDelete={() => {
                    // Filter selected staff that can be removed (use server-side can_remove)
                    const removableIds = selectedStaffIds.filter((id) => {
                      const staff = mergedStaff.find(
                        (s) => s.profile_id === id
                      );
                      if (!staff) return false;
                      const isStaged = (
                        staff as ProfileListItemWithRemove & {
                          isStaged?: boolean;
                        }
                      ).isStaged;
                      if (isStaged) return true; // Staged profiles can always be removed
                      return staff.can_remove ?? false;
                    });

                    if (removableIds.length === 0) {
                      toast.error(
                        "None of the selected staff members can be removed from the cohort."
                      );
                      return;
                    }

                    setShowBulkRemoveDialog(true);
                  }}
                  canDelete={(profileId) => {
                    const staff = mergedStaff.find(
                      (s) => s.profile_id === profileId
                    );
                    if (!staff) return false;
                    const isStaged = (
                      staff as ProfileListItem & { isStaged?: boolean }
                    ).isStaged;
                    if (isStaged) return true; // Staged profiles can always be removed
                    return staff.can_remove ?? false;
                  }}
                  canRemove={(profileId) => {
                    const staff = mergedStaff.find(
                      (s) => s.profile_id === profileId
                    );
                    if (!staff) return false;
                    const isStaged = (
                      staff as ProfileListItemWithRemove & {
                        isStaged?: boolean;
                      }
                    ).isStaged;
                    if (isStaged) return true; // Staged profiles can always be removed
                    return staff.can_remove ?? false;
                  }}
                  deletableCount={
                    selectedStaffIds.filter((id) => {
                      const staff = mergedStaff.find(
                        (s) => s.profile_id === id
                      );
                      if (!staff) return false;
                      const isStaged = (
                        staff as ProfileListItemWithRemove & {
                          isStaged?: boolean;
                        }
                      ).isStaged;
                      if (isStaged) return true;
                      return staff.can_remove ?? false;
                    }).length
                  }
                  {...(searchStaffAction && { searchStaffAction })}
                  {...(processCSVAction && { processCSVAction })}
                  {...(bulkCreateOrUpdateStaffAction && {
                    bulkCreateOrUpdateStaffAction,
                  })}
                  {...(initialCreateStaffData && { initialCreateStaffData })}
                  {...(initialSearchData && { initialSearchData })}
                  canEdit={(profileId) => {
                    const staff = mergedStaff.find(
                      (s) => s.profile_id === profileId
                    );
                    return staff?.can_edit ?? false;
                  }}
                  editableCount={
                    selectedStaffIds.filter((id) => {
                      const staff = mergedStaff.find(
                        (s) => s.profile_id === id
                      );
                      return staff?.can_edit ?? false;
                    }).length
                  }
                />
              </div>
            );
          })()}

        {/* Edit Staff Modal */}
        {cohortId &&
          updateStaffAction &&
          cohortData &&
          (() => {
            // Find the staff item from merged staff (existing + staged)
            const existingStaff = cohortData.staff || [];
            const existingStaffIds = new Set(
              existingStaff.map((s) => s.profile_id)
            );
            const stagedWithDetails: (ProfileListItem & {
              isStaged?: boolean;
            })[] = stagedProfilesToAdd
              .map((staged) => {
                const firstName = staged.firstName || "";
                const lastName = staged.lastName || "";
                const email = staged.email || "";
                return {
                  profile_id: staged.profileId,
                  first_name: firstName,
                  last_name: lastName,
                  email: email,
                  name: `${firstName} ${lastName}`.trim() || email,
                  role: staged.role || "ta",
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
                  primary_department_id:
                    formData.departmentIds && formData.departmentIds.length > 0
                      ? (formData.departmentIds[0] ?? "")
                      : "",
                  requests_per_day: staged.requestsPerDay ?? null,
                  total_requests: staged.totalRequests ?? 0,
                  default_profile: false,
                  intro_completed: false,
                  chat_completed: false,
                  requests_in_last_day: 0,
                  can_edit: false,
                  can_delete: false,
                  isStaged: true,
                };
              })
              .filter((p) => !existingStaffIds.has(p.profile_id));
            const stagedRemovalsSet = new Set(stagedProfilesToRemove);
            const filteredExistingStaff = existingStaff.filter(
              (s) => !stagedRemovalsSet.has(s.profile_id)
            );
            const normalizedExistingStaff = filteredExistingStaff.map(
              normalizeCohortStaffItem
            );
            const mergedStaff: (ProfileListItemWithRemove & {
              isStaged?: boolean;
            })[] = [...stagedWithDetails, ...normalizedExistingStaff];
            const staffItem =
              mergedStaff.find((s) => s.profile_id === editProfileId) || null;

            return (
              <StaffEditModal
                profileId={editProfileId}
                open={!!editProfileId}
                onOpenChange={(open: boolean) => {
                  if (!open) {
                    setEditProfileId(null);
                  }
                }}
                onDone={() => {
                  setEditProfileId(null);
                  router.refresh();
                }}
                updateStaffAction={updateStaffAction}
                staffItem={staffItem}
                validDepartmentIds={cohortData.valid_department_ids || []}
                departmentMapping={departmentMapping}
              />
            );
          })()}

        {/* Bulk Edit Modal */}
        {cohortId &&
          cohortData &&
          bulkUpdateStaffAction &&
          (() => {
            // Find selected staff items from merged staff (existing + staged)
            const existingStaff = cohortData.staff || [];
            const existingStaffIds = new Set(
              existingStaff.map((s) => s.profile_id)
            );
            const stagedWithDetails: (ProfileListItem & {
              isStaged?: boolean;
            })[] = stagedProfilesToAdd
              .map((staged) => {
                const firstName = staged.firstName || "";
                const lastName = staged.lastName || "";
                const email = staged.email || "";
                return {
                  profile_id: staged.profileId,
                  first_name: firstName,
                  last_name: lastName,
                  email: email,
                  name: `${firstName} ${lastName}`.trim() || email,
                  role: staged.role || "ta",
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
                  primary_department_id:
                    formData.departmentIds && formData.departmentIds.length > 0
                      ? (formData.departmentIds[0] ?? "")
                      : "",
                  requests_per_day: staged.requestsPerDay ?? null,
                  total_requests: staged.totalRequests ?? 0,
                  default_profile: false,
                  intro_completed: false,
                  chat_completed: false,
                  requests_in_last_day: 0,
                  can_edit: false,
                  can_delete: false,
                  isStaged: true,
                };
              })
              .filter((p) => !existingStaffIds.has(p.profile_id));
            const stagedRemovalsSet = new Set(stagedProfilesToRemove);
            const filteredExistingStaff = existingStaff.filter(
              (s) => !stagedRemovalsSet.has(s.profile_id)
            );
            const normalizedExistingStaff = filteredExistingStaff.map(
              normalizeCohortStaffItem
            );
            const mergedStaff: (ProfileListItemWithRemove & {
              isStaged?: boolean;
            })[] = [...stagedWithDetails, ...normalizedExistingStaff];
            const selectedStaffItems = mergedStaff.filter((s) =>
              selectedStaffIds.includes(s.profile_id)
            );

            return (
              <StaffBulkEditModal
                profileIds={selectedStaffIds}
                open={showBulkEditModal}
                onOpenChange={setShowBulkEditModal}
                onDone={() => {
                  setSelectedStaffIds([]);
                  setShowBulkEditModal(false);
                }}
                bulkUpdateStaffAction={bulkUpdateStaffAction}
                selectedStaffItems={selectedStaffItems}
                validDepartmentIds={cohortData.valid_department_ids || []}
                departmentMapping={
                  cohortData.department_mapping_for_staff || {}
                }
              />
            );
          })()}

        {/* Bulk Remove from Cohort Confirmation */}
        {cohortId && (
          <AlertDialog
            open={showBulkRemoveDialog}
            onOpenChange={setShowBulkRemoveDialog}
          >
            <AlertDialogContent
              aria-labelledby="bulk-remove-staff-title"
              data-testid="dialog-bulk-remove-staff"
            >
              <AlertDialogHeader>
                <AlertDialogTitle id="bulk-remove-staff-title">
                  Remove {selectedStaffIds.length} staff member
                  {selectedStaffIds.length !== 1 ? "s" : ""}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove them from the cohort. Changes will be applied
                  when you save.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="btn-cancel-bulk-remove-staff">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  data-testid="btn-confirm-bulk-remove-staff"
                  onClick={() => {
                    if (selectedStaffIds.length === 0 || !cohortId) return;

                    // Recreate mergedStaff in this scope
                    const existingStaff = cohortData?.staff || [];
                    const existingStaffIds = new Set(
                      existingStaff.map((s) => s.profile_id)
                    );
                    const stagedWithDetails: (ProfileListItem & {
                      isStaged?: boolean;
                    })[] = stagedProfilesToAdd.map((staged) => {
                      // Create minimal ProfileListItem from staged data
                      const firstName = staged.firstName || "";
                      const lastName = staged.lastName || "";
                      const email = staged.email || "";
                      return {
                        profile_id: staged.profileId,
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        name: `${firstName} ${lastName}`.trim() || email,
                        role: staged.role || "ta",
                        initials:
                          `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() ||
                          "??",
                        active: true,
                        last_active: null,
                        cohort_ids: cohortId ? [cohortId] : [],
                        department_ids:
                          formData.departmentIds &&
                          formData.departmentIds.length > 0
                            ? formData.departmentIds
                            : [],
                        primary_department_id:
                          formData.departmentIds &&
                          formData.departmentIds.length > 0
                            ? (formData.departmentIds[0] ?? "")
                            : "",
                        requests_per_day: staged.requestsPerDay ?? null,
                        total_requests: staged.totalRequests ?? 0,
                        default_profile: false,
                        intro_completed: false,
                        chat_completed: false,
                        requests_in_last_day: 0,
                        can_edit: false,
                        can_delete: false,
                        can_remove: true, // Staged profiles can always be removed
                        isStaged: true,
                      };
                    });
                    const stagedRemovalsSet = new Set(stagedProfilesToRemove);
                    const filteredExistingStaff = existingStaff.filter(
                      (s) => !stagedRemovalsSet.has(s.profile_id)
                    );
                    // Normalize API staff items to ProfileListItem format
                    const normalizedExistingStaff = filteredExistingStaff.map(
                      normalizeCohortStaffItem
                    );
                    const mergedStaffForCheck: (ProfileListItemWithRemove & {
                      isStaged?: boolean;
                    })[] = [...stagedWithDetails, ...normalizedExistingStaff];

                    // Filter to only removable profiles (use server-side can_remove)
                    const removableIds = selectedStaffIds.filter((id) => {
                      const staff = mergedStaffForCheck.find(
                        (s) => s.profile_id === id
                      );
                      if (!staff) return false;
                      const isStaged = (
                        staff as ProfileListItemWithRemove & {
                          isStaged?: boolean;
                        }
                      ).isStaged;
                      if (isStaged) return true;
                      return staff.can_remove ?? false;
                    });

                    // Separate staged profiles from existing profiles
                    const stagedIds = removableIds.filter(
                      (id) => !existingStaffIds.has(id)
                    );
                    const existingIds = removableIds.filter((id) =>
                      existingStaffIds.has(id)
                    );

                    // Remove staged profiles from staging list
                    if (stagedIds.length > 0) {
                      setStagedProfilesToAdd((prev) =>
                        prev.filter((p) => !stagedIds.includes(p.profileId))
                      );
                    }

                    // Stage existing profiles for removal
                    if (existingIds.length > 0) {
                      setStagedProfilesToRemove((prev) => {
                        const newRemovals = existingIds.filter(
                          (id) => !prev.includes(id)
                        );
                        return [...prev, ...newRemovals];
                      });
                    }

                    toast.success(
                      `${removableIds.length} staff member(s) staged for removal. Changes will be applied when you save the cohort.`
                    );
                    setSelectedStaffIds([]);
                    setShowBulkRemoveDialog(false);
                  }}
                >
                  Stage Removal
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push("/cohorts")}
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
          </>
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
