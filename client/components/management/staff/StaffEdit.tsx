/**
 * StaffEdit.tsx
 * Used to display the edit for the staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { DepartmentSelector } from "@/components/common/forms/DepartmentSelector";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useProfile as useEffectiveProfile } from "@/contexts/profile-context";
import { useDepartments as useDepartmentsHook } from "@/lib/api/hooks/departments";
import {
  useDeleteProfile,
  useProfile,
  useUpdateProfile,
} from "@/lib/api/hooks/profiles";
import { ProfileRole } from "@/types";
import { log } from "@/utils/logger";
import { ArrowLeft, Shield, Trash2, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type FormData = {
  firstName?: string;
  lastName?: string;
  alias?: string;
  role?: string;
  reqPerDay?: number | "";
  departmentId?: string;
};

export interface StaffEditProps {
  profileId: string;
  hideDelete?: boolean;
  hideBack?: boolean;
  redirectOnSuccess?: boolean;
  onDone?: () => void;
  canToggleDefault?: boolean;
}

// Internal business logic functions for better testability
const useStaffEditBusinessLogic = (
  profileId: string,
  redirectOnSuccess: boolean,
  onDone?: () => void,
) => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { effectiveProfile } = useEffectiveProfile();

  // Mutation hooks
  const updateProfileMutation = useUpdateProfile();
  const deleteProfileMutation = useDeleteProfile();

  const { data: targetUser, isLoading: isProfileLoading } =
    useProfile(profileId);

  const isCurrentUserAdmin =
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";
  const isLoading = isProfileLoading;

  const handleInputChange = useCallback((_field: string, _value: string) => {
    setHasChanges(true);
  }, []);

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      // Department validation for superadmin
      if (effectiveProfile?.role === "superadmin" && !formData.departmentId) {
        toast.error("Department selection is required for superadmin users");
        return;
      }

      setIsSubmitting(true);
      try {
        const parsedReqPerDay =
          formData.reqPerDay === "" || formData.reqPerDay === undefined
            ? null
            : Number(formData.reqPerDay);
        await updateProfileMutation.mutateAsync({
          id: profileId,
          firstName: formData.firstName || "",
          lastName: formData.lastName || "",
          alias: formData.alias || "",
          role: formData.role as ProfileRole,
          reqPerDay: parsedReqPerDay,
          departmentId: formData.departmentId || "",
        });
        setHasChanges(false);
        toast.success("User updated successfully");
        if (redirectOnSuccess) {
          router.push("/management/staff");
        }
        if (onDone) {
          onDone();
        }
      } catch (error) {
        log.error("staff.update.failed", {
          message: "Error updating user",
          error,
          context: {
            component: "StaffEdit",
            function: "handleSubmit",
            profileId,
          },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      profileId,
      router,
      redirectOnSuccess,
      onDone,
      updateProfileMutation,
      effectiveProfile?.role,
    ],
  );

  const handleDelete = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await deleteProfileMutation.mutateAsync(profileId);
      toast.success("User deleted successfully");
      router.push("/management/staff");
    } catch (error) {
      log.error("staff.delete.failed", {
        message: "Error deleting user",
        error,
        context: {
          component: "StaffEdit",
          function: "handleDelete",
          profileId,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [profileId, router, deleteProfileMutation]);

  const handleBackNavigation = useCallback(() => {
    router.push("/management/staff");
  }, [router]);

  return {
    targetUser,
    isLoading,
    isSubmitting,
    hasChanges,
    isCurrentUserAdmin,
    effectiveProfile,
    handleInputChange,
    handleSubmit,
    handleDelete,
    handleBackNavigation,
  };
};

export default function StaffEdit({
  profileId,
  hideDelete = false,
  hideBack = false,
  redirectOnSuccess = true,
  onDone,
  canToggleDefault = false,
}: StaffEditProps) {
  const [formData, setFormData] = useState<FormData>({});
  const [toggleDefault, setToggleDefault] = useState<boolean | null>(null);
  const [unlimited, setUnlimited] = useState<boolean>(false);
  const { data: departments = [] } = useDepartmentsHook();

  const {
    targetUser,
    isLoading,
    isSubmitting,
    hasChanges,
    isCurrentUserAdmin,
    effectiveProfile,
    handleInputChange,
    handleSubmit,
    handleDelete,
    handleBackNavigation,
  } = useStaffEditBusinessLogic(profileId, redirectOnSuccess, onDone);

  // Initialize form data when user is loaded
  useEffect(() => {
    if (targetUser) {
      setFormData({
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        alias: targetUser.alias,
        role: targetUser.role,
        reqPerDay: targetUser.reqPerDay ?? "",
        departmentId: targetUser.departmentId || "",
      });
      setUnlimited(targetUser.reqPerDay == null);
      setToggleDefault(targetUser.defaultProfile ?? null);
    }
  }, [targetUser]);

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      // If canToggleDefault and target not default guest, pass default flag
      const payload: FormData & { defaultProfile?: boolean } = { ...formData };
      if (
        canToggleDefault &&
        targetUser &&
        !(targetUser.role === "guest" && targetUser.defaultProfile)
      ) {
        if (toggleDefault !== null) payload.defaultProfile = toggleDefault;
      }
      await handleSubmit(payload);
    },
    [handleSubmit, formData, canToggleDefault, toggleDefault, targetUser],
  );

  const handleFormInputChange = useCallback(
    (field: keyof FormData, value: string | number | "") => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      handleInputChange(String(field), String(value));
    },
    [handleInputChange],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Single column with all fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              {formData?.firstName !== undefined && !isLoading ? (
                <Input
                  id="firstName"
                  value={formData.firstName || ""}
                  onChange={(e) =>
                    handleFormInputChange("firstName", e.target.value)
                  }
                  placeholder="Jane"
                  required
                  disabled={isSubmitting}
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              {formData?.lastName !== undefined && !isLoading ? (
                <Input
                  id="lastName"
                  value={formData.lastName || ""}
                  onChange={(e) =>
                    handleFormInputChange("lastName", e.target.value)
                  }
                  placeholder="Smith"
                  required
                  disabled={isSubmitting}
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="alias">Username/Alias</Label>
              {formData?.alias !== undefined && !isLoading ? (
                <Input
                  id="alias"
                  value={formData.alias || ""}
                  onChange={(e) =>
                    handleFormInputChange("alias", e.target.value)
                  }
                  placeholder="jsmith"
                  required
                  disabled={isSubmitting}
                />
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              {formData?.role !== undefined && !isLoading ? (
                <Select
                  value={formData.role || ""}
                  onValueChange={(value: ProfileRole) =>
                    handleFormInputChange("role", value)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {effectiveProfile?.role === "superadmin" && (
                      <SelectItem value="superadmin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-600" />
                          Super Administrator
                        </div>
                      </SelectItem>
                    )}
                    {isCurrentUserAdmin && (
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-600" />
                          Administrator
                        </div>
                      </SelectItem>
                    )}
                    <SelectItem value="instructional">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Instructional Staff
                      </div>
                    </SelectItem>
                    <SelectItem value="ta">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        Teaching Assistant
                      </div>
                    </SelectItem>
                    {/* Allow selecting Guest role */}
                    <SelectItem value="guest">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        Guest
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reqPerDay">Requests per day</Label>
              {formData?.reqPerDay !== undefined && !isLoading ? (
                <div className="space-y-2">
                  <Input
                    id="reqPerDay"
                    type="number"
                    value={
                      formData.reqPerDay === ""
                        ? ""
                        : String(formData.reqPerDay)
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        handleFormInputChange("reqPerDay", "");
                      } else {
                        const num = parseInt(val, 10);
                        handleFormInputChange(
                          "reqPerDay",
                          Number.isNaN(num) ? "" : num,
                        );
                      }
                    }}
                    placeholder="e.g. 100"
                    min={1}
                    step={1}
                    disabled={isSubmitting || unlimited}
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="unlimited"
                      checked={unlimited}
                      onCheckedChange={(checked) => {
                        const isChecked = Boolean(checked);
                        setUnlimited(isChecked);
                        if (isChecked) {
                          handleFormInputChange("reqPerDay", "");
                        }
                      }}
                    />
                    <Label htmlFor="unlimited" className="mb-0">
                      Unlimited
                    </Label>
                  </div>
                </div>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
            </div>

            {/* Department Selection - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentId !== undefined && !isLoading ? (
                  <DepartmentSelector
                    departments={departments.map((dept) => ({
                      id: dept.id,
                      title: dept.title as string,
                      ...(dept.description && {
                        description: dept.description,
                      }),
                    }))}
                    selectedDepartment={
                      formData?.departmentId
                        ? (() => {
                            const dept = departments.find(
                              (d) => d.id === formData.departmentId,
                            );
                            return dept
                              ? {
                                  id: dept.id,
                                  title: dept.title as string,
                                  ...(dept.description && {
                                    description: dept.description,
                                  }),
                                }
                              : null;
                          })()
                        : null
                    }
                    onSelect={(department) =>
                      handleFormInputChange(
                        "departmentId",
                        department?.id || "",
                      )
                    }
                    placeholder="Select department"
                    disabled={isSubmitting}
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            )}
            {!hideDelete && (
              <div className="space-y-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSubmitting}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete User
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Are you absolutely sure?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the user account for{" "}
                        {formData.firstName + " " + formData.lastName} (
                        {formData.alias}@
                        {process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
                        ). This action cannot be undone and will remove all
                        associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isSubmitting}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isSubmitting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isSubmitting ? "Deleting..." : "Delete User"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Action buttons row */}
          <div className="flex justify-end gap-2">
            {canToggleDefault &&
              targetUser &&
              !(targetUser.role === "guest" && targetUser.defaultProfile) && (
                <div className="mr-auto flex items-center gap-2">
                  <Label htmlFor="defaultProfile">Default Profile</Label>
                  <Checkbox
                    id="defaultProfile"
                    checked={Boolean(toggleDefault)}
                    onCheckedChange={(checked) =>
                      setToggleDefault(Boolean(checked))
                    }
                  />
                </div>
              )}
            {!hideBack && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBackNavigation}
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting || !hasChanges}>
              {isSubmitting ? "Updating..." : "Update User"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
