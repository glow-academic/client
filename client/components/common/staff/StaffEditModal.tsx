/**
 * StaffEditModal.tsx
 * Modal for editing a single staff member with confirmation
 * @AshokSaravanan222
 */

"use client";

import type { ProfileListItem } from "@/app/(main)/management/staff/page";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { StaffRolePicker } from "@/components/common/forms/StaffRolePicker";
import type { UpdateStaffAction } from "@/components/staff/Staff";
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
import { CheckCircle2, Clock, User, PlusCircle, Trash2 } from "lucide-react";
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
  departmentMapping?: Record<string, { name: string; description: string }>;
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
  departmentMapping = {},
  isLoading = false,
}: StaffEditModalProps) {
  const router = useRouter();
  const { effectiveProfile, scopedRoles } = useProfile();

  // Extract data from ProfileListItem
  const targetUser = useMemo(() => {
    if (!staffItem) return null;
    const emails = staffItem.emails && staffItem.emails.length > 0 
      ? staffItem.emails 
      : (staffItem.primary_email ? [staffItem.primary_email] : []);
    const primaryIndex = emails.length > 0 ? 0 : -1;
    return {
      firstName: staffItem.first_name || "",
      lastName: staffItem.last_name || "",
      emails: emails,
      primaryEmailIndex: primaryIndex,
      role: staffItem.role || "",
      reqPerDay: staffItem.requests_per_day ?? null,
      departmentId: staffItem.primary_department_id || "",
      active: staffItem.active ?? true,
    };
  }, [staffItem]);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    emails: [""] as string[],
    primaryEmailIndex: 0,
    role: "",
    reqPerDay: "" as number | "",
    primaryDepartmentId: "",
  });
  const [requestsPerDayEnabled, setRequestsPerDayEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Initialize form data when user is loaded
  useEffect(() => {
    if (targetUser && open) {
      setFormData({
        firstName: targetUser.firstName || "",
        lastName: targetUser.lastName || "",
        emails: targetUser.emails.length > 0 ? targetUser.emails : [""],
        primaryEmailIndex: targetUser.primaryEmailIndex >= 0 ? targetUser.primaryEmailIndex : 0,
        role: targetUser.role || "",
        reqPerDay: targetUser.reqPerDay ?? "",
        primaryDepartmentId: targetUser.departmentId || "",
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

  // Email management functions
  const addEmail = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      emails: [...prev.emails, ""],
    }));
  }, []);

  const removeEmail = useCallback((index: number) => {
    setFormData((prev) => {
      const newEmails = prev.emails.filter((_, i) => i !== index);
      // Ensure at least one email
      if (newEmails.length === 0) {
        return { ...prev, emails: [""], primaryEmailIndex: 0 };
      }
      // Adjust primary index if needed
      let newPrimaryIndex = prev.primaryEmailIndex;
      if (index === prev.primaryEmailIndex) {
        // If removing primary, set first email as primary
        newPrimaryIndex = 0;
      } else if (index < prev.primaryEmailIndex) {
        // If removing before primary, adjust index
        newPrimaryIndex = prev.primaryEmailIndex - 1;
      }
      return { ...prev, emails: newEmails, primaryEmailIndex: newPrimaryIndex };
    });
  }, []);

  const updateEmail = useCallback((index: number, value: string) => {
    setFormData((prev) => {
      const newEmails = [...prev.emails];
      newEmails[index] = value;
      return { ...prev, emails: newEmails };
    });
  }, []);

  const setPrimaryEmail = useCallback((index: number) => {
    setFormData((prev) => ({ ...prev, primaryEmailIndex: index }));
  }, []);

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
      // Get primary_department_id from form data or use first valid department as fallback
      const departmentId =
        formData.primaryDepartmentId ||
        (validDepartmentIds && validDepartmentIds.length > 0
          ? validDepartmentIds[0]
          : "") ||
        "";

      if (!updateStaffAction) {
        toast.error("Update action not available");
        return;
      }

      // Validate emails
      const validEmails = formData.emails.filter(e => e.trim().length > 0);
      if (validEmails.length === 0) {
        toast.error("At least one email is required");
        setIsSubmitting(false);
        return;
      }

      // Build update payload
      // Only send intro_completed and chat_completed if tour_completed was explicitly changed
      const updateBody: {
        profileId: string;
        first_name: string;
        last_name: string;
        emails: string[];
        primary_email_index?: number;
        role: string;
        requests_per_day: number | null;
        primary_department_id: string;
        active: boolean;
      } = {
        profileId: profileId,
        first_name: formData.firstName,
        last_name: formData.lastName,
        emails: validEmails,
        primary_email_index: formData.primaryEmailIndex >= 0 && formData.primaryEmailIndex < validEmails.length 
          ? formData.primaryEmailIndex 
          : 0,
        role: formData.role,
        requests_per_day: parsedReqPerDay,
        primary_department_id: departmentId,
        active: targetUser?.active ?? true,
        default_profile: formData.defaultProfile,
      };

      await updateStaffAction({
        body: updateBody,
      });
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
    profileId,
    formData,
    requestsPerDayEnabled,
    targetUser?.active,
    validDepartmentIds,
    updateStaffAction,
    router,
    onOpenChange,
    onDone,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!profileId) return;
      await handleConfirm();
    },
    [profileId, handleConfirm]
  );

  if (!profileId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl" data-testid="dialog-edit-staff">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Editable fields: Name */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {/* Emails Section */}
            <div className="space-y-2">
              <Label>Emails</Label>
              {!isLoading ? (
                <div className="space-y-2">
                  {formData.emails.map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => updateEmail(index, e.target.value)}
                          placeholder="redacted@purdue.edu"
                          disabled={isSubmitting}
                          data-testid={`input-staff-email-${index}`}
                          className={formData.primaryEmailIndex === index ? "border-primary" : ""}
                        />
                        {formData.primaryEmailIndex === index && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary font-medium">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant={formData.primaryEmailIndex === index ? "default" : "outline"}
                          size="icon"
                          onClick={() => setPrimaryEmail(index)}
                          disabled={isSubmitting || formData.primaryEmailIndex === index}
                          className="h-8 w-8 shrink-0"
                          title="Set as primary"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        {formData.emails.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeEmail(index)}
                            disabled={isSubmitting}
                            className="h-8 w-8 shrink-0"
                            title="Remove email"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addEmail}
                    disabled={isSubmitting}
                    size="sm"
                    className="w-full"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" /> Add email
                  </Button>
                </div>
              ) : (
                <Skeleton className="h-10 w-full" />
              )}
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
                      roleOptions={scopedRoles || []}
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

                {/* Primary Department Section (superadmin only) */}
                {isSuperadmin &&
                  validDepartmentIds.length > 1 && (
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="primaryDepartment">
                        Primary Department
                      </Label>
                      <DepartmentPicker
                        mapping={departmentMapping}
                        validIds={validDepartmentIds}
                        selectedIds={
                          formData.primaryDepartmentId
                            ? [formData.primaryDepartmentId]
                            : []
                        }
                        onSelect={(ids) => {
                          const deptId = ids.length > 0 ? ids[0] : "";
                          if (deptId !== undefined) {
                            handleInputChange("primaryDepartmentId", deptId);
                          }
                        }}
                        multiSelect={false}
                        placeholder="Select primary department"
                        disabled={isSubmitting}
                        buttonClassName="h-10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Set the primary department for this staff member
                      </p>
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
    </>
  );
}
