/**
 * Cohort.tsx
 * Used to create and manage cohorts for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useProfile } from "@/contexts/profile-context";
import { Cohort as CohortType, Profile, Simulation } from "@/types";
import { createCohort } from "@/utils/mutations/cohorts/create-cohort";
import { updateCohort } from "@/utils/mutations/cohorts/update-cohort";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  SimulationPicker,
  Simulation as SimulationPickerType,
} from "./SimulationPicker";
import CohortStaff from "./staff/CohortStaff";

export interface CohortProps {
  cohortId?: string;
}

interface FormErrors {
  title?: string;
}

// A new type to represent a profile that is either saved or new
type EditableProfile =
  | Profile
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      firstName: string;
      lastName: string;
      alias: string;
      role: Profile["role"];
    };

export default function Cohort({ cohortId }: CohortProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { effectiveProfile } = useProfile();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [draggedSimulation, setDraggedSimulation] = useState<string | null>(
    null
  );
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const isEditMode = !!cohortId;

  const initialFormData: Partial<CohortType> = {
    title: "",
    description: "",
    profileIds: [],
    simulationIds: [],
    active: true,
  };

  const [formData, setFormData] =
    useState<Partial<CohortType>>(initialFormData);
  const [originalFormData, setOriginalFormData] =
    useState<Partial<CohortType>>(initialFormData);
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

  // Fetch cohorts for the list mode
  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: simulations = [], isLoading: isLoadingSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios = [], isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const isLoading =
    isLoadingProfiles || isLoadingSimulations || isLoadingScenarios;

  // Transform simulations to match SimulationPicker interface
  const transformedSimulations: SimulationPickerType[] = useMemo(() => {
    return simulations.map((sim) => ({
      id: sim.id,
      title: sim.title,
      description: `Simulation with ${sim.scenarioIds?.length || 0} scenarios`,
      timeLimit: sim.timeLimit || undefined,
      active: sim.active,
      defaultSimulation: sim.defaultSimulation,
      practiceSimulation: sim.practiceSimulation,
    }));
  }, [simulations]);

  // Compute selected simulations from formData
  const selectedSimulations = useMemo(() => {
    if (!formData.simulationIds || simulations.length === 0) {
      return [];
    }
    return transformedSimulations.filter((sim) =>
      formData.simulationIds?.includes(sim.id)
    );
  }, [formData.simulationIds, transformedSimulations, simulations.length]);

  // Handle simulation selection from picker
  const handleSimulationSelection = useCallback(
    (selectedSims: SimulationPickerType[]) => {
      const simulationIds = selectedSims.map((sim) => sim.id);
      setFormData((prev) => ({
        ...prev,
        simulationIds,
      }));
    },
    []
  );

  // Load cohort data if editing
  useEffect(() => {
    const targetCohortId = cohortId || editingCohortId;
    if (
      targetCohortId &&
      cohorts.length > 0 &&
      profiles.length > 0 &&
      isEditMode
    ) {
      const cohortToEdit = cohorts.find(
        (c: CohortType) => c.id === targetCohortId
      );
      if (cohortToEdit) {
        const cohortData = {
          title: cohortToEdit.title || "",
          description: cohortToEdit.description || "",
          profileIds: cohortToEdit.profileIds || [],
          simulationIds: cohortToEdit.simulationIds || [],
          active: cohortToEdit.active ?? true,
        };

        // Only update if the data has actually changed to prevent infinite loops
        setFormData((prev) => {
          const hasChanged =
            prev.title !== cohortData.title ||
            prev.description !== cohortData.description ||
            JSON.stringify(prev.profileIds) !==
              JSON.stringify(cohortData.profileIds) ||
            JSON.stringify(prev.simulationIds) !==
              JSON.stringify(cohortData.simulationIds) ||
            prev.active !== cohortData.active;

          return hasChanged ? cohortData : prev;
        });

        setOriginalFormData((prev) => {
          const hasChanged =
            prev.title !== cohortData.title ||
            prev.description !== cohortData.description ||
            JSON.stringify(prev.profileIds) !==
              JSON.stringify(cohortData.profileIds) ||
            JSON.stringify(prev.simulationIds) !==
              JSON.stringify(cohortData.simulationIds) ||
            prev.active !== cohortData.active;

          return hasChanged ? cohortData : prev;
        });

        // Load staff profiles
        const cohortProfiles = profiles.filter((profile: Profile) =>
          cohortToEdit.profileIds?.includes(profile.id)
        );

        setStaffProfiles((prev) => {
          const hasChanged =
            prev.length !== cohortProfiles.length ||
            JSON.stringify(prev.map((p) => p.id).sort()) !==
              JSON.stringify(cohortProfiles.map((p) => p.id).sort());

          return hasChanged ? cohortProfiles : prev;
        });
      }
    }
  }, [
    cohortId,
    editingCohortId,
    cohorts,
    profiles,
    simulations.length,
    isEditMode,
  ]);

  // Auto-fill current user for instructional users when creating a new cohort
  useEffect(() => {
    if (
      !isEditMode &&
      effectiveProfile?.role === "instructional" &&
      effectiveProfile?.id &&
      profiles.length > 0 &&
      staffProfiles.length === 0
    ) {
      const currentUserProfile = profiles.find(
        (profile: Profile) => profile.id === effectiveProfile.id
      );
      if (currentUserProfile) {
        setStaffProfiles([currentUserProfile]);
      }
    }
  }, [
    isEditMode,
    effectiveProfile?.role,
    effectiveProfile?.id,
    profiles,
    staffProfiles.length,
  ]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    return (
      current.title !== original.title ||
      current.description !== original.description ||
      current.active !== original.active ||
      JSON.stringify(current.simulationIds?.sort()) !==
        JSON.stringify(original.simulationIds?.sort()) ||
      staffProfiles.length !== (original.profileIds?.length || 0) ||
      profilesToDelete.length > 0
    );
  }, [formData, originalFormData, isEditMode, staffProfiles, profilesToDelete]);

  const handleInputChange = (
    field: keyof Partial<CohortType>,
    value: string | boolean | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Simulation management handlers
  const removeSimulation = (simulationId: string) => {
    setFormData((prev) => ({
      ...prev,
      simulationIds:
        prev.simulationIds?.filter((id) => id !== simulationId) || [],
    }));
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

    const newOrder = [...(formData.simulationIds || [])];
    const draggedIndex = newOrder.findIndex((id) => id === draggedSimulation);
    const targetIndex = newOrder.findIndex((id) => id === targetSimulationId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed!);

      setFormData((prev) => ({ ...prev, simulationIds: newOrder }));
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

      let result;
      const targetCohortId = cohortId || editingCohortId;
      if (targetCohortId) {
        result = await updateCohort(targetCohortId, {
          ...formData,
          profileIds,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Cohort updated successfully!");
      } else {
        result = await createCohort({
          title: formData.title || "",
          description: formData.description || "",
          profileIds,
          simulationIds: formData.simulationIds || [],
          active: formData.active || true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast.success("Cohort created successfully!");
      }

      if (!result) {
        toast.error("Failed to create cohort");
        return;
      }

      resetFormAndState();
      queryClient.invalidateQueries({ queryKey: ["cohorts"] });
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
    router.push(`/create/simulations/s/${simulationId}`);
  };

  return (
    <div className="space-y-6">
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
            />
          ) : (
            <Skeleton className="h-20 w-full" />
          )}
        </div>

        {/* Active/Inactive Switch */}
        <div className="flex flex-col gap-2">
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
            />
          ) : (
            <Skeleton className="h-6 w-11" />
          )}
        </div>

        {/* Simulations */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="simulations">Simulations</Label>
              {!isLoading && (
                <p className="text-sm text-muted-foreground mt-1">
                  Select simulations to assign to this cohort
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {formData.simulationIds !== undefined && !isLoading ? (
                <SimulationPicker
                  simulations={transformedSimulations}
                  selectedSimulations={selectedSimulations}
                  onSelect={handleSimulationSelection}
                  placeholder="Add simulation"
                  showLabel={false}
                  buttonClassName="w-48"
                />
              ) : (
                <Skeleton className="h-10 w-48" />
              )}
            </div>
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
          ) : formData.simulationIds?.length === 0 ? (
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
              {formData.simulationIds?.map((simulationId) => {
                const simulation = simulations.find(
                  (s: Simulation) => s.id === simulationId
                );
                if (!simulation) return null;

                return (
                  <Card
                    key={simulationId}
                    className={`p-3 min-h-[180px] cursor-move hover:shadow-md transition-all border-l-4 border-l-blue-500 ${
                      draggedSimulation === simulationId ? "opacity-50" : ""
                    }`}
                    draggable
                    onDragStart={(e) =>
                      handleDragStartSimulation(e, simulationId)
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, simulationId)}
                  >
                    <div className="space-y-3 h-full flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">
                            {simulation.title || "Unnamed Simulation"}
                          </h4>
                          <div className="flex items-center gap-2">
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
                          </div>
                        </div>

                        <div className="space-y-2 mt-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              Time: {simulation.timeLimit || "No limit"} min
                            </Badge>
                          </div>

                          {/* Scenario Names */}
                          {simulation.scenarioIds &&
                            simulation.scenarioIds.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Scenarios ({simulation.scenarioIds.length}):
                                </p>
                                <div className="space-y-1">
                                  {simulation.scenarioIds
                                    .slice(0, 3)
                                    .map((scenarioId) => {
                                      const scenario = scenarios.find(
                                        (s) => s.id === scenarioId
                                      );
                                      return (
                                        <div
                                          key={scenarioId}
                                          className="text-xs text-muted-foreground truncate"
                                        >
                                          •{" "}
                                          {scenario?.name || "Unknown Scenario"}
                                        </div>
                                      );
                                    })}
                                  {simulation.scenarioIds.length > 3 && (
                                    <div className="text-xs text-muted-foreground">
                                      +{simulation.scenarioIds.length - 3}{" "}
                                      more...
                                    </div>
                                  )}
                                </div>
                              </div>
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
        <CohortStaff
          profiles={staffProfiles}
          setProfiles={memoizedSetStaffProfiles}
          profilesToDelete={profilesToDelete}
          setProfilesToDelete={memoizedSetProfilesToDelete}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          currentCohortName={formData.title || ""}
          effectiveProfile={effectiveProfile}
        />

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
                disabled={isSubmitting || (isEditMode && !hasChanges)}
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
              {formData.simulationIds?.length || 0} simulation
              {(formData.simulationIds?.length || 0) !== 1 ? "s" : ""}:
              <ul className="mt-2 list-disc list-inside">
                {formData.simulationIds?.map((simId) => {
                  const sim = simulations.find(
                    (s: Simulation) => s.id === simId
                  );
                  return (
                    <li key={simId} className="text-sm">
                      {sim?.title || "Unknown Simulation"}
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
