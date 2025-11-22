"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { StaffRolePicker } from "@/components/common/forms/StaffRolePicker";
import type { BulkCreateOrUpdateStaffAction } from "@/components/staff/Staff";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/contexts/profile-context";
import { useRouter } from "next/navigation";
import { PlusCircle, Trash2, CheckCircle2 } from "lucide-react";

type RoleValue = "superadmin" | "admin" | "instructional" | "ta" | "guest";

export interface ManualAddStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentIds?: string[];
  cohortIds?: string[];
  departmentMapping: Record<string, { name: string; description: string }>;
  validDepartmentIds: string[];
  cohortMapping: Record<string, { name: string; description: string }>;
  validCohortIds: string[];
  roleOptions: string[];
  onDone?: () => void;
  onStagedProfiles?: (
    profiles: Array<{
      profileId: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: string;
    }>
  ) => void;
  bulkCreateOrUpdateStaffAction?: BulkCreateOrUpdateStaffAction;
}

export default function ManualAddStaffModal({
  open,
  onOpenChange,
  departmentIds,
  cohortIds,
  departmentMapping: _departmentMapping,
  validDepartmentIds: _validDepartmentIds,
  cohortMapping: _cohortMapping,
  validCohortIds: _validCohortIds,
  roleOptions,
  onDone,
  onStagedProfiles,
  bulkCreateOrUpdateStaffAction,
}: ManualAddStaffModalProps) {
  const { effectiveProfile } = useProfile();
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [emails, setEmails] = useState<string[]>([""]);
  const [primaryEmailIndex, setPrimaryEmailIndex] = useState(0);
  const [selectedRole, setSelectedRole] = useState<RoleValue>("ta");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isScoped = !!(departmentIds?.length || cohortIds?.length);
  const isCohortScoped = !!cohortIds?.length;
  const isDepartmentScoped = !cohortIds?.length && !!departmentIds?.length;

  // Valid role values based on scope (ordered for display)
  const validRoles = useMemo(() => {
    const roleOrder: RoleValue[] = [
      "ta",
      "instructional",
      "admin",
      "superadmin",
    ];

    // Apply scope restrictions
    let allowedRoles: RoleValue[];
    if (isCohortScoped) {
      // Cohort scope: only ta and instructional
      allowedRoles = ["ta", "instructional"];
    } else if (isDepartmentScoped) {
      // Department scope: ta, instructional, and admin
      allowedRoles = ["ta", "instructional", "admin"];
    } else {
      // Staff scope: all roles allowed
      allowedRoles = ["ta", "instructional", "admin", "superadmin"];
    }

    // Filter roleOptions to only include roles that are both in options and allowed by scope
    return roleOrder.filter(
      (role) => allowedRoles.includes(role) && roleOptions.includes(role)
    );
  }, [roleOptions, isCohortScoped, isDepartmentScoped]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setFirstName("");
      setLastName("");
      setEmails([""]);
      setPrimaryEmailIndex(0);
      setSelectedRole("ta");
    }
  }, [open]);

  // Email management functions
  const addEmail = useCallback(() => {
    setEmails((prev) => [...prev, ""]);
  }, []);

  const removeEmail = useCallback((index: number) => {
    setEmails((prev) => {
      const newEmails = prev.filter((_, i) => i !== index);
      if (newEmails.length === 0) {
        setPrimaryEmailIndex(0);
        return [""];
      }
      let newPrimaryIndex = primaryEmailIndex;
      if (index === primaryEmailIndex) {
        newPrimaryIndex = 0;
      } else if (index < primaryEmailIndex) {
        newPrimaryIndex = primaryEmailIndex - 1;
      }
      setPrimaryEmailIndex(newPrimaryIndex);
      return newEmails;
    });
  }, [primaryEmailIndex]);

  const updateEmail = useCallback((index: number, value: string) => {
    setEmails((prev) => {
      const newEmails = [...prev];
      newEmails[index] = value;
      return newEmails;
    });
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    // Validation
    if (!firstName.trim()) {
      toast.error("Please enter a first name");
      return;
    }
    if (!lastName.trim()) {
      toast.error("Please enter a last name");
      return;
    }
    // Validate emails
    const validEmails = emails.filter(e => e.trim().length > 0).map(e => e.trim().toLowerCase());
    if (validEmails.length === 0) {
      toast.error("Please enter at least one email address");
      return;
    }
    for (const email of validEmails) {
      if (!email.includes("@")) {
        toast.error(`Invalid email address: ${email}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Staging logic based on context (matches CSV import):
      // - Cohort page (cohortIds): Don't attach departments or cohorts (staging mode)
      // - Department page (departmentIds, no cohortIds): Allow cohorts, don't attach departments (staging for departments)
      // - Staff page (no scoping): Use both department_ids and cohort_ids directly (no staging)
      let finalDepartmentIds: string[] = [];
      let finalCohortIds: string[] = [];

      if (isCohortScoped) {
        // Cohort page: staging mode - don't attach anything
        finalDepartmentIds = [];
        finalCohortIds = [];
      } else if (isDepartmentScoped) {
        // Department page: allow cohorts from input, but don't attach departments (staging)
        finalDepartmentIds = [];
        // Note: For manual add, we don't have cohort input, so cohort_ids stays empty
        // If we had cohort input in manual add, we'd allow it here
        finalCohortIds = [];
      } else {
        // Staff page: no staging - use both directly (use all provided IDs)
        finalDepartmentIds = departmentIds || [];
        finalCohortIds = cohortIds || [];
      }

      // Validate role is in valid roles
      const role: RoleValue = validRoles.includes(selectedRole)
        ? selectedRole
        : ((validRoles[0] ?? "ta") as RoleValue);

      const profiles = [
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          emails: validEmails,
          primary_email_index: primaryEmailIndex >= 0 && primaryEmailIndex < validEmails.length 
            ? primaryEmailIndex 
            : 0,
          role,
          department_ids: finalDepartmentIds,
          cohort_ids: finalCohortIds,
        },
      ];

      if (!bulkCreateOrUpdateStaffAction) {
        toast.error("Bulk create or update action not available");
        return;
      }

      const response = await bulkCreateOrUpdateStaffAction({
        body: {
          profiles,
          currentProfileId: effectiveProfile?.id || "",
        },
      });

      // Refresh data after successful update
      router.refresh();

      // When scoped, stage the profiles
      const firstProfileId = response.profileIds?.[0];
      if (isScoped && onStagedProfiles && firstProfileId) {
        const primaryEmail = validEmails[primaryEmailIndex] || validEmails[0] || "";
        const stagedProfiles = [
          {
            profileId: firstProfileId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: primaryEmail,
            role,
          },
        ];
        onStagedProfiles(stagedProfiles);
        toast.success(
          "Profile staged. It will be added to the cohort when you click Update."
        );
      } else {
        toast.success(
          `Successfully processed ${response.created_count} created, ${response.updated_count} updated staff member(s)!`
        );
      }

      onOpenChange(false);
      if (onDone) {
        onDone();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create or update staff member.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    firstName,
    lastName,
    emails,
    primaryEmailIndex,
    selectedRole,
    validRoles,
    departmentIds,
    cohortIds,
    isScoped,
    isCohortScoped,
    isDepartmentScoped,
    effectiveProfile?.id,
    bulkCreateOrUpdateStaffAction,
    router,
    onOpenChange,
    onDone,
    onStagedProfiles,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manually Add Staff</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4 py-4"
        >
          {/* Form fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName-input">First Name</Label>
              <Input
                id="firstName-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName-input">Last Name</Label>
              <Input
                id="lastName-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Emails</Label>
            <div className="space-y-2">
              {emails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="redacted@purdue.edu"
                      required={index === 0}
                      disabled={isSubmitting}
                      className={primaryEmailIndex === index ? "border-primary" : ""}
                    />
                    {primaryEmailIndex === index && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary font-medium">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={primaryEmailIndex === index ? "default" : "outline"}
                      size="icon"
                      onClick={() => setPrimaryEmailIndex(index)}
                      disabled={isSubmitting || primaryEmailIndex === index}
                      className="h-8 w-8 shrink-0"
                      title="Set as primary"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    {emails.length > 1 && (
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-input">Role</Label>
            <StaffRolePicker
              selectedRole={selectedRole}
              onSelect={(value) => setSelectedRole(value as RoleValue)}
              placeholder="Select role"
              roleOptions={validRoles}
              buttonClassName="h-10"
              disabled={isSubmitting}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !firstName.trim() ||
                !lastName.trim() ||
                emails.filter(e => e.trim().length > 0).length === 0
              }
            >
              {isSubmitting ? "Processing..." : "Add Staff"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
