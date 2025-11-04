/**
 * StaffEditModal.tsx
 * Modal for editing a single staff member with confirmation
 * @AshokSaravanan222
 */

"use client";

import { StaffRolePicker } from "@/components/common/forms/StaffRolePicker";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  useProfileSimple,
  useUpdateProfileSimple,
} from "@/lib/api/v2/hooks/profile";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface StaffEditModalProps {
  profileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export default function StaffEditModal({
  profileId,
  open,
  onOpenChange,
  onDone,
}: StaffEditModalProps) {
  const { effectiveProfile } = useProfile();
  const updateProfileMutation = useUpdateProfileSimple();

  const { data: profileData, isLoading } = useProfileSimple(
    profileId || "",
    !!profileId
  );
  const targetUser = profileData?.profile;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    alias: "",
    role: "",
    reqPerDay: "" as number | "",
    defaultProfile: false,
  });
  const [unlimited, setUnlimited] = useState(false);
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
      setUnlimited(targetUser.reqPerDay == null);
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
        unlimited ||
        formData.reqPerDay === "" ||
        formData.reqPerDay === undefined
          ? null
          : Number(formData.reqPerDay);

      await updateProfileMutation.mutateAsync({
        profileId: profileId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        // Note: alias is not editable via this endpoint - managed separately
        role: formData.role,
        reqPerDay: parsedReqPerDay,
        // Note: defaultProfile update may need to be handled via separate endpoint
        // For now, only include if the schema supports it
      });

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
    unlimited,
    updateProfileMutation,
    onOpenChange,
    onDone,
  ]);

  if (!profileId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fields in a row: firstName, lastName, alias, role */}
            <div className="grid grid-cols-4 gap-4">
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
                    required
                    disabled={isSubmitting}
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
                    required
                    disabled={isSubmitting}
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
                    title="Alias cannot be edited via this form"
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                {!isLoading ? (
                  <StaffRolePicker
                    selectedRole={formData.role}
                    onSelect={(value) => handleInputChange("role", value)}
                    placeholder="Select role"
                    disabled={isSubmitting}
                    buttonClassName="h-10"
                  />
                ) : (
                  <Skeleton className="h-10 w-full" />
                )}
              </div>
            </div>

            {/* Additional fields below: default_profile switch, requests_per_day with unlimited */}
            <div className="space-y-4">
              {/* Requests per day with unlimited switch */}
              <div className="space-y-2">
                <Label htmlFor="reqPerDay">Requests per day</Label>
                {!isLoading ? (
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
                            handleInputChange("reqPerDay", "");
                          }
                        }}
                        disabled={isSubmitting}
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

              {/* Default profile switch (superadmin only) */}
              {isSuperadmin && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="defaultProfile"
                    checked={formData.defaultProfile}
                    onCheckedChange={(checked) =>
                      handleInputChange("defaultProfile", checked)
                    }
                    disabled={isSubmitting}
                  />
                  <Label htmlFor="defaultProfile">Default Profile</Label>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Updating..." : "Update Staff"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
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
