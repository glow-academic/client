/**
 * StaffEditModal.tsx
 * Modal for editing a single staff member with confirmation
 * @AshokSaravanan222
 */

"use client";

import type { ProfileListItem } from "@/app/(main)/system/staff/page";
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
import { CheckCircle2, Clock, User } from "lucide-react";
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
      introCompleted: staffItem.intro_completed ?? false,
      chatCompleted: staffItem.chat_completed ?? false,
      departmentId: staffItem.primary_department_id || "",
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
    introCompleted: false,
    chatCompleted: false,
  });
  const [requestsPerDayEnabled, setRequestsPerDayEnabled] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tourCompletedTouched, setTourCompletedTouched] = useState(false);

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
        introCompleted: targetUser.introCompleted ?? false,
        chatCompleted: targetUser.chatCompleted ?? false,
      });
      setRequestsPerDayEnabled(targetUser.reqPerDay != null);
      setTourCompletedTouched(false);
    }
  }, [targetUser, open]);

  // Compute tour_completed from intro_completed && chat_completed
  const tourCompleted = useMemo(() => {
    return formData.introCompleted && formData.chatCompleted;
  }, [formData.introCompleted, formData.chatCompleted]);

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

      // V3 update endpoint requires primary_department_id and active
      // Get primary_department_id from staffItem or use first valid department
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
      // Only send intro_completed and chat_completed if tour_completed was explicitly changed
      const updateBody: {
        profileId: string;
        first_name: string;
        last_name: string;
        alias: string;
        role: string;
        requests_per_day: number | null;
        primary_department_id: string;
        active: boolean;
        default_profile: boolean;
        intro_completed?: boolean;
        chat_completed?: boolean;
      } = {
        profileId: profileId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        alias: formData.alias,
        role: formData.role,
        requests_per_day: parsedReqPerDay,
        primary_department_id: departmentId,
        active: targetUser?.active ?? true,
        default_profile: formData.defaultProfile,
      };

      // Only include intro_completed and chat_completed if tour_completed was touched
      if (tourCompletedTouched) {
        updateBody.intro_completed = formData.introCompleted;
        updateBody.chat_completed = formData.chatCompleted;
      }

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
    tourCompletedTouched,
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
            {/* Editable fields: Name and Alias */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                {!isLoading ? (
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      handleInputChange("firstName", e.target.value)
                    }
                    placeholder="Jane"
                    disabled={isSubmitting}
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
                    onChange={(e) =>
                      handleInputChange("lastName", e.target.value)
                    }
                    placeholder="Smith"
                    disabled={isSubmitting}
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
                    onChange={(e) => handleInputChange("alias", e.target.value)}
                    placeholder="jsmith"
                    disabled={isSubmitting}
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
                  <Label htmlFor="role">Role</Label>
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
                <div className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="requestsPerDayEnabled"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        Requests per day
                      </Label>
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
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Set a daily request limit for this staff member
                    </p>
                    {requestsPerDayEnabled && (
                      <div className="space-y-2 pt-2">
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
                      </div>
                    )}
                  </div>
                </div>

                {/* Default Profile Section (superadmin only) */}
                {isSuperadmin && (
                  <div className="space-y-2 pt-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="defaultProfile"
                          className="text-sm flex items-center gap-1.5"
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          Default Profile
                        </Label>
                        <Switch
                          id="defaultProfile"
                          checked={formData.defaultProfile}
                          onCheckedChange={(checked) =>
                            handleInputChange("defaultProfile", checked)
                          }
                          disabled={isSubmitting}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground pl-5">
                        Mark this profile as the default profile for the user
                      </p>
                    </div>
                  </div>
                )}

                {/* Tour Completion Section */}
                <div className="space-y-2 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="tourCompleted"
                        className="text-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                        Tour Completed
                      </Label>
                      <Switch
                        id="tourCompleted"
                        checked={tourCompleted}
                        onCheckedChange={(checked) => {
                          setTourCompletedTouched(true);
                          // When toggled, update both intro_completed and chat_completed
                          handleInputChange("introCompleted", checked);
                          handleInputChange("chatCompleted", checked);
                        }}
                        disabled={isSubmitting}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground pl-5">
                      Mark both intro and chat tours as completed
                    </p>
                  </div>
                </div>
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
