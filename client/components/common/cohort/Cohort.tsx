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
import { useProfile } from "@/contexts/profile-context";
import {
  useCohortDetail,
  useCohortDetailDefault,
  useCreateCohort,
  useUpdateCohort,
} from "@/lib/api/v2/hooks/cohorts";
import { ProfileRole } from "@/lib/api/v2/schemas/base";
import { ProfileItem } from "@/lib/api/v2/schemas/profile";
import { GripVertical, Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { SimulationPicker } from "./SimulationPicker";
import CohortStaff from "./staff/CohortStaff";

export interface CohortProps {
  cohortId?: string;
}

interface FormErrors {
  title?: string;
}

// A new type to represent a profile that is either saved or new
type EditableProfile =
  | ProfileItem
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      firstName: string;
      lastName: string;
      alias: string;
      role: ProfileRole;
    };

interface FormData {
  title: string;
  description: string;
  active: boolean;
  defaultCohort: boolean;
  departmentId: string;
}
export default function Cohort({ cohortId }: CohortProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();

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
    defaultCohort: false,
    departmentId: "",
  };

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [originalFormData, setOriginalFormData] =
    useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Staff management state
  const [staffProfiles, setStaffProfiles] = useState<EditableProfile[]>([]);
  const [profilesToDelete, setProfilesToDelete] = useState<string[]>([]);

  // Memoize callback functions to prevent unnecessary re-renders
  const memoizedSetStaffProfiles = useCallback(
    (profiles: EditableProfile[]) => {
      setStaffProfiles(profiles);
    },
    []
  );

  const memoizedSetProfilesToDelete = useCallback((profileIds: string[]) => {
    setProfilesToDelete(profileIds);
  }, []);

  // V2 API hooks
  const { data: cohortDetail, isLoading: isLoadingCohortDetail } =
    useCohortDetail(
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
    const isDefaultCohort = cohortData.default_cohort;
    if (isDefaultCohort && effectiveProfile?.role !== "superadmin") {
      return true; // Only superadmins can edit default cohorts
    }
    return false; // Otherwise editable (permissions handled server-side)
  }, [isEditMode, cohortData, effectiveProfile?.role]);

  // Handle simulation selection from picker (V2 uses IDs directly)
  const handleSimulationSelection = useCallback((simulationIds: string[]) => {
    setCurrentSimulationIds(simulationIds);
  }, []);

  // Load cohort data from V2 API response
  useEffect(() => {
    if (cohortData && isEditMode) {
      const cohortFormData = {
        title: cohortData.title || "",
        description: cohortData.description || "",
        active: cohortData.active ?? true,
        defaultCohort: cohortData.default_cohort ?? false,
        departmentId: cohortData.department_id,
      };

      // Only update if the data has actually changed to prevent infinite loops
      setFormData((prev) => {
        const hasChanged =
          prev.title !== cohortFormData.title ||
          prev.description !== cohortFormData.description ||
          prev.active !== cohortFormData.active ||
          prev.defaultCohort !== cohortFormData.defaultCohort ||
          prev.departmentId !== cohortFormData.departmentId;

        return hasChanged ? cohortFormData : prev;
      });

      setOriginalFormData((prev) => {
        const hasChanged =
          prev.title !== cohortFormData.title ||
          prev.description !== cohortFormData.description ||
          prev.active !== cohortFormData.active ||
          prev.defaultCohort !== cohortFormData.defaultCohort ||
          prev.departmentId !== cohortFormData.departmentId;

        return hasChanged ? cohortFormData : prev;
      });

      // Load simulation IDs
      setCurrentSimulationIds((prev) => {
        const newIds = cohortData.simulation_ids;
        const hasChanged =
          JSON.stringify(prev.sort()) !== JSON.stringify(newIds.sort());
        return hasChanged ? newIds : prev;
      });

      // Load staff profiles from profile_ids
      // Build EditableProfile array from profile_mapping
      const cohortProfiles: EditableProfile[] = cohortData.profile_ids.map(
        (profileId) => {
          const profileInfo = cohortData.profile_mapping[profileId];
          return {
            id: profileId,
            firstName: profileInfo?.name || "",
            lastName: "",
            alias: profileInfo?.name || "",
            role: "student" as ProfileRole,
          } as ProfileItem;
        }
      );

      setStaffProfiles((prev) => {
        const hasChanged =
          prev.length !== cohortProfiles.length ||
          JSON.stringify(prev.map((p) => p.id).sort()) !==
            JSON.stringify(cohortProfiles.map((p) => p.id).sort());

        return hasChanged ? cohortProfiles : prev;
      });
    }
  }, [cohortData, isEditMode]);

  // Auto-fill current user for instructional users when creating a new cohort
  useEffect(() => {
    if (
      !isEditMode &&
      effectiveProfile?.role === "instructional" &&
      effectiveProfile?.id &&
      staffProfiles.length === 0 &&
      cohortData?.valid_profile_ids
    ) {
      // Create profile from cohortData mapping if user is in valid list
      if (cohortData.valid_profile_ids.includes(effectiveProfile.id)) {
        const profileInfo = cohortData.profile_mapping[effectiveProfile.id];
        const currentUserProfile: ProfileItem = {
          id: effectiveProfile.id,
          firstName: profileInfo?.name || "",
          lastName: "",
          alias: profileInfo?.name || "",
          role: effectiveProfile.role,
        } as ProfileItem;
        setStaffProfiles([currentUserProfile]);
      }
    }
  }, [
    isEditMode,
    effectiveProfile?.role,
    effectiveProfile?.id,
    cohortData?.valid_profile_ids,
    cohortData?.profile_mapping,
    staffProfiles.length,
  ]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    // Get original simulation IDs from cohortData
    const originalSimulationIds = cohortData?.simulation_ids || [];
    const originalProfileIds = cohortData?.profile_ids || [];

    return (
      current.title !== original.title ||
      current.description !== original.description ||
      current.active !== original.active ||
      current.defaultCohort !== original.defaultCohort ||
      current.departmentId !== original.departmentId ||
      JSON.stringify([...currentSimulationIds].sort()) !==
        JSON.stringify(originalSimulationIds.sort()) ||
      staffProfiles.length !== originalProfileIds.length ||
      profilesToDelete.length > 0
    );
  }, [
    formData,
    originalFormData,
    isEditMode,
    staffProfiles,
    profilesToDelete,
    currentSimulationIds,
    cohortData?.simulation_ids,
    cohortData?.profile_ids,
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

    // Department validation for superadmins
    if (effectiveProfile?.role === "superadmin" && !formData.departmentId) {
      newErrors.title = "Department selection is required for superadmin users";
    }

    // For instructional users, ensure they are always in the cohort
    if (effectiveProfile?.role === "instructional" && !isEditMode) {
      const isUserInCohort = staffProfiles.some(
        (profile) => profile.id === effectiveProfile.id
      );
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
    setStaffProfiles([]);
    setProfilesToDelete([]);
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare profile IDs from staff profiles
      const profileIds = staffProfiles.map((profile) => profile.id);

      const targetCohortId = cohortId || editingCohortId;
      if (targetCohortId) {
        // UPDATE mode - V2 API handles junction tables
        await updateCohortMutation.mutateAsync({
          cohortId: targetCohortId,
          title: formData.title || "",
          description: formData.description || "",
          department_id:
            formData.departmentId ||
            effectiveProfile?.primaryDepartmentId ||
            "",
          active: formData.active ?? true,
          default_cohort: formData.defaultCohort ?? false,
          simulation_ids: currentSimulationIds,
          profile_ids: profileIds,
        });

        toast.success("Cohort updated successfully!");
      } else {
        // CREATE mode - V2 API handles junction tables
        await createCohortMutation.mutateAsync({
          title: formData.title || "",
          description: formData.description || "",
          department_id:
            formData.departmentId ||
            effectiveProfile?.primaryDepartmentId ||
            "",
          active: formData.active || true,
          default_cohort: formData.defaultCohort ?? false,
          simulation_ids: currentSimulationIds,
          profile_ids: profileIds,
        });

        toast.success("Cohort created successfully!");
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
                {cohortData?.default_cohort &&
                effectiveProfile?.role !== "superadmin"
                  ? "Default cohort cannot be edited"
                  : "You don't have permission to edit this cohort"}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                {cohortData?.default_cohort &&
                effectiveProfile?.role !== "superadmin" ? (
                  <p>
                    This is a default cohort template restricted to superadmins.
                    You can view details but cannot make changes.
                  </p>
                ) : (
                  <p>
                    You can view the details but cannot make changes due to your
                    current permissions.
                  </p>
                )}
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

        {/* Department Selection - Only for superadmin */}
        {effectiveProfile?.role === "superadmin" && (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            {formData?.departmentId !== undefined && !isLoading ? (
              <DepartmentPicker
                mapping={cohortData?.department_mapping || {}}
                validIds={cohortData?.valid_department_ids || []}
                selectedIds={
                  formData.departmentId ? [formData.departmentId] : []
                }
                onSelect={(ids) =>
                  handleInputChange("departmentId", ids[0] || null)
                }
                placeholder="Select department"
                disabled={isReadonly}
                multiSelect={false}
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
          </div>
        )}

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

          {/* Default Cohort Switch - Only for superadmin */}
          {effectiveProfile?.role === "superadmin" && (
            <div className="flex items-center gap-2">
              <Label htmlFor="defaultCohort" className="text-sm">
                Default Cohort
              </Label>
              {formData.defaultCohort !== undefined && !isLoading ? (
                <Switch
                  id="defaultCohort"
                  checked={formData.defaultCohort ?? false}
                  onCheckedChange={(checked) =>
                    handleInputChange("defaultCohort", checked)
                  }
                  disabled={isReadonly}
                />
              ) : (
                <Skeleton className="h-6 w-11" />
              )}
            </div>
          )}
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
                    validSimulationIds={cohortData?.valid_simulation_ids || []}
                    selectedSimulationIds={currentSimulationIds}
                    onSelect={handleSimulationSelection}
                    // Filtering data not available in cohort detail response
                    scenarioFilterData={[]}
                    personaMapping={{}}
                    parameterItemMapping={{}}
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

                return (
                  <Card
                    key={simulationId}
                    className={`p-3 min-h-[180px] cursor-move hover:shadow-md transition-all border-l-4 border-l-blue-500 ${
                      draggedSimulation === simulationId ? "opacity-50" : ""
                    }`}
                    draggable={!isReadonly}
                    onDragStart={(e) =>
                      !isReadonly && handleDragStartSimulation(e, simulationId)
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => !isReadonly && handleDrop(e, simulationId)}
                  >
                    <div className="space-y-3 h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">
                            {simulation.name || "Unnamed Simulation"}
                          </h4>
                          <div className="flex items-center gap-2">
                            {!isReadonly && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => editSimulation(simulationId)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeSimulation(simulationId)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-2 mt-2">
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {simulation.description ||
                              "No description provided"}
                          </p>
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
        {cohortId && <CohortStaff
          profiles={staffProfiles}
          setProfiles={memoizedSetStaffProfiles}
          profilesToDelete={profilesToDelete}
          setProfilesToDelete={memoizedSetProfilesToDelete}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          effectiveProfile={effectiveProfile}
          isReadonly={isReadonly}
          cohortId={cohortId}
        />}

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
                The cohort has {staffProfiles.length} member
                {staffProfiles.length !== 1 ? "s" : ""} assigned. Updating this
                cohort will affect all simulations that use it. Are you sure you
                want to proceed?
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
