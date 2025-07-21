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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Department, Profile, Scenario } from "@/types";
import { ProfileRole } from "@/types";
import { logError } from "@/utils/logger";
import { createDepartment } from "@/utils/mutations/departments/create-department";
import { updateDepartment } from "@/utils/mutations/departments/update-department";
import { createProfile } from "@/utils/mutations/profiles/create-profile";
import { getDepartment } from "@/utils/queries/departments/get-department";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import {
  Eye,
  Grid3X3,
  List,
  Loader2,
  Search,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";

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

  // Profile management state
  const [editedProfiles, setEditedProfiles] = useState<EditableProfile[]>([]);
  const [originalProfiles, setOriginalProfiles] = useState<EditableProfile[]>(
    []
  );
  const [profilesToDelete, setProfilesToDelete] = useState<string[]>([]);

  // Profile display state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  const { data: departmentData, isLoading: isLoadingDepartment } = useQuery({
    queryKey: ["department", departmentId],
    queryFn: () => getDepartment(departmentId!),
    enabled: editMode,
  });

  // Fetch scenarios to check for impact
  const { data: scenarios = [] } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
    enabled: editMode,
  });

  // Reset profile state when data changes
  const resetFormState = useCallback(() => {
    if (departmentData?.profileIds) {
      // For now, we'll create placeholder profiles based on profileIds
      // In a real implementation, you'd fetch the actual profiles
      const placeholderProfiles: EditableProfile[] =
        departmentData.profileIds.map((id) => ({
          isNew: true,
          id,
          firstName: `Profile ${id.slice(0, 8)}`,
          lastName: "",
          alias: `profile_${id.slice(0, 8)}`,
          role: "instructional" as ProfileRole,
        }));
      setEditedProfiles(placeholderProfiles);
      setOriginalProfiles(placeholderProfiles);
      setProfilesToDelete([]);
    }
  }, [departmentData]);

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

    return formFieldsChanged || profilesChanged;
  }, [
    formData,
    originalFormData,
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
  const isLoading = isLoadingDepartment;

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
        toast.success("Department created, now managing profiles...");
      }

      if (!finalDepartmentId) {
        throw new Error("Cannot manage profiles without a department ID.");
      }

      // Step 2: Handle all profile operations
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

      // Wait for all profile operations to complete
      await Promise.all([...createProfilePromises]);

      // Step 3: Update department details (if in edit mode)
      if (editMode) {
        await updateDepartment(finalDepartmentId, formData as Department);
      }

      toast.dismiss(toastId);
      toast.success(
        `Department ${editMode ? "updated" : "created"} successfully!`
      );

      // Step 4: Invalidate queries and navigate
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({
        queryKey: ["department", finalDepartmentId],
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

  // Profile management functions
  const stageProfileForDeletion = (profileId: string) => {
    const profileToRemove = editedProfiles.find((p) => p.id === profileId);
    if (!profileToRemove) return;

    // If it's an existing profile, add its ID to the deletion queue
    if (!("isNew" in profileToRemove)) {
      setProfilesToDelete([...profilesToDelete, profileId]);
    }

    // Remove the profile from the visible UI state
    setEditedProfiles(editedProfiles.filter((p) => p.id !== profileId));
  };

  const handleProfileRoleChange = (profileId: string, newRole: ProfileRole) => {
    setEditedProfiles(
      editedProfiles.map((profile) =>
        profile.id === profileId ? { ...profile, role: newRole } : profile
      )
    );
  };

  const getProfileRoleIcon = (role: ProfileRole) => {
    switch (role) {
      case "instructional":
        return "👨‍🏫";
      case "instructor":
        return "👨‍🏫";
      case "ta":
        return "👨‍🎓";
      default:
        return "👤";
    }
  };

  const viewProfile = (profile: EditableProfile) => {
    // For now, this function does nothing as requested
    // In the future, this could open a profile details modal
    logError("View profile:", profile);
  };

  // Filter profiles from the *edited* state for rendering
  const filteredProfiles = editedProfiles.filter((profile: EditableProfile) => {
    const matchesSearch = searchQuery
      ? profile.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        profile.alias.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchesRole =
      roleFilter === "all" ? true : profile.role === roleFilter;
    return matchesSearch && matchesRole;
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

          {/* Staff Management Section - Only show in edit mode */}
          {editMode && (
            <div className="space-y-4">
              <Label>Staff Management</Label>

              {/* Controls Bar */}
              <div className="flex items-center justify-between gap-4">
                {/* Left side - Search and Filters */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search staff..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9 w-64"
                    />
                  </div>

                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="instructional">
                        👨‍🏫 Instructional
                      </SelectItem>
                      <SelectItem value="instructor">👨‍🏫 Instructor</SelectItem>
                      <SelectItem value="ta">👨‍🎓 TA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Right side - View Toggle */}
                <div className="flex items-center gap-4">
                  <div className="flex border rounded-md">
                    <Button
                      type="button"
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className="rounded-r-none"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="rounded-l-none border-l"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      disabled={isSubmitting}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {isSubmitting ? "Uploading..." : "Upload CSV"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Profiles Display Area */}
              {isLoading ? (
                <Skeleton className="h-[200px] rounded-lg" />
              ) : (
                <div
                  className={cn(
                    "min-h-[200px] rounded-lg",
                    filteredProfiles.length === 0
                      ? "border-2 border-dashed"
                      : ""
                  )}
                >
                  {filteredProfiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-lg font-medium text-muted-foreground mb-2">
                        {editedProfiles.length === 0
                          ? "No staff yet"
                          : "No staff match your filters"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {editedProfiles.length === 0
                          ? "Upload a CSV file or add staff manually to get started"
                          : "Try adjusting your search or filters"}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4">
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {filteredProfiles.map((profile) => {
                            const isNewProfile =
                              "isNew" in profile && profile.isNew;
                            return (
                              <div
                                key={profile.id}
                                className={cn(
                                  "group relative border rounded-lg hover:shadow-md transition-all",
                                  isNewProfile &&
                                    "border-blue-300 bg-blue-50/50"
                                )}
                              >
                                {/* Role selector in top left */}
                                <div className="absolute top-2 left-2 z-10">
                                  <Select
                                    value={profile.role}
                                    onValueChange={(value) =>
                                      handleProfileRoleChange(
                                        profile.id,
                                        value as ProfileRole
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      className="text-xs bg-white/90 backdrop-blur-sm border-0 shadow-sm justify-center"
                                      size="sm"
                                    >
                                      <span className="text-sm">
                                        {getProfileRoleIcon(profile.role)}
                                      </span>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="instructional">
                                        👨‍🏫 Instructional
                                      </SelectItem>
                                      <SelectItem value="instructor">
                                        👨‍🏫 Instructor
                                      </SelectItem>
                                      <SelectItem value="ta">👨‍🎓 TA</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Action buttons in top right */}
                                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
                                    onClick={() => viewProfile(profile)}
                                  >
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive bg-white/90 backdrop-blur-sm"
                                    data-testid={`delete-profile-${profile.id}`}
                                    onClick={() =>
                                      stageProfileForDeletion(profile.id)
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>

                                {/* Profile area */}
                                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative">
                                  <div className="text-center">
                                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                      <span className="text-2xl">
                                        {getProfileRoleIcon(profile.role)}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium truncate px-2">
                                      {profile.firstName} {profile.lastName}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate px-2">
                                      {profile.alias}
                                    </p>
                                  </div>
                                  {isNewProfile && (
                                    <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded text-[10px]">
                                      NEW
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredProfiles.map((profile) => {
                            const isNewProfile =
                              "isNew" in profile && profile.isNew;
                            return (
                              <div
                                key={profile.id}
                                className={cn(
                                  "flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm transition-all",
                                  isNewProfile &&
                                    "border-blue-300 bg-blue-50/50"
                                )}
                              >
                                <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                                  <span className="text-xl">
                                    {getProfileRoleIcon(profile.role)}
                                  </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">
                                      {profile.firstName} {profile.lastName}
                                    </p>
                                    {isNewProfile && (
                                      <span className="bg-blue-500 text-white text-xs px-1 py-0.5 rounded">
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {profile.alias}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Select
                                    value={profile.role}
                                    onValueChange={(value) =>
                                      handleProfileRoleChange(
                                        profile.id,
                                        value as ProfileRole
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-40 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="instructional">
                                        👨‍🏫 Instructional
                                      </SelectItem>
                                      <SelectItem value="instructor">
                                        👨‍🏫 Instructor
                                      </SelectItem>
                                      <SelectItem value="ta">👨‍🎓 TA</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => viewProfile(profile)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    data-testid={`delete-profile-${profile.id}`}
                                    onClick={() =>
                                      stageProfileForDeletion(profile.id)
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
              )}
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
                The department also has {editedProfiles.length} staff member
                {editedProfiles.length !== 1 ? "s" : ""} associated with it.
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
