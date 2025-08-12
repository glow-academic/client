/**
 * StaffEdit.tsx
 * Used to display the edit for the staff page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

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
import { useProfile } from "@/contexts/profile-context";
import { ProfileRole } from "@/types";
import { logError } from "@/utils/logger";
import { deleteProfile } from "@/utils/mutations/profiles/delete-profile";
import { updateProfile } from "@/utils/mutations/profiles/update-profile";
import { getProfile } from "@/utils/queries/profiles/get-profile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
};

export interface StaffEditProps {
  profileId: string;
  hideDelete?: boolean;
  hideBack?: boolean;
  redirectOnSuccess?: boolean;
  onDone?: () => void;
}

// Internal business logic functions for better testability
const useStaffEditBusinessLogic = (
  profileId: string,
  redirectOnSuccess: boolean,
  onDone?: () => void
) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { effectiveProfile } = useProfile();

  // Fetch the specific target user profile directly
  const { data: targetUser, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getProfile(profileId),
    enabled: !!profileId,
  });

  const isCurrentUserAdmin = effectiveProfile?.role === "admin";
  const isLoading = isProfileLoading;

  const handleInputChange = useCallback((_field: string, _value: string) => {
    setHasChanges(true);
  }, []);

  const handleSubmit = useCallback(
    async (formData: FormData) => {
      setIsSubmitting(true);
      try {
        const parsedReqPerDay =
          formData.reqPerDay === "" || formData.reqPerDay === undefined
            ? null
            : Number(formData.reqPerDay);
        await updateProfile(profileId, {
          firstName: formData.firstName || "",
          lastName: formData.lastName || "",
          alias: formData.alias || "",
          role: formData.role as ProfileRole,
          reqPerDay: parsedReqPerDay,
        });
        setHasChanges(false);
        queryClient.invalidateQueries({ queryKey: ["profiles"] });
        queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
        toast.success("User updated successfully");
        if (redirectOnSuccess) {
          router.push("/management/staff");
        }
        if (onDone) {
          onDone();
        }
      } catch (error) {
        logError("Error updating user:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [profileId, queryClient, router, redirectOnSuccess, onDone]
  );

  const handleDelete = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await deleteProfile(profileId);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      toast.success("User deleted successfully");
      router.push("/management/staff");
    } catch (error) {
      logError("Error deleting user:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [profileId, queryClient, router]);

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
}: StaffEditProps) {
  const [formData, setFormData] = useState<FormData>({});
  const [unlimited, setUnlimited] = useState<boolean>(false);

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
      });
      setUnlimited(targetUser.reqPerDay == null);
    }
  }, [targetUser]);

  const handleFormSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await handleSubmit(formData);
    },
    [handleSubmit, formData]
  );

  const handleFormInputChange = useCallback(
    (field: keyof FormData, value: string | number | "") => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      handleInputChange(String(field), String(value));
    },
    [handleInputChange]
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
                          Number.isNaN(num) ? "" : num
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
