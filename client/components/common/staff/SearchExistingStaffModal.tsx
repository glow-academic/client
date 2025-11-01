"use client";

import { Search, X } from "lucide-react";
import React, { useCallback, useState } from "react";
import { toast } from "sonner";

import { CohortPicker } from "@/components/common/forms/CohortPicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/contexts/profile-context";
import { useAddProfilesToCohort } from "@/lib/api/v2/hooks/cohorts";
import { useLogger } from "@/lib/api/v2/hooks/logs";
import {
  useCreateOrUpdateStaff,
  useSearchProfiles,
} from "@/lib/api/v2/hooks/profile";
import { ProfileFilters } from "@/lib/api/v2/schemas/profile";

export interface SearchExistingStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentIds?: string[];
  cohortIds?: string[];
  departmentMapping: Record<string, { name: string; description: string }>;
  validDepartmentIds: string[];
  cohortMapping: Record<string, { name: string; description: string }>;
  validCohortIds: string[];
  onDone?: () => void;
}

interface SelectedProfile {
  profile_id: string;
  first_name: string;
  last_name: string;
  alias: string;
  role: string;
}

export default function SearchExistingStaffModal({
  open,
  onOpenChange,
  departmentIds: scopedDepartmentIds,
  cohortIds: scopedCohortIds,
  departmentMapping,
  validDepartmentIds,
  cohortMapping,
  validCohortIds,
  onDone,
}: SearchExistingStaffModalProps) {
  const { effectiveProfile } = useProfile();
  const log = useLogger();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfiles, setSelectedProfiles] = useState<SelectedProfile[]>(
    []
  );
  const [assignedDepartmentId, setAssignedDepartmentId] = useState<string>(
    scopedDepartmentIds && scopedDepartmentIds.length > 0
      ? scopedDepartmentIds[0]!
      : ""
  );
  const [assignedCohortId, setAssignedCohortId] = useState<string>(
    scopedCohortIds && scopedCohortIds.length > 0 ? scopedCohortIds[0]! : ""
  );

  // Search profiles
  const filters: ProfileFilters = {
    profileId: effectiveProfile?.id || "",
  };

  const { data: searchData, isLoading: isSearching } = useSearchProfiles(
    searchQuery,
    filters,
    open && !!effectiveProfile?.id
  );

  const addProfilesToCohortMutation = useAddProfilesToCohort();
  const createOrUpdateStaffMutation = useCreateOrUpdateStaff();

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedProfiles([]);
      setAssignedDepartmentId(
        scopedDepartmentIds && scopedDepartmentIds.length > 0
          ? scopedDepartmentIds[0]!
          : ""
      );
      setAssignedCohortId(
        scopedCohortIds && scopedCohortIds.length > 0 ? scopedCohortIds[0]! : ""
      );
    }
  }, [open, scopedDepartmentIds, scopedCohortIds]);

  const handleSelectProfile = useCallback((profile: SelectedProfile) => {
    setSelectedProfiles((prev) => {
      const exists = prev.find((p) => p.profile_id === profile.profile_id);
      if (exists) {
        toast.error("This profile is already selected.");
        return prev;
      }
      return [...prev, profile];
    });
  }, []);

  const handleRemoveProfile = useCallback((profileId: string) => {
    setSelectedProfiles((prev) =>
      prev.filter((p) => p.profile_id !== profileId)
    );
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selectedProfiles.length === 0) {
      toast.error("Please select at least one profile.");
      return;
    }

    try {
      // If cohortIds provided, add profiles to cohort
      if (scopedCohortIds && scopedCohortIds.length > 0) {
        await addProfilesToCohortMutation.mutateAsync({
          cohortId: scopedCohortIds[0]!,
          departmentIds:
            scopedDepartmentIds && scopedDepartmentIds.length > 0
              ? scopedDepartmentIds
              : assignedDepartmentId
                ? [assignedDepartmentId]
                : [],
          existingProfileIds: selectedProfiles.map((p) => p.profile_id),
        });
        toast.success(
          `Successfully added ${selectedProfiles.length} profile(s) to cohort.`
        );
      } else {
        // Otherwise, update each profile's department/cohort
        const finalDepartmentId =
          scopedDepartmentIds && scopedDepartmentIds.length > 0
            ? scopedDepartmentIds[0]
            : assignedDepartmentId || null;
        const finalCohortId =
          scopedCohortIds && scopedCohortIds.length > 0
            ? scopedCohortIds[0]
            : assignedCohortId || null;

        // Update each selected profile
        await Promise.all(
          selectedProfiles.map((profile) =>
            createOrUpdateStaffMutation.mutateAsync({
              firstName: profile.first_name,
              lastName: profile.last_name,
              alias: profile.alias,
              role: profile.role,
              department_id: finalDepartmentId,
              cohort_id: finalCohortId,
            })
          )
        );
        toast.success(
          `Successfully updated ${selectedProfiles.length} profile(s).`
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
          : "Failed to add/update profiles.";
      toast.error(errorMessage);
      log.error("staff.search_add.failed", {
        message: "Error adding/updating profiles from search",
        error,
        context: {
          component: "SearchExistingStaffModal",
          function: "handleSubmit",
        },
      });
    }
  }, [
    selectedProfiles,
    scopedDepartmentIds,
    scopedCohortIds,
    assignedDepartmentId,
    assignedCohortId,
    addProfilesToCohortMutation,
    createOrUpdateStaffMutation,
    onOpenChange,
    onDone,
    log,
  ]);

  const searchResults = searchData?.staff || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Search Existing Staff</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search">Search by name or alias</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Type to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Search Results */}
          <div className="space-y-2">
            <Label>Search Results</Label>
            <div className="border rounded-md max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? "No profiles found matching your search"
                    : "Start typing to search for profiles"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Alias</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((profile) => {
                      const isSelected = selectedProfiles.some(
                        (p) => p.profile_id === profile.profile_id
                      );
                      return (
                        <TableRow key={profile.profile_id}>
                          <TableCell className="font-medium">
                            {profile.first_name} {profile.last_name}
                          </TableCell>
                          <TableCell>{profile.alias}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{profile.role}</Badge>
                          </TableCell>
                          <TableCell>
                            {isSelected ? (
                              <Badge variant="secondary">Selected</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSelectProfile(profile)}
                              >
                                Select
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Selected Profiles */}
          {selectedProfiles.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Profiles ({selectedProfiles.length})</Label>
              <div className="border rounded-md max-h-40 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Alias</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProfiles.map((profile) => (
                      <TableRow key={profile.profile_id}>
                        <TableCell className="font-medium">
                          {profile.first_name} {profile.last_name}
                        </TableCell>
                        <TableCell>{profile.alias}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{profile.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              handleRemoveProfile(profile.profile_id)
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Assignment Fields - only show if not fully scoped */}
          {(!scopedDepartmentIds ||
            scopedDepartmentIds.length === 0 ||
            !scopedCohortIds ||
            scopedCohortIds.length === 0) && (
            <div className="space-y-4 border-t pt-4">
              <Label>Assign To</Label>

              {/* Department - only show if not scoped */}
              {(!scopedDepartmentIds || scopedDepartmentIds.length === 0) && (
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <DepartmentPicker
                    mapping={departmentMapping}
                    validIds={validDepartmentIds}
                    selectedIds={
                      assignedDepartmentId ? [assignedDepartmentId] : []
                    }
                    onSelect={(ids) => setAssignedDepartmentId(ids[0] || "")}
                    placeholder="Select department (optional)"
                    multiSelect={false}
                  />
                </div>
              )}

              {/* Cohort - only show if not scoped */}
              {(!scopedCohortIds || scopedCohortIds.length === 0) && (
                <div className="space-y-2">
                  <Label htmlFor="cohort">Cohort</Label>
                  <CohortPicker
                    mapping={cohortMapping}
                    validIds={validCohortIds}
                    selectedIds={assignedCohortId ? [assignedCohortId] : []}
                    onSelect={(ids) => setAssignedCohortId(ids[0] || "")}
                    placeholder="Select cohort (optional)"
                    multiSelect={false}
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                selectedProfiles.length === 0 ||
                addProfilesToCohortMutation.isPending ||
                createOrUpdateStaffMutation.isPending
              }
            >
              {addProfilesToCohortMutation.isPending ||
              createOrUpdateStaffMutation.isPending
                ? "Processing..."
                : `Add ${selectedProfiles.length} Profile(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
