"use client";

import { Search, X } from "lucide-react";
import React, { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/contexts/profile-context";
import { useSearchStaff } from "@/lib/api/v2/hooks/profile";
import { ProfileListItem } from "@/lib/api/v2/schemas/profile";

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
  onStagedProfiles?: (
    profiles: Array<{
      profileId: string;
      firstName?: string;
      lastName?: string;
      alias?: string;
      role?: string;
      requestsPerDay?: number | null;
      totalRequests?: number;
    }>
  ) => void;
}

export default function SearchExistingStaffModal({
  open,
  onOpenChange,
  departmentIds: _scopedDepartmentIds,
  cohortIds: scopedCohortIds,
  departmentMapping: _departmentMapping,
  validDepartmentIds: _validDepartmentIds,
  cohortMapping: _cohortMapping,
  validCohortIds: _validCohortIds,
  onDone,
  onStagedProfiles,
}: SearchExistingStaffModalProps) {
  const { effectiveProfile } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedProfiles, setSelectedProfiles] = useState<
    Map<string, ProfileListItem>
  >(new Map());

  // Use server-side search hook
  const { data: searchData, isLoading } = useSearchStaff(
    {
      query: searchQuery || undefined,
      cohortIds: scopedCohortIds || undefined,
      departmentIds: _scopedDepartmentIds || undefined,
      limit: 200,
      profileId: effectiveProfile?.id || "",
    },
    {
      enabled: open && !!effectiveProfile?.id,
    }
  );

  // Get search results from API response
  const searchResults = React.useMemo(() => {
    if (!searchData?.staff) {
      return [];
    }

    // Filter out staged profiles (client-side since amount is small)
    const stagedProfileIds = new Set(Array.from(selectedProfiles.keys()));
    return searchData.staff.filter(
      (profile) => !stagedProfileIds.has(profile.profile_id)
    );
  }, [searchData?.staff, selectedProfiles]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedProfileIds(new Set());
      setSelectedProfiles(new Map());
    }
  }, [open]);

  // Toggle profile selection
  const handleToggleProfile = useCallback((profile: ProfileListItem) => {
    const profileId = profile.profile_id;
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
        setSelectedProfiles((prevProfiles) => {
          const nextProfiles = new Map(prevProfiles);
          nextProfiles.delete(profileId);
          return nextProfiles;
        });
      } else {
        next.add(profileId);
        setSelectedProfiles((prevProfiles) => {
          const nextProfiles = new Map(prevProfiles);
          nextProfiles.set(profileId, profile);
          return nextProfiles;
        });
      }
      return next;
    });
  }, []);

  // Handle submitting all selected profiles
  const handleSubmit = useCallback(async () => {
    if (selectedProfileIds.size === 0) {
      toast.error("Please select at least one profile.");
      return;
    }

    // Get selected profiles from stored profiles (not search results)
    const selectedProfilesArray = Array.from(selectedProfiles.values());

    if (selectedProfilesArray.length === 0) {
      toast.error("No profiles selected.");
      return;
    }

    try {
      // Stage all selected profiles - this modal is only for searching and staging
      const profileData = selectedProfilesArray.map((profile) => ({
        profileId: profile.profile_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        alias: profile.alias,
        role: profile.role,
        requestsPerDay: profile.requests_per_day,
        totalRequests: profile.total_requests,
      }));

      if (onStagedProfiles) {
        onStagedProfiles(profileData);
        toast.success(
          `${selectedProfilesArray.length} profile(s) staged. They will be added when you click Update.`
        );
      } else {
        // If no onStagedProfiles callback, just notify user
        toast.info(
          `${selectedProfilesArray.length} profile(s) selected. No action handler provided.`
        );
      }

      onOpenChange(false);
      if (onDone) {
        onDone();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stage profiles.";
      toast.error(errorMessage);
    }
  }, [
    selectedProfileIds,
    selectedProfiles,
    onStagedProfiles,
    onOpenChange,
    onDone,
    log,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Search Existing Staff</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search by name or alias"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <div className="border rounded-md max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading profiles...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? "No profiles found matching your search"
                  : scopedCohortIds && scopedCohortIds.length > 0
                    ? "All available profiles are already in this cohort"
                    : "Start typing to search for profiles"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Alias</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((profile) => {
                    const isSelected = selectedProfileIds.has(
                      profile.profile_id
                    );
                    return (
                      <TableRow
                        key={profile.profile_id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleToggleProfile(profile)}
                      >
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          className="w-[50px]"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleProfile(profile)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {profile.first_name} {profile.last_name}
                        </TableCell>
                        <TableCell>{profile.alias}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{profile.role}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from(selectedProfiles.values()).map((profile) => (
                <Badge
                  key={profile.profile_id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  <span>
                    {profile.first_name} {profile.last_name}
                  </span>
                  <button
                    onClick={() => handleToggleProfile(profile)}
                    className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5 transition-colors"
                    aria-label={`Remove ${profile.first_name} ${profile.last_name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {selectedProfileIds.size > 0 && (
                <Button onClick={handleSubmit}>
                  Add {selectedProfileIds.size} Staff
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
