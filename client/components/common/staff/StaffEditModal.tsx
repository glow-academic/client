/**
 * StaffEditModal.tsx
 * Modal for editing a single staff member with confirmation
 * @AshokSaravanan222
 */

"use client";

import type { ProfileListItem } from "@/app/(main)/management/staff/page";
import { StaffRolePicker } from "@/components/common/forms/StaffRolePicker";
import type { UpdateStaffAction } from "@/components/staff/Staff";
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
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/contexts/profile-context";
import { Clock, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export interface StaffEditModalProps {
  profileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  updateStaffAction?: UpdateStaffAction;
  staffItem?: ProfileListItem | null;
  validDepartmentIds?: string[];
  isLoading?: boolean;
}

export default function StaffEditModal({
  profileId,
  open,
  onOpenChange,
  onDone,
  updateStaffAction,
  staffItem,
  validDepartmentIds = [],
  isLoading = false,
}: StaffEditModalProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();

  // Extract data from ProfileListItem
  const targetUser = useMemo(() => {
    if (!staffItem) return null;
    return {
      firstName: staffItem.first_name || "",
      lastName: staffItem.last_name || "",
      alias: staffItem.alias || "",
      role: staffItem.role || "",
      reqPerDay: staffItem.requests_per_day ?? null,
      defaultProfile: staffItem.default_profile ?? false,
      departmentId: staffItem.department_id || "",
      active: staffItem.active ?? true,
    };
  }, [staffItem]);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    alias: "",
    role: "",
    reqPerDay: "" as number | "",
    defaultProfile: false,
  });
  const [requestsPerDayEnabled, setRequestsPerDayEnabled] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Initialize form data when user is loaded
  useEffect(() => {
    if (targetUser && open) {
      setFormData({
        firstName: targetUser.firstName || "",
        lastName: targetUser.lastName || "",
        alias: targetUser.alias || "",
        role: targetUser.role || "",
        reqPerDay: targetUser.reqPerDay ?? "",
        defaultProfile: targetUser.defaultProfile ?? false,
      });
      setRequestsPerDayEnabled(targetUser.reqPerDay != null);
    }
  }, [targetUser, open]);

  const handleInputChange = useCallback(
    (field: string, value: string | number | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profileId) return;
      setShowConfirmDialog(true);
    },
    [profileId]
  );

  const handleConfirm = useCallback(async () => {
    if (!profileId) return;

    setIsSubmitting(true);
    try {
      const parsedReqPerDay =
        !requestsPerDayEnabled ||
        formData.reqPerDay === "" ||
        formData.reqPerDay === undefined
          ? null // Unlimited
          : Number(formData.reqPerDay);

      // V3 update endpoint requires department_id and active
      // Get department_id from staffItem or use first valid department
      const departmentId =
        targetUser?.departmentId ||
        (validDepartmentIds && validDepartmentIds.length > 0
          ? validDepartmentIds[0]
          : "") ||
        "";

      if (!updateStaffAction) {
        toast.error("Update action not available");
        return;
      }

      // Build update payload
      // Note: default_profile is not supported by single update API, only bulk update
      const updateBody = {
        profileId: profileId,
        role: formData.role,
        requests_per_day: parsedReqPerDay,
        department_id: departmentId,
        active: targetUser?.active ?? true,
      };

      await updateStaffAction({
        body: updateBody,
      });
      router.refresh();

      toast.success("Staff updated successfully");
      setShowConfirmDialog(false);
      onOpenChange(false);
      if (onDone) {
        onDone();
      }
    } catch {
      toast.error("Failed to update staff");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    profileId,
    formData,
    requestsPerDayEnabled,
    targetUser?.active,
    targetUser?.departmentId,
    validDepartmentIds,
    updateStaffAction,
    router,
    onOpenChange,
    onDone,
  ]);

  if (!profileId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-staff">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Read-only fields: Name and Alias */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                {!isLoading ? (
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    placeholder="Jane"
                    disabled={true}
                    className="bg-muted"
                    data-testid="input-staff-first-name"
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                {!isLoading ? (
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    placeholder="Smith"
                    disabled={true}
                    className="bg-muted"
                    data-testid="input-staff-last-name"
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="alias">Alias</Label>
                {!isLoading ? (
                  <Input
                    id="alias"
                    value={formData.alias}
                    placeholder="jsmith"
                    disabled={true}
                    className="bg-muted"
                    data-testid="input-staff-alias"
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            </div>

            {/* Editable fields - simple vertical layout */}
            {!isLoading ? (
              <div className="space-y-6">
                {/* Role Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label htmlFor="role">Role</Label>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Set the role for this staff member
                  </p>
                  <div data-testid="input-staff-role">
                    <StaffRolePicker
                      selectedRole={formData.role}
                      onSelect={(value) => handleInputChange("role", value)}
                      placeholder="Select role"
                      disabled={isSubmitting}
                      buttonClassName="h-10"
                    />
                  </div>
                </div>

                {/* Requests Per Day Section */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label htmlFor="reqPerDay">Requests per day</Label>
                  </div>
                  <p className="text-xs text-muted-foreground pl-5">
                    Set a daily request limit for this staff member
                  </p>
                  <div className="space-y-2 pl-5">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="requestsPerDayEnabled"
                        checked={requestsPerDayEnabled}
                        onCheckedChange={(checked) => {
                          setRequestsPerDayEnabled(checked);
                          if (!checked) {
                            handleInputChange("reqPerDay", "");
                          }
                        }}
                        disabled={isSubmitting}
                      />
                      <Label htmlFor="requestsPerDayEnabled" className="mb-0">
                        Enable limit
                      </Label>
                    </div>
                    {requestsPerDayEnabled && (
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
                            handleInputChange("reqPerDay", "");
                          } else {
                            const num = parseInt(val, 10);
                            handleInputChange(
                              "reqPerDay",
                              Number.isNaN(num) ? "" : num
                            );
                          }
                        }}
                        placeholder="e.g. 100"
                        min={1}
                        step={1}
                        disabled={isSubmitting}
                        data-testid="input-staff-requests-per-day"
                      />
                    )}
                  </div>
                </div>

                {/* Default Profile Section (superadmin only) - Read-only display */}
                {isSuperadmin && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label htmlFor="defaultProfile">Default Profile</Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Mark this profile as the default profile for the user (use
                      bulk edit to change)
                    </p>
                    <div className="flex items-center gap-2 pl-5">
                      <Switch
                        id="defaultProfile"
                        checked={formData.defaultProfile}
                        disabled={true}
                        className="opacity-50"
                      />
                      <span className="text-xs text-muted-foreground">
                        {formData.defaultProfile ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="btn-cancel-staff-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="btn-submit-staff-edit"
              >
                {isSubmitting ? "Updating..." : "Update Staff"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent data-testid="dialog-confirm-staff-edit">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to update {formData.firstName} {formData.lastName} (
              {formData.alias}). This action will modify their profile
              information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Confirm Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
