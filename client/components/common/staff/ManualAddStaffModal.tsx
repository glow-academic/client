"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/contexts/profile-context";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type RoleValue = "superadmin" | "admin" | "instructional" | "ta" | "guest";

interface ParsedStaffEntry {
  firstName: string;
  lastName: string;
  alias: string;
  role: RoleValue;
  rawLine: string;
  index: number;
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
}: ManualAddStaffModalProps) {
  const { effectiveProfile } = useProfile();
  const queryClient = useQueryClient();

  // V3 API mutation
  const bulkCreateOrUpdateMutation = useMutation({
    mutationFn: (request: {
      profiles: Array<{
        firstName: string;
        lastName: string;
        alias: string;
        role: string;
        department_ids: string[];
        cohort_ids: string[];
      }>;
      currentProfileId: string;
    }) =>
      api.post("/profile/staff/bulk-create-or-update-staff", {
        body: request,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.profile.all });
    },
  });

  const [inputText, setInputText] = useState("");
  const [parsedEntries, setParsedEntries] = useState<ParsedStaffEntry[]>([]);
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

  // Parse input text into staff entries
  const parseInput = useCallback(
    (text: string): ParsedStaffEntry[] => {
      if (!text.trim()) return [];

      // Split by newlines first, then by commas if needed
      const lines = text
        .split(/\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const entries: ParsedStaffEntry[] = [];

      lines.forEach((line, lineIndex) => {
        // Try different parsing strategies
        let parts: string[] = [];

        // Strategy 1: Comma-separated (preferred format)
        if (line.includes(",")) {
          parts = line
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p);

          // Parse comma-separated: First Last, Alias, Role (Role optional)
          if (parts.length >= 2 && parts[0]) {
            // Split first part into First Last
            const nameParts = parts[0].split(/\s+/).filter((p) => p);
            if (nameParts.length >= 2 && nameParts[0]) {
              const firstName = nameParts[0];
              const lastName = nameParts.slice(1).join(" ") || "";
              const alias = parts[1] || "";
              const roleCandidate = parts[2]?.toLowerCase() || "ta";
              let role: RoleValue = validRoles.includes(
                roleCandidate as RoleValue
              )
                ? (roleCandidate as RoleValue)
                : "ta";

              // If role is not in valid roles for scope, default to first valid role
              if (!validRoles.includes(role)) {
                role = validRoles[0] || "ta";
              }

              // Validate required fields
              if (firstName && lastName && alias) {
                const cleanAlias = alias
                  .toLowerCase()
                  .replace(/[^a-z0-9._-]/g, "")
                  .trim();

                if (cleanAlias.length >= 2) {
                  entries.push({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    alias: cleanAlias,
                    role,
                    rawLine: line,
                    index: lineIndex,
                  });
                }
              }
            }
          }
          return; // Processed comma-separated format, continue to next line
        }

        // Strategy 2: Space-separated (fallback)
        parts = line.split(/\s+/).filter((p) => p);

        if (parts.length < 2) return; // Need at least first name + last name

        // Extract components
        let firstName = "";
        let lastName = "";
        let alias = "";
        let role: RoleValue = "ta"; // Default role

        if (parts.length === 2) {
          // First Last (alias and role missing)
          firstName = parts[0] || "";
          lastName = parts[1] || "";
          alias = parts[1]?.toLowerCase().replace(/\s+/g, "") || ""; // Generate from last name
        } else if (parts.length === 3) {
          // First Last Alias (role missing, defaults to ta)
          firstName = parts[0] || "";
          lastName = parts[1] || "";
          alias = parts[2] || "";
        } else if (parts.length >= 4) {
          // First Last Alias Role
          firstName = parts[0] || "";
          lastName = parts[1] || "";
          alias = parts[2] || "";
          const roleCandidate = parts[3]?.toLowerCase() || "ta";
          let candidateRole: RoleValue = validRoles.includes(
            roleCandidate as RoleValue
          )
            ? (roleCandidate as RoleValue)
            : "ta";

          // If role is not in valid roles for scope, default to ta (or first valid role)
          if (!validRoles.includes(candidateRole)) {
            candidateRole = validRoles[0] || "ta";
          }
          role = candidateRole;
        }

        // Validate required fields
        if (firstName && lastName && alias) {
          // Clean alias (remove special chars, lowercase)
          const cleanAlias = alias
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "")
            .trim();

          if (cleanAlias.length >= 2) {
            entries.push({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              alias: cleanAlias,
              role,
              rawLine: line,
              index: lineIndex,
            });
          }
        }
      });

      return entries;
    },
    [validRoles]
  );

  // Update parsed entries when input changes
  useEffect(() => {
    const parsed = parseInput(inputText);
    setParsedEntries(parsed);
  }, [inputText, parseInput]);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!open) {
      setInputText("");
      setParsedEntries([]);
    }
  }, [open]);

  // Remove parsed entry
  const handleRemoveEntry = useCallback(
    (index: number) => {
      // Find the entry and remove its line from input
      const entry = parsedEntries.find((e) => e.index === index);
      if (entry) {
        const lines = inputText.split(/\n/).map((l) => l.trim());
        const newLines = lines.filter((_, i) => i !== entry.index);
        setInputText(newLines.join("\n"));
      }
    },
    [parsedEntries, inputText]
  );

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (parsedEntries.length === 0) {
      toast.error("Please enter at least one staff member.");
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

      const profiles = parsedEntries.map((entry) => ({
        firstName: entry.firstName,
        lastName: entry.lastName,
        alias: entry.alias,
        role: entry.role,
        department_ids: finalDepartmentIds,
        cohort_ids: finalCohortIds,
      }));

      const response = await bulkCreateOrUpdateMutation.mutateAsync({
        profiles,
        currentProfileId: effectiveProfile?.id || "",
      });

      // When scoped, stage the profiles
      if (isScoped && onStagedProfiles && response.profileIds) {
        const stagedProfiles = response.profileIds.map((profileId, index) => ({
          profileId,
          firstName: parsedEntries[index]?.firstName ?? "",
          lastName: parsedEntries[index]?.lastName ?? "",
          alias: parsedEntries[index]?.alias ?? "",
          role: parsedEntries[index]?.role ?? "ta",
        }));
        onStagedProfiles(stagedProfiles);
        toast.success(
          `${parsedEntries.length} profile(s) staged. They will be added to the cohort when you click Update.`
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
    parsedEntries,
    departmentIds,
    cohortIds,
    isScoped,
    isCohortScoped,
    isDepartmentScoped,
    effectiveProfile?.id,
    bulkCreateOrUpdateMutation,
    onOpenChange,
    onDone,
    onStagedProfiles,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manually Add Staff</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Input Textarea */}
          <div className="space-y-2">
            <Textarea
              placeholder={`John Doe, jdoe, ta
Jane Smith, jsmith
Bob Wilson, bwilson, instructional`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
              autoFocus
            />
            <p className="text-sm text-muted-foreground">
              Format: First Last, Alias, Role ({validRoles.join("/")}) —
              optional
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              {parsedEntries.map((entry, idx) => {
                const isInstructional = entry.role === "instructional";
                const isValidRole = validRoles.includes(entry.role);
                return (
                  <Badge
                    key={`footer-${entry.index}-${idx}`}
                    variant={isInstructional ? "default" : "secondary"}
                    className={`flex items-center gap-1 pr-1 ${
                      !isValidRole ? "opacity-50 line-through" : ""
                    }`}
                  >
                    <span>
                      {entry.firstName} {entry.lastName} ({entry.alias})
                    </span>
                    <button
                      onClick={() => handleRemoveEntry(entry.index)}
                      className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                      aria-label={`Remove ${entry.firstName} ${entry.lastName}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {parsedEntries.length > 0 && (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || parsedEntries.length === 0}
                  className="flex items-center gap-2"
                >
                  {isSubmitting
                    ? "Processing..."
                    : `Add ${parsedEntries.length} Staff`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
