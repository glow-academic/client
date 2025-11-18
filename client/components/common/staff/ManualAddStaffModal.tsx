"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { StaffRolePicker } from "@/components/common/forms/StaffRolePicker";
import type { BulkCreateOrUpdateStaffAction } from "@/components/staff/Staff";
import { Badge } from "@/components/ui/badge";
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

type RoleValue = "superadmin" | "admin" | "instructional" | "ta" | "guest";

interface StaffEntry {
  firstName: string;
  lastName: string;
  alias: string;
  role: RoleValue;
  id: string; // Unique ID for the entry
}

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
      alias?: string;
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

  const [nameInput, setNameInput] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleValue>("ta");
  const [entries, setEntries] = useState<StaffEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entryIdCounter, setEntryIdCounter] = useState(0);

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
      setNameInput("");
      setAliasInput("");
      setSelectedRole("ta");
      setEntries([]);
    }
  }, [open]);

  // Add entry to list
  const handleAddEntry = useCallback(() => {
    // Parse name input (First Last)
    const nameParts = nameInput
      .trim()
      .split(/\s+/)
      .filter((p) => p);
    if (nameParts.length < 2) {
      toast.error("Please enter both first and last name");
      return;
    }

    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const alias = aliasInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "");

    if (!alias || alias.length < 2) {
      toast.error("Please enter a valid alias (at least 2 characters)");
      return;
    }

    // Validate role is in valid roles
    const role: RoleValue = validRoles.includes(selectedRole)
      ? selectedRole
      : ((validRoles[0] ?? "ta") as RoleValue);

    const newEntry: StaffEntry = {
      firstName,
      lastName,
      alias,
      role,
      id: `entry-${entryIdCounter}`,
    };

    setEntries((prev) => [...prev, newEntry]);
    setEntryIdCounter((prev) => prev + 1);

    // Clear inputs
    setNameInput("");
    setAliasInput("");
    setSelectedRole("ta");
  }, [nameInput, aliasInput, selectedRole, validRoles, entryIdCounter]);

  // Remove entry from list
  const handleRemoveEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (entries.length === 0) {
      toast.error("Please add at least one staff member.");
      return;
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

      const profiles = entries.map((entry) => ({
        firstName: entry.firstName,
        lastName: entry.lastName,
        alias: entry.alias,
        role: entry.role,
        department_ids: finalDepartmentIds,
        cohort_ids: finalCohortIds,
      }));

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
      if (isScoped && onStagedProfiles && response.profileIds) {
        const stagedProfiles = response.profileIds.map((profileId, index) => ({
          profileId,
          firstName: entries[index]?.firstName ?? "",
          lastName: entries[index]?.lastName ?? "",
          alias: entries[index]?.alias ?? "",
          role: entries[index]?.role ?? "ta",
        }));
        onStagedProfiles(stagedProfiles);
        toast.success(
          `${entries.length} profile(s) staged. They will be added to the cohort when you click Update.`
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
          : "Failed to create or update staff members.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    entries,
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

        <div className="space-y-4 py-4">
          {/* Single-line form */}
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label htmlFor="name-input" className="text-xs">
                Name (First Last)
              </Label>
              <Input
                id="name-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="John Doe"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddEntry();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="alias-input" className="text-xs">
                Alias
              </Label>
              <Input
                id="alias-input"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="jdoe"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddEntry();
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role-input" className="text-xs">
                Role (optional)
              </Label>
              <StaffRolePicker
                selectedRole={selectedRole}
                onSelect={(value) => setSelectedRole(value as RoleValue)}
                placeholder="Select role"
                roleOptions={validRoles}
                buttonClassName="h-10"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAddEntry}
                disabled={!nameInput.trim() || !aliasInput.trim()}
                className="w-full"
              >
                Add
              </Button>
            </div>
          </div>

          {/* Added entries list */}
          {entries.length > 0 && (
            <div className="space-y-2 pt-2 border-t">
              <p className="text-sm font-medium">Added Staff:</p>
              <div className="flex items-center gap-2 flex-wrap">
                {entries.map((entry) => {
                  const isInstructional = entry.role === "instructional";
                  const isValidRole = validRoles.includes(entry.role);
                  return (
                    <Badge
                      key={entry.id}
                      variant={isInstructional ? "default" : "secondary"}
                      className={`flex items-center gap-1 pr-1 ${
                        !isValidRole ? "opacity-50 line-through" : ""
                      }`}
                    >
                      <span>
                        {entry.firstName} {entry.lastName} ({entry.alias})
                      </span>
                      <button
                        onClick={() => handleRemoveEntry(entry.id)}
                        className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                        aria-label={`Remove ${entry.firstName} ${entry.lastName}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {entries.length > 0 && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || entries.length === 0}
                className="flex items-center gap-2"
              >
                {isSubmitting ? "Processing..." : `Add ${entries.length} Staff`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
