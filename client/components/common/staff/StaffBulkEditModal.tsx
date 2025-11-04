/**
 * StaffBulkEditModal.tsx
 * Modal for bulk editing multiple staff members with confirmation
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
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/contexts/profile-context";
import {
  useBulkUpdateProfile,
  useProfileDetailBulk,
} from "@/lib/api/v2/hooks/profile";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface StaffBulkEditModalProps {
  profileIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

export default function StaffBulkEditModal({
  profileIds,
  open,
  onOpenChange,
  onDone,
}: StaffBulkEditModalProps) {
  const { effectiveProfile } = useProfile();
  const bulkUpdateMutation = useBulkUpdateProfile();

  // Fetch bulk detail to get common values
  const { data: bulkDetail } = useProfileDetailBulk(
    profileIds,
    effectiveProfile?.id || "",
    open && profileIds.length > 0 && !!effectiveProfile?.id
  );

  const [bulkRole, setBulkRole] = useState<string>("__keep__");
  const [bulkReqPerDay, setBulkReqPerDay] = useState<string>("");
  const [bulkUnlimited, setBulkUnlimited] = useState<boolean>(false);
  const [bulkDefaultProfile, setBulkDefaultProfile] = useState<boolean | null>(
    null
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Initialize form values from bulkDetail when it loads (similar to documents)
  useEffect(() => {
    if (bulkDetail && open) {
      // Initialize role: use bulkDetail.role if all profiles have the same role, otherwise "__keep__"
      if (bulkDetail.role !== null) {
        setBulkRole(bulkDetail.role);
      } else {
        setBulkRole("__keep__");
      }

      // Initialize requests_per_day: use bulkDetail.requests_per_day if all have same value
      // null means mixed values, a number means all have the same limit
      if (
        bulkDetail.requests_per_day !== null &&
        bulkDetail.requests_per_day !== undefined
      ) {
        // All profiles have the same numeric limit
        setBulkUnlimited(false);
        setBulkReqPerDay(String(bulkDetail.requests_per_day));
      } else {
        // Mixed values or all unlimited - keep default empty/unlimited=false (which means "keep existing")
        setBulkUnlimited(false);
        setBulkReqPerDay("");
      }

      // Default profile would need to be checked if all have same value
      // For now, keep it as null (don't change) unless explicitly set
      setBulkDefaultProfile(null);
    }
  }, [bulkDetail, open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setBulkRole("__keep__");
      setBulkReqPerDay("");
      setBulkUnlimited(false);
      setBulkDefaultProfile(null);
      setShowConfirmDialog(false);
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (profileIds.length === 0) return;
      setShowConfirmDialog(true);
    },
    [profileIds]
  );

  const handleConfirm = useCallback(async () => {
    if (profileIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const updates: {
        profileIds: string[];
        role?: string;
        requests_per_day?: number | null | string;
        default_profile?: boolean;
        currentProfileId: string;
      } = {
        profileIds: profileIds,
        currentProfileId: effectiveProfile?.id || "",
      };

      if (bulkRole !== "__keep__") {
        updates.role = bulkRole;
      }

      if (bulkUnlimited) {
        updates.requests_per_day = null; // Unlimited
      } else if (bulkReqPerDay !== "") {
        const num = Number(bulkReqPerDay);
        updates.requests_per_day = Number.isNaN(num) ? "__keep__" : num;
      } else {
        updates.requests_per_day = "__keep__"; // Don't update
      }

      if (isSuperadmin && bulkDefaultProfile !== null) {
        updates.default_profile = bulkDefaultProfile;
      }

      await bulkUpdateMutation.mutateAsync(updates);
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
    profileIds,
    bulkRole,
    bulkReqPerDay,
    bulkUnlimited,
    bulkDefaultProfile,
    isSuperadmin,
    effectiveProfile?.id,
    bulkUpdateMutation,
    onOpenChange,
    onDone,
  ]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Edit Staff</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Editing {profileIds.length} staff member
              {profileIds.length !== 1 ? "s" : ""}
            </div>

            {/* Role picker with __keep__ option */}
            <div className="space-y-2">
              <Label htmlFor="bulkRole">Role</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={bulkRole === "__keep__" ? "default" : "outline"}
                  onClick={() => setBulkRole("__keep__")}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Keep Current
                </Button>
                <div className="flex-1">
                  <StaffRolePicker
                    selectedRole={bulkRole === "__keep__" ? "" : bulkRole}
                    onSelect={(value) => {
                      // When a role is selected, switch from __keep__ to that role
                      setBulkRole(value);
                    }}
                    placeholder="Select role"
                    disabled={isSubmitting}
                    buttonClassName="h-10"
                  />
                </div>
              </div>
            </div>

            {/* Requests per day with unlimited switch */}
            <div className="space-y-2">
              <Label htmlFor="bulkReqPerDay">Requests per day</Label>
              <Input
                id="bulkReqPerDay"
                type="number"
                value={bulkReqPerDay}
                onChange={(e) => setBulkReqPerDay(e.target.value)}
                placeholder="e.g. 100"
                min={1}
                step={1}
                disabled={isSubmitting || bulkUnlimited}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulkUnlimited"
                  checked={bulkUnlimited}
                  onCheckedChange={(checked) => {
                    const isChecked = Boolean(checked);
                    setBulkUnlimited(isChecked);
                    if (isChecked) {
                      setBulkReqPerDay("");
                    }
                  }}
                  disabled={isSubmitting}
                />
                <Label htmlFor="bulkUnlimited" className="mb-0">
                  Unlimited
                </Label>
              </div>
            </div>

            {/* Default profile switch (superadmin only) */}
            {isSuperadmin && (
              <div className="flex items-center gap-2">
                <Switch
                  id="bulkDefaultProfile"
                  checked={bulkDefaultProfile ?? false}
                  onCheckedChange={(checked) => setBulkDefaultProfile(checked)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="bulkDefaultProfile">Default Profile</Label>
              </div>
            )}

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
              You are about to update {profileIds.length} staff member
              {profileIds.length !== 1 ? "s" : ""}. This action will modify
              their profile information.
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
