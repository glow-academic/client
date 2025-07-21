/**
 * Department.tsx
 * Used to display the department page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Skeleton } from "@/components/ui/skeleton";

import ProfileSelector from "@/components/common/profile/ProfileSelector";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Department, Profile, Scenario } from "@/types";
import { Location, ProfileRole } from "@/types";
import { logError } from "@/utils/logger";
import { createDepartment } from "@/utils/mutations/departments/create-department";
import { updateDepartment } from "@/utils/mutations/departments/update-department";
import { createLocation } from "@/utils/mutations/locations/create-location";
import { deleteLocation } from "@/utils/mutations/locations/delete-location";
import { updateLocation } from "@/utils/mutations/locations/update-location";
import { createProfile } from "@/utils/mutations/profiles/create-profile";
import { getDepartment } from "@/utils/queries/departments/get-department";
import { getLocationsByDepartment } from "@/utils/queries/locations/get-locations-by-department";
import { getProfilesByDepartment } from "@/utils/queries/profiles/get-profiles-by-department";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import {
  Building2,
  Edit,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

// A new type to represent a location that is either saved or new
type EditableLocation =
  | Location
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      name: string;
      description: string;
    };

// A new type to represent a profile that is either saved or new
type EditableProfile =
  | Profile
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      firstName: string;
      lastName: string;
      alias: string;
      role: ProfileRole;
    };

interface FormErrors {
  name?: string;
  departmentCode?: string;
  description?: string;
}

interface FormData {
  id?: string;
  name?: string;
  departmentCode?: string;
  description?: string;
}

export interface DepartmentFormProps {
  departmentId?: string;
}

export default function Department({ departmentId }: DepartmentFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  const editMode = !!departmentId;

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      departmentCode: "",
      description: "",
    }),
    []
  );

  const [formData, setFormData] = useState<FormData>();
  const [originalFormData, setOriginalFormData] = useState<FormData>();

  // Location management state
  const [editedLocations, setEditedLocations] = useState<EditableLocation[]>(
    []
  );
  const [originalLocations, setOriginalLocations] = useState<
    EditableLocation[]
  >([]);
  const [locationsToDelete, setLocationsToDelete] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [_selectedLocation, _setSelectedLocation] = useState<Location | null>(
    null
  );
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<EditableLocation | null>(null);

  // Profile management state
  const [editedProfiles, setEditedProfiles] = useState<EditableProfile[]>([]);
  const [originalProfiles, setOriginalProfiles] = useState<EditableProfile[]>(
    []
  );
  const [profilesToDelete, setProfilesToDelete] = useState<string[]>([]);

  const { data: departmentData, isLoading: isLoadingDepartment } = useQuery({
    queryKey: ["department", departmentId],
    queryFn: () => getDepartment(departmentId!),
    enabled: editMode,
  });

  // Fetch locations for this department
  const { data: locations, isLoading: isLoadingLocations } = useQuery({
    queryKey: ["locations", departmentId],
    queryFn: () => getLocationsByDepartment(departmentId!),
    enabled: editMode,
  });

  // Fetch profiles for this department
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles", departmentId],
    queryFn: () => getProfilesByDepartment(departmentId!),
    enabled: editMode,
  });

  // Fetch scenarios to check for impact
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
    enabled: editMode,
  });

  // Reset location and profile state when data changes
  const resetFormState = useCallback(() => {
    if (locations) {
      setEditedLocations(locations);
      setOriginalLocations(locations);
      setLocationsToDelete([]);
    }
    if (profiles) {
      setEditedProfiles(profiles);
      setOriginalProfiles(profiles);
      setProfilesToDelete([]);
    }
  }, [locations, profiles]);

  useEffect(() => {
    resetFormState();
  }, [resetFormState]);

  // Check if form has changes
  const hasChanges = useMemo(() => {
    if (!editMode || !formData || !originalFormData) return false;

    const current = formData;
    const original = originalFormData;

    // Check basic form fields
    const formFieldsChanged =
      current.name !== original.name ||
      current.departmentCode !== original.departmentCode ||
      current.description !== original.description;

    // Check location changes
    const locationsChanged =
      editedLocations.length !== originalLocations.length ||
      locationsToDelete.length > 0 ||
      editedLocations.some((loc, index) => {
        const originalLoc = originalLocations[index];
        if (!originalLoc) return true;
        if ("isNew" in loc && loc.isNew) return true;
        return (
          loc.name !== originalLoc.name ||
          loc.description !== originalLoc.description
        );
      });

    // Check profile changes
    const profilesChanged =
      editedProfiles.length !== originalProfiles.length ||
      profilesToDelete.length > 0 ||
      editedProfiles.some((profile, index) => {
        const originalProfile = originalProfiles[index];
        if (!originalProfile) return true;
        if ("isNew" in profile && profile.isNew) return true;
        return profile.role !== originalProfile.role;
      });

    return formFieldsChanged || locationsChanged || profilesChanged;
  }, [
    formData,
    originalFormData,
    editedLocations,
    originalLocations,
    locationsToDelete,
    editedProfiles,
    originalProfiles,
    profilesToDelete,
    editMode,
  ]);

  // Count scenarios affected by this department
  const affectedScenarios = useMemo(() => {
    if (!editMode || !departmentId) return [];
    return scenarios.filter(
      (scenario: Scenario) => scenario.classId === departmentId
    );
  }, [scenarios, departmentId, editMode]);

  const [errors, setErrors] = useState<FormErrors>({});
  const isLoading =
    isLoadingDepartment || isLoadingLocations || isLoadingProfiles;

  useEffect(() => {
    if (departmentData && editMode) {
      const departmentFormData = {
        name: departmentData.name,
        departmentCode: departmentData.departmentCode,
        description: departmentData.description,
      };
      setFormData(departmentFormData);
      setOriginalFormData(departmentFormData);
    } else if (!editMode) {
      setFormData(initialFormData);
      setOriginalFormData(initialFormData);
    }
  }, [departmentData, editMode, initialFormData]);

  const handleSubmit = async () => {
    const validationErrors: FormErrors = {};
    if (!formData?.name?.trim()) {
      validationErrors.name = "Department name is required";
    }

    if (!formData?.departmentCode?.trim()) {
      validationErrors.departmentCode = "Department code is required";
    }

    if (!formData?.description?.trim()) {
      validationErrors.description = "Description is required";
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      `${editMode ? "Updating" : "Creating"} department...`
    );

    try {
      let finalDepartmentId = departmentId;

      // Step 1: Create the department if it's new
      if (!editMode) {
        const newDepartment = await createDepartment(formData as Department);
        if (!newDepartment?.id) throw new Error("Failed to create department.");
        finalDepartmentId = newDepartment.id;
        toast.success(
          "Department created, now managing locations and profiles..."
        );
      }

      if (!finalDepartmentId) {
        throw new Error("Cannot manage locations without a department ID.");
      }

      // Step 2: Handle all location operations
      const newLocationUploads = editedLocations.filter(
        (loc) => "isNew" in loc && loc.isNew
      ) as Extract<EditableLocation, { isNew: true }>[];

      // Create location promises for new locations
      const createLocationPromises = newLocationUploads.map((loc) =>
        createLocation({
          name: loc.name,
          description: loc.description,
          departmentId: finalDepartmentId!,
        })
      );

      // Create deletion promises for marked locations
      const deleteLocationPromises = locationsToDelete.map((locId) =>
        deleteLocation(locId)
      );

      // Create update promises for modified locations
      const updateLocationPromises = editedLocations
        .filter((loc) => !("isNew" in loc))
        .map((loc) => {
          const originalLoc = locations?.find((l) => l.id === loc.id);
          if (
            originalLoc &&
            (originalLoc.name !== loc.name ||
              originalLoc.description !== loc.description)
          ) {
            return updateLocation(loc.id, {
              name: loc.name,
              description: loc.description,
            });
          }
          return null;
        })
        .filter((p) => p !== null);

      // Step 3: Handle all profile operations
      const newProfileUploads = editedProfiles.filter(
        (profile) => "isNew" in profile && profile.isNew
      ) as Extract<EditableProfile, { isNew: true }>[];

      // Create profile promises for new profiles
      const createProfilePromises = newProfileUploads.map((profile) =>
        createProfile({
          firstName: profile.firstName,
          lastName: profile.lastName,
          alias: profile.alias,
          role: profile.role,
        })
      );

      // Wait for all location and profile operations to complete
      await Promise.all([
        ...createLocationPromises,
        ...deleteLocationPromises,
        ...updateLocationPromises,
        ...createProfilePromises,
      ]);

      // Step 4: Update department details (if in edit mode)
      if (editMode) {
        await updateDepartment(finalDepartmentId, formData as Department);
      }

      toast.dismiss(toastId);
      toast.success(
        `Department ${editMode ? "updated" : "created"} successfully!`
      );

      // Step 5: Invalidate queries and navigate
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({
        queryKey: ["department", finalDepartmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["locations", finalDepartmentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["profiles", finalDepartmentId],
      });

      router.push(`/management/departments`);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(
        `Failed to save department: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      logError(`Error saving department:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClick = () => {
    if (editMode && affectedScenarios.length > 0) {
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

  // Location management functions
  const addNewLocation = () => {
    const newLocation: EditableLocation = {
      isNew: true,
      id: `temp-${Date.now()}`,
      name: "",
      description: "",
    };
    setEditingLocation(newLocation);
    setShowLocationModal(true);
  };

  const editLocation = (location: EditableLocation) => {
    setEditingLocation(location);
    setShowLocationModal(true);
  };

  const saveLocation = () => {
    if (
      !editingLocation ||
      !editingLocation.name.trim() ||
      !editingLocation.description.trim()
    ) {
      return;
    }

    if ("isNew" in editingLocation && editingLocation.isNew) {
      // Add new location to the list
      setEditedLocations((prev) => [...prev, editingLocation]);
    } else {
      // Update existing location
      setEditedLocations((prev) =>
        prev.map((loc) =>
          loc.id === editingLocation.id ? editingLocation : loc
        )
      );
    }

    setEditingLocation(null);
    setShowLocationModal(false);
  };

  const deleteLocationFromList = (locationId: string) => {
    const locationToRemove = editedLocations.find((l) => l.id === locationId);
    if (!locationToRemove) return;

    // If it's an existing location, add its ID to the deletion queue
    if (!("isNew" in locationToRemove)) {
      setLocationsToDelete((prev) => [...prev, locationId]);
    }

    // Remove the location from the visible UI state
    setEditedLocations((prev) => prev.filter((l) => l.id !== locationId));
  };

  // Filter locations for rendering
  const filteredLocations = editedLocations.filter((loc: EditableLocation) => {
    const matchesSearch = searchQuery
      ? loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.description.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 relative">
      <div className="max-w-6xl mx-auto">
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Department Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Department Name *</Label>
            {formData?.name !== undefined && !isLoading ? (
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Computer Science Department"
                className={errors.name ? "border-red-500" : ""}
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Department Code */}
          <div className="space-y-2">
            <Label htmlFor="departmentCode">Department Code *</Label>
            {formData?.departmentCode !== undefined && !isLoading ? (
              <Input
                id="departmentCode"
                value={formData.departmentCode}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    departmentCode: e.target.value,
                  }))
                }
                placeholder="e.g., CS"
                className={errors.departmentCode ? "border-red-500" : ""}
                style={{ width: 120 }}
              />
            ) : (
              <Skeleton className="h-10 w-full" />
            )}
            {errors.departmentCode && (
              <p className="text-sm text-red-500">{errors.departmentCode}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            {formData?.description !== undefined && !isLoading ? (
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe the department's mission, focus areas, and key responsibilities..."
                rows={4}
                className={errors.description ? "border-red-500" : ""}
              />
            ) : (
              <Skeleton className="h-20 w-full" />
            )}
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Locations Section */}
          <div className="space-y-4">
            <Label>Locations</Label>

            {/* Controls Bar */}
            <div className="flex items-center justify-between gap-4">
              {/* Left side - Search */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search locations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 w-64"
                  />
                </div>
              </div>

              {/* Right side - Add Location */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={addNewLocation}
                  disabled={isSubmitting}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Location
                </Button>
              </div>
            </div>

            {/* Locations Display Area */}
            {isLoading ? (
              <Skeleton className="h-[200px] rounded-lg" />
            ) : (
              <div
                className={cn(
                  "min-h-[200px] rounded-lg",
                  filteredLocations.length === 0 ? "border-2 border-dashed" : ""
                )}
              >
                {filteredLocations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground mb-2">
                      {editedLocations.length === 0
                        ? "No locations yet"
                        : "No locations match your search"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {editedLocations.length === 0
                        ? "Click Add Location to get started"
                        : "Try adjusting your search"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLocations.map((location) => {
                      const isNewLoc = "isNew" in location && location.isNew;
                      return (
                        <div
                          key={location.id}
                          className={cn(
                            "flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm transition-all",
                            isNewLoc && "border-blue-300 bg-blue-50/50"
                          )}
                        >
                          <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-6 w-6 text-blue-500" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p
                                className="font-medium truncate"
                                title={location.name}
                              >
                                {location.name}
                              </p>
                              {isNewLoc && (
                                <span className="bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                                  NEW
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {location.description}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => editLocation(location)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                deleteLocationFromList(location.id)
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Staff Management Section - Only show in edit mode */}
          {editMode && (
            <div className="space-y-4">
              <ProfileSelector
                selectedProfiles={editedProfiles}
                onProfilesChange={setEditedProfiles}
                allowedRoles={["instructional"]}
                title="Staff Management"
                description="Add instructional staff to this department"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div className="flex-1 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/management/departments")}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (editMode && !hasChanges)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editMode ? "Updating..." : "Creating..."}
                  </>
                ) : editMode ? (
                  "Update Department"
                ) : (
                  "Create Department"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Location Edit Dialog */}
      <Dialog open={showLocationModal} onOpenChange={setShowLocationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLocation &&
              "isNew" in editingLocation &&
              editingLocation.isNew
                ? "Add New Location"
                : "Edit Location"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="locationName">Location Name</Label>
              <Input
                id="locationName"
                value={editingLocation?.name || ""}
                onChange={(e) =>
                  setEditingLocation((prev) =>
                    prev ? { ...prev, name: e.target.value } : null
                  )
                }
                placeholder="e.g., Main Campus Building"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationDescription">Description</Label>
              <Textarea
                id="locationDescription"
                value={editingLocation?.description || ""}
                onChange={(e) =>
                  setEditingLocation((prev) =>
                    prev ? { ...prev, description: e.target.value } : null
                  )
                }
                placeholder="Describe the location, facilities, and any relevant details..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingLocation(null);
                  setShowLocationModal(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={saveLocation}>Save Location</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Department</AlertDialogTitle>
            <AlertDialogDescription>
              This department is currently used by {affectedScenarios.length}{" "}
              scenario{affectedScenarios.length !== 1 ? "s" : ""}:
              <ul className="mt-2 list-disc list-inside">
                {affectedScenarios.map((scenario) => (
                  <li key={scenario.id} className="text-sm">
                    {scenario.name}
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-sm font-medium">
                The department also has {editedLocations.length} location
                {editedLocations.length !== 1 ? "s" : ""} associated with it.
                Updating this department will affect all scenarios that use it.
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
