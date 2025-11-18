/**
 * StaffBulkEditModal.tsx
 * Modal for bulk editing multiple staff members with confirmation
 * @AshokSaravanan222
 */

"use client";

import type { ProfileListItem } from "@/app/(main)/management/staff/page";
import { StaffRolePicker } from "@/components/common/forms/StaffRolePicker";
import type { BulkUpdateStaffAction } from "@/components/staff/Staff";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/contexts/profile-context";
import { Clock, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface StaffBulkEditModalProps {
  profileIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  bulkUpdateStaffAction?: BulkUpdateStaffAction;
  selectedStaffItems?: ProfileListItem[];
}

export default function StaffBulkEditModal({
  profileIds,
  open,
  onOpenChange,
  onDone,
  bulkUpdateStaffAction,
  selectedStaffItems = [],
}: StaffBulkEditModalProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();

  const [bulkRole, setBulkRole] = useState<string>("__keep__");
  const [bulkReqPerDay, setBulkReqPerDay] = useState<string>("");
  const [keepCurrent, setKeepCurrent] = useState({
    role: true,
    reqPerDay: true,
    defaultProfile: true,
  });
  const [requestsPerDayEnabled, setRequestsPerDayEnabled] = useState(false);
  const [bulkDefaultProfile, setBulkDefaultProfile] = useState<boolean | null>(
    null
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Compute bulk values from selected staff items
  useEffect(() => {
    if (selectedStaffItems.length > 0 && open) {
      // Check if all profiles have the same role
      const roles = new Set(selectedStaffItems.map((s) => s.role));
      if (roles.size === 1) {
        setBulkRole(Array.from(roles)[0] || "__keep__");
      } else {
        setBulkRole("__keep__");
      }

      // Check if all profiles have the same requests_per_day
      const reqPerDays = selectedStaffItems
        .map((s) => s.requests_per_day)
        .filter((r) => r !== null && r !== undefined);
      if (reqPerDays.length === selectedStaffItems.length) {
        const uniqueReqPerDays = new Set(reqPerDays);
        if (uniqueReqPerDays.size === 1) {
          const value = Array.from(uniqueReqPerDays)[0];
          setRequestsPerDayEnabled(true);
          setBulkReqPerDay(String(value));
        } else {
          // Mixed values
          setRequestsPerDayEnabled(false);
          setBulkReqPerDay("");
        }
      } else {
        // Some are null/unlimited - mixed values
        setRequestsPerDayEnabled(false);
        setBulkReqPerDay("");
      }

      // Default profile - keep as null (don't change) unless explicitly set
      setBulkDefaultProfile(null);
      setKeepCurrent({
        role: true,
        reqPerDay: true,
        defaultProfile: true,
      });
    }
  }, [selectedStaffItems, open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setBulkRole("__keep__");
      setBulkReqPerDay("");
      setRequestsPerDayEnabled(false);
      setBulkDefaultProfile(null);
      setKeepCurrent({
        role: true,
        reqPerDay: true,
        defaultProfile: true,
      });
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

      if (!keepCurrent.role && bulkRole !== "__keep__") {
        updates.role = bulkRole;
      }

      if (!keepCurrent.reqPerDay) {
        if (!requestsPerDayEnabled || bulkReqPerDay === "") {
          updates.requests_per_day = null; // Unlimited
        } else {
          const num = Number(bulkReqPerDay);
          updates.requests_per_day = Number.isNaN(num) ? "__keep__" : num;
        }
      } else {
        updates.requests_per_day = "__keep__"; // Don't update
      }

      if (
        isSuperadmin &&
        !keepCurrent.defaultProfile &&
        bulkDefaultProfile !== null
      ) {
        updates.default_profile = bulkDefaultProfile;
      }

      if (!bulkUpdateStaffAction) {
        toast.error("Update action not available");
        return;
      }
      await bulkUpdateStaffAction({ body: updates });
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
    profileIds,
    bulkRole,
    bulkReqPerDay,
    requestsPerDayEnabled,
    keepCurrent,
    bulkDefaultProfile,
    isSuperadmin,
    effectiveProfile?.id,
    bulkUpdateStaffAction,
    router,
    onOpenChange,
    onDone,
  ]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl"
          data-testid="dialog-bulk-edit-staff"
        >
          <DialogHeader>
            <DialogTitle>Bulk Edit Staff</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Editing {profileIds.length} staff member
              {profileIds.length !== 1 ? "s" : ""}
            </div>

            {/* Table layout for editable fields */}
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Field</TableHead>
                    <TableHead className="w-[120px] text-center">
                      Keep Current
                    </TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Role Row */}
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="bulkRole">Role</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Set the role for selected staff members
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={keepCurrent.role}
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setKeepCurrent((prev) => ({
                            ...prev,
                            role: isChecked,
                          }));
                          if (isChecked) {
                            setBulkRole("__keep__");
                          }
                        }}
                        disabled={isSubmitting}
                      />
                    </TableCell>
                    <TableCell>
                      <div data-testid="input-bulk-staff-role">
                        <StaffRolePicker
                          selectedRole={bulkRole === "__keep__" ? "" : bulkRole}
                          onSelect={(value) => {
                            setBulkRole(value);
                            setKeepCurrent((prev) => ({
                              ...prev,
                              role: false,
                            }));
                          }}
                          placeholder="Select role"
                          disabled={isSubmitting || keepCurrent.role}
                          buttonClassName="h-10"
                        />
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Requests Per Day Row */}
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <Label htmlFor="bulkReqPerDay">Requests per day</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Set a daily request limit for selected staff members
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={keepCurrent.reqPerDay}
                        onCheckedChange={(checked) => {
                          const isChecked = checked === true;
                          setKeepCurrent((prev) => ({
                            ...prev,
                            reqPerDay: isChecked,
                          }));
                        }}
                        disabled={isSubmitting}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="bulkRequestsPerDayEnabled"
                            checked={requestsPerDayEnabled}
                            onCheckedChange={(checked) => {
                              setRequestsPerDayEnabled(checked);
                              setKeepCurrent((prev) => ({
                                ...prev,
                                reqPerDay: false,
                              }));
                              if (!checked) {
                                setBulkReqPerDay("");
                              }
                            }}
                            disabled={isSubmitting || keepCurrent.reqPerDay}
                          />
                          <Label
                            htmlFor="bulkRequestsPerDayEnabled"
                            className="mb-0"
                          >
                            Enable limit
                          </Label>
                        </div>
                        {requestsPerDayEnabled && (
                          <Input
                            id="bulkReqPerDay"
                            type="number"
                            value={bulkReqPerDay}
                            onChange={(e) => {
                              setBulkReqPerDay(e.target.value);
                              setKeepCurrent((prev) => ({
                                ...prev,
                                reqPerDay: false,
                              }));
                            }}
                            placeholder="e.g. 100"
                            min={1}
                            step={1}
                            disabled={isSubmitting || keepCurrent.reqPerDay}
                            data-testid="input-bulk-staff-requests-per-day"
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Default Profile Row (superadmin only) */}
                  {isSuperadmin && (
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label htmlFor="bulkDefaultProfile">
                            Default Profile
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Mark selected profiles as default profiles for their
                          users
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={keepCurrent.defaultProfile}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setKeepCurrent((prev) => ({
                              ...prev,
                              defaultProfile: isChecked,
                            }));
                          }}
                          disabled={isSubmitting}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          id="bulkDefaultProfile"
                          checked={bulkDefaultProfile ?? false}
                          onCheckedChange={(checked) => {
                            setBulkDefaultProfile(checked);
                            setKeepCurrent((prev) => ({
                              ...prev,
                              defaultProfile: false,
                            }));
                          }}
                          disabled={isSubmitting || keepCurrent.defaultProfile}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                data-testid="btn-cancel-bulk-staff-edit"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="btn-submit-bulk-staff-edit"
              >
                {isSubmitting ? "Updating..." : "Update Staff"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent data-testid="dialog-confirm-bulk-staff-edit">
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
