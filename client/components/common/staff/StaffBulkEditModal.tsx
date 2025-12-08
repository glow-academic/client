/**
 * StaffBulkEditModal.tsx
 * Modal for bulk editing multiple staff members with confirmation
 * @AshokSaravanan222
 */

"use client";

import type { ProfileListItem } from "@/app/(main)/management/staff/page";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { STAFF_ROLES } from "@/components/common/forms/staff-roles";
import { Check, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkUpdateStaffAction } from "@/components/staff/Staff";
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
import { CheckCircle2, Clock, Shield, User } from "lucide-react";
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
  validDepartmentIds?: string[];
  departmentMapping?: Record<string, { name: string; description: string }>;
}

export default function StaffBulkEditModal({
  profileIds,
  open,
  onOpenChange,
  onDone,
  bulkUpdateStaffAction,
  selectedStaffItems = [],
  validDepartmentIds = [],
  departmentMapping = {},
}: StaffBulkEditModalProps) {
  const router = useRouter();
  const { effectiveProfile, scopedRoles } = useProfile();

  const [bulkRole, setBulkRole] = useState<string>("__keep__");
  const [bulkReqPerDay, setBulkReqPerDay] = useState<string>("");
  const [keepCurrent, setKeepCurrent] = useState({
    role: true,
    reqPerDay: true,
    primaryDepartment: true,
  });
  const [bulkPrimaryDepartmentId, setBulkPrimaryDepartmentId] = useState<
    string | null
  >(null);
  const [requestsPerDayEnabled, setRequestsPerDayEnabled] = useState(false);
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

      setBulkPrimaryDepartmentId(null);
      setKeepCurrent({
        role: true,
        reqPerDay: true,
        primaryDepartment: true,
      });
    }
  }, [selectedStaffItems, open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setBulkRole("__keep__");
      setBulkReqPerDay("");
      setRequestsPerDayEnabled(false);
      setBulkPrimaryDepartmentId(null);
      setKeepCurrent({
        role: true,
        reqPerDay: true,
        primaryDepartment: true,
      });
    }
  }, [open]);

  const handleConfirm = useCallback(async () => {
    if (profileIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const updates: {
        profileIds: string[];
        role?: string;
        requests_per_day?: number | null | string;
        primary_department_id?: string;
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

      // Primary department - only update if not keeping current and value is set
      if (
        isSuperadmin &&
        !keepCurrent.primaryDepartment &&
        bulkPrimaryDepartmentId !== null &&
        bulkPrimaryDepartmentId !== ""
      ) {
        updates.primary_department_id = bulkPrimaryDepartmentId;
      }

      if (!bulkUpdateStaffAction) {
        toast.error("Update action not available");
        return;
      }
      await bulkUpdateStaffAction({ body: updates });
      router.refresh();
      toast.success("Staff updated successfully");
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
    bulkPrimaryDepartmentId,
    isSuperadmin,
    effectiveProfile?.id,
    bulkUpdateStaffAction,
    router,
    onOpenChange,
    onDone,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (profileIds.length === 0) return;
      await handleConfirm();
    },
    [profileIds, handleConfirm],
  );

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
                        <GenericPicker
                          items={STAFF_ROLES.filter((r) =>
                            (scopedRoles || []).includes(r.id)
                          )}
                          selectedIds={
                            bulkRole === "__keep__" || !bulkRole ? [] : [bulkRole]
                          }
                          onSelect={(ids) => {
                            setBulkRole(ids[0] || "");
                            setKeepCurrent((prev) => ({
                              ...prev,
                              role: false,
                            }));
                          }}
                          getId={(role) => role.id}
                          getLabel={(role) => role.name}
                          getSearchText={(role) => `${role.name} ${role.description || ""}`}
                          renderItem={(role, isSelected) => {
                            const IconComponent = role.icon || User;
                            const hexColor = role.color || "#64748b";
                            const generateGradient = (hex: string) => {
                              const cleanHex = hex.replace("#", "");
                              const r = parseInt(cleanHex.substr(0, 2), 16);
                              const g = parseInt(cleanHex.substr(2, 2), 16);
                              const b = parseInt(cleanHex.substr(4, 2), 16);
                              const lighterR = Math.min(255, r + 60);
                              const lighterG = Math.min(255, g + 60);
                              const lighterB = Math.min(255, b + 60);
                              const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                              return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                            };
                            return (
                              <div className="flex items-center gap-3 w-full">
                                <div
                                  className="p-2 rounded-lg shadow-lg flex-shrink-0"
                                  style={{
                                    background: generateGradient(hexColor),
                                  }}
                                >
                                  <IconComponent className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{role.name}</div>
                                  {role.description && (
                                    <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                      {role.description}
                                    </div>
                                  )}
                                </div>
                                <Check
                                  className={cn(
                                    "ml-auto",
                                    isSelected ? "opacity-100" : "opacity-0",
                                  )}
                                />
                              </div>
                            );
                          }}
                          renderButton={(selectedItems, placeholder) => {
                            if (selectedItems.length === 0) return placeholder;
                            const role = selectedItems[0];
                            const IconComponent = role?.icon || User;
                            const hexColor = role?.color || "#64748b";
                            const generateGradient = (hex: string) => {
                              const cleanHex = hex.replace("#", "");
                              const r = parseInt(cleanHex.substr(0, 2), 16);
                              const g = parseInt(cleanHex.substr(2, 2), 16);
                              const b = parseInt(cleanHex.substr(4, 2), 16);
                              const lighterR = Math.min(255, r + 60);
                              const lighterG = Math.min(255, g + 60);
                              const lighterB = Math.min(255, b + 60);
                              const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                              return `linear-gradient(135deg, ${lighterHex} 0%, ${hex} 100%)`;
                            };
                            return (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div
                                  className="p-1 rounded-md shadow-sm flex-shrink-0"
                                  style={{
                                    background: generateGradient(hexColor),
                                  }}
                                >
                                  <IconComponent className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="truncate">{role?.name || placeholder}</span>
                              </div>
                            );
                          }}
                          placeholder="Select role"
                          multiSelect={false}
                          hideSelectedChips={true}
                          disabled={isSubmitting || keepCurrent.role}
                          buttonClassName="h-10"
                          groupHeading="Staff Roles"
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

                  {/* Primary Department Row (superadmin only) */}
                  {isSuperadmin && (
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                          <Label htmlFor="bulkPrimaryDepartment">
                            Primary Department
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Set the primary department for selected staff members
                        </p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={keepCurrent.primaryDepartment}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setKeepCurrent((prev) => ({
                              ...prev,
                              primaryDepartment: isChecked,
                            }));
                          }}
                          disabled={isSubmitting}
                        />
                      </TableCell>
                      {validDepartmentIds.length > 1 && (
                        <TableCell>
                          <GenericPicker
                            items={departmentMapping}
                            itemIds={validDepartmentIds}
                            selectedIds={
                              bulkPrimaryDepartmentId
                                ? [bulkPrimaryDepartmentId]
                                : []
                            }
                            onSelect={(ids) => {
                              const deptId =
                                ids.length > 0 && ids[0] ? ids[0] : null;
                              setBulkPrimaryDepartmentId(deptId);
                              setKeepCurrent((prev) => ({
                                ...prev,
                                primaryDepartment: false,
                              }));
                            }}
                            getId={(dept) => (dept as unknown as { id: string }).id}
                            getLabel={(dept) => dept.name || ""}
                            getSearchText={(dept) => `${dept.name} ${dept.description || ""}`}
                            multiSelect={false}
                            placeholder="Select primary department"
                            hideSelectedChips={true}
                            disabled={
                              isSubmitting || keepCurrent.primaryDepartment
                            }
                            buttonClassName="h-10"
                          />
                          />
                        </TableCell>
                      )}
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
    </>
  );
}
