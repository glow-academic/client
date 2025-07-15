/**
 * Cohort.tsx
 * Used to create and manage cohorts for the admin dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
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
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useRole } from "@/contexts/role-context";
import { Class, Cohort as CohortType, Profile, Simulation } from "@/types";
import { createCohort } from "@/utils/mutations/cohorts/create-cohort";
import { updateCohort } from "@/utils/mutations/cohorts/update-cohort";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getProfilesByClass } from "@/utils/queries/profiles/get-profiles-by-class";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { GripVertical, Loader2, Search, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";

export interface CohortProps {
  cohortId?: string;
}

interface FormErrors {
  title?: string;
}

export default function Cohort({ cohortId }: CohortProps) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Role-based access control
  const { effectiveRole } = useRole();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [draggedProfile, setDraggedProfile] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClassForAdd, setSelectedClassForAdd] = useState<string>("");

  const isEditMode = !!cohortId;

  const initialFormData: Partial<CohortType> = {
    title: "",
    description: "",
    profileIds: [],
    active: true,
  };

  const [formData, setFormData] =
    useState<Partial<CohortType>>(initialFormData);
  const [originalFormData, setOriginalFormData] =
    useState<Partial<CohortType>>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch cohorts for the list mode
  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
    enabled: isEditMode, // Only fetch when in edit mode
  });

  // Load cohort data if editing
  useEffect(() => {
    const targetCohortId = cohortId || editingCohortId;
    if (targetCohortId) {
      const cohortToEdit = cohorts.find(
        (c: CohortType) => c.id === targetCohortId
      );
      if (cohortToEdit) {
        const cohortData = {
          title: cohortToEdit.title || "",
          description: cohortToEdit.description || "",
          profileIds: cohortToEdit.profileIds || [],
          active: cohortToEdit.active ?? true,
        };
        setFormData(cohortData);
        setOriginalFormData(cohortData); // Set original data for comparison
      }
    }
  }, [cohortId, editingCohortId, cohorts]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!isEditMode) return false;

    const current = formData;
    const original = originalFormData;

    return (
      current.title !== original.title ||
      current.description !== original.description ||
      current.active !== original.active ||
      JSON.stringify(current.profileIds?.sort()) !==
        JSON.stringify(original.profileIds?.sort())
    );
  }, [formData, originalFormData, isEditMode]);

  // Count simulations using this cohort
  const affectedSimulations = useMemo(() => {
    if (!isEditMode || !cohortId) return [];
    return simulations.filter(
      (sim: Simulation) => sim.cohortIds && sim.cohortIds.includes(cohortId)
    );
  }, [simulations, cohortId, isEditMode]);

  // Filter available profiles based on search term
  const filteredAvailableProfiles = useMemo(() => {
    return profiles
      .filter(
        (profile: Profile) =>
          !formData.profileIds?.includes(profile.id) &&
          profile.role !== "admin" &&
          profile.role !== "instructional"
      )
      .filter((profile: Profile) => {
        if (!searchTerm) return true;
        const fullName =
          `${profile.firstName} ${profile.lastName}`.toLowerCase();
        const alias = profile.alias.toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || alias.includes(search);
      });
  }, [profiles, formData.profileIds, searchTerm]);

  // Role-based access control - check after all hooks
  if (effectiveRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You need admin privileges to access cohort management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleInputChange = (
    field: keyof Partial<CohortType>,
    value: string | boolean | string[] | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const addProfile = (profileId: string) => {
    if (!formData.profileIds?.includes(profileId)) {
      setFormData((prev) => ({
        ...prev,
        profileIds: [...(prev.profileIds || []), profileId],
      }));
    }
  };

  const addProfilesByClass = async (classId: string) => {
    try {
      const classProfiles = await getProfilesByClass(classId);
      const newProfileIds = classProfiles
        .filter(
          (profile: Profile) =>
            !formData.profileIds?.includes(profile.id) &&
            profile.role !== "admin" &&
            profile.role !== "instructional"
        )
        .map((profile: Profile) => profile.id);

      if (newProfileIds.length > 0) {
        setFormData((prev) => ({
          ...prev,
          profileIds: [...(prev.profileIds || []), ...newProfileIds],
        }));

        const selectedClass = classes.find((c: Class) => c.id === classId);
        toast.success(
          `Added ${newProfileIds.length} profiles from ${selectedClass?.name || "class"}`
        );
      } else {
        const selectedClass = classes.find((c: Class) => c.id === classId);
        toast.info(
          `No new profiles found in ${selectedClass?.name || "class"}`
        );
      }
    } catch (error) {
      toast.error(
        `Failed to add profiles by class: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  };

  const removeProfile = (profileId: string) => {
    setFormData((prev) => ({
      ...prev,
      profileIds: prev.profileIds?.filter((id) => id !== profileId) || [],
    }));
  };

  const handleDragStart = (e: React.DragEvent, profileId: string) => {
    setDraggedProfile(profileId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetProfileId: string) => {
    e.preventDefault();

    if (!draggedProfile) return;

    const newOrder = [...(formData.profileIds || [])];
    const draggedIndex = newOrder.findIndex((id) => id === draggedProfile);
    const targetIndex = newOrder.findIndex((id) => id === targetProfileId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed!);

      setFormData((prev) => ({ ...prev, profileIds: newOrder }));
    }

    setDraggedProfile(null);
  };

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
    setSearchTerm("");
    setSelectedClassForAdd("");
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      const targetCohortId = cohortId || editingCohortId;
      if (targetCohortId) {
        result = await updateCohort(targetCohortId, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Cohort updated successfully!");
      } else {
        result = await createCohort({
          title: formData.title || "",
          description: formData.description || "",
          profileIds: formData.profileIds || [],
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
    if (isEditMode && affectedSimulations.length > 0) {
      setShowUpdateDialog(true);
    } else {
      handleSubmit();
    }
  };

  const handleConfirmUpdate = () => {
    setShowUpdateDialog(false);
    handleSubmit();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateClick();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Basic Cohort Information */}

        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange("title", e.target.value)}
            placeholder="Enter cohort title"
            className={errors.title ? "border-destructive" : ""}
          />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description || ""}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Enter cohort description (optional)"
            rows={3}
          />
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <Label htmlFor="profiles">Members</Label>
              <p className="text-sm text-muted-foreground">
                Add individual profiles or entire classes to the cohort
              </p>
            </div>
          </div>

          {/* Add profiles controls */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search for individual profiles */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search profiles by name or alias..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Add individual profile */}
            <Select
              value=""
              onValueChange={(value: string) => {
                if (value) {
                  addProfile(value);
                  setSearchTerm(""); // Clear search after adding
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Add profile" />
              </SelectTrigger>
              <SelectContent>
                {filteredAvailableProfiles.length === 0 ? (
                  <SelectItem value="no-profiles" disabled>
                    {searchTerm ? "No profiles found" : "No available profiles"}
                  </SelectItem>
                ) : (
                  filteredAvailableProfiles.map((profile: Profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.firstName} {profile.lastName} ({profile.alias})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* Add by class */}
            <Select
              value={selectedClassForAdd}
              onValueChange={(value: string) => {
                if (value) {
                  addProfilesByClass(value);
                  setSelectedClassForAdd("");
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Add by class" />
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 ? (
                  <SelectItem value="no-classes" disabled>
                    No classes available
                  </SelectItem>
                ) : (
                  classes.map((classItem: Class) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {classItem.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Display current members */}
          {formData.profileIds?.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-center text-muted-foreground border border-dashed rounded-md p-4">
              <div>
                <p className="font-medium mb-1">No members selected</p>
                <p className="text-sm">
                  Use the controls above to add profiles individually or by
                  class
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {formData.profileIds?.length} member
                  {formData.profileIds?.length !== 1 ? "s" : ""} selected
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, profileIds: [] }))
                  }
                >
                  Clear all
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {formData.profileIds?.map((profileId) => {
                  const profile = profiles.find(
                    (p: Profile) => p.id === profileId
                  );
                  if (!profile) return null;

                  return (
                    <Card
                      key={profileId}
                      className={`p-3 cursor-move hover:shadow-md transition-all border-l-4 border-l-blue-500 ${
                        draggedProfile === profileId ? "opacity-50" : ""
                      }`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, profileId)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, profileId)}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">
                            {profile.firstName} {profile.lastName}
                          </h4>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeProfile(profileId)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {profile.alias}
                          </p>

                          <div className="flex items-center gap-2">
                            <Badge
                              className={`text-xs ${
                                profile.role === "admin"
                                  ? "bg-red-100 text-red-800"
                                  : profile.role === "instructor"
                                    ? "bg-blue-100 text-blue-800"
                                    : profile.role === "ta"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {profile.role
                                ? profile.role.charAt(0).toUpperCase() +
                                  profile.role.slice(1)
                                : "No Role"}
                            </Badge>

                            {/* Show class badges */}
                            {profile.classIds &&
                              profile.classIds.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {profile.classIds
                                    .slice(0, 2)
                                    .map((classId) => {
                                      const classItem = classes.find(
                                        (c: Class) => c.id === classId
                                      );
                                      return classItem ? (
                                        <Badge
                                          key={classId}
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {classItem.name}
                                        </Badge>
                                      ) : null;
                                    })}
                                  {profile.classIds.length > 2 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{profile.classIds.length - 2}
                                    </Badge>
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/create/cohorts")}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              This cohort is currently used by {affectedSimulations.length}{" "}
              simulation{affectedSimulations.length !== 1 ? "s" : ""}:
              <ul className="mt-2 list-disc list-inside">
                {affectedSimulations.map((sim) => (
                  <li key={sim.id} className="text-sm">
                    {sim.title}
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-sm font-medium">
                The cohort has {formData.profileIds?.length || 0} member
                {(formData.profileIds?.length || 0) !== 1 ? "s" : ""} assigned.
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
