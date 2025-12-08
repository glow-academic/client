"use client";

import { Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  ProfileListItem,
  SearchStaffOut,
} from "@/app/(main)/management/staff/page";
import { STAFF_ROLES } from "@/components/common/forms/staff-roles";
import type { SearchStaffAction } from "@/components/staff/Staff";
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
      email?: string;
      role?: string;
      requestsPerDay?: number | null;
      totalRequests?: number;
    }>,
  ) => void;
  initialSearchData?: SearchStaffOut;
  searchStaffAction?: SearchStaffAction;
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
  initialSearchData,
  searchStaffAction,
}: SearchExistingStaffModalProps) {
  const { effectiveProfile } = useProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedProfiles, setSelectedProfiles] = useState<
    Map<string, ProfileListItem>
  >(new Map());
  const [searchData, setSearchData] = useState<SearchStaffOut | null>(
    initialSearchData || null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search when user types (debounced)
  const handleSearch = useCallback(
    async (query: string) => {
      if (!effectiveProfile?.id || !searchStaffAction) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // Normalize query: empty string becomes null, otherwise use trimmed value
        const normalizedQuery = query && query.trim() ? query.trim() : null;
        const data = await searchStaffAction({
          body: {
            query: normalizedQuery,
            cohortIds: scopedCohortIds || null,
            departmentIds: _scopedDepartmentIds || null,
            limit: 200,
            profileId: effectiveProfile.id,
          },
        });
        // Ensure we update searchData even if staff array is empty
        setSearchData(data);
      } catch {
        toast.error("Failed to search staff");
        // Reset to initial data on error
        setSearchData(initialSearchData || null);
      } finally {
        setIsLoading(false);
      }
    },
    [
      effectiveProfile?.id,
      searchStaffAction,
      scopedCohortIds,
      _scopedDepartmentIds,
      initialSearchData,
    ],
  );

  // Handle search input change with debounce
  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      // If query becomes empty, restore initial data immediately
      if (value === "") {
        setSearchData(initialSearchData || null);
        setIsLoading(false);
        return;
      }
      // Otherwise, debounce the search
      setIsLoading(true);
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value);
      }, 500);
    },
    [handleSearch, initialSearchData],
  );

  // Initial search when modal opens (if no initial data)
  useEffect(() => {
    if (
      open &&
      !initialSearchData &&
      searchStaffAction &&
      effectiveProfile?.id
    ) {
      // Trigger initial search with empty query to get all profiles
      handleSearch("");
    }
  }, [
    open,
    initialSearchData,
    searchStaffAction,
    effectiveProfile?.id,
    handleSearch,
  ]);

  // Get search results from API response
  // Don't filter out selected profiles - show them so users can uncheck directly
  const searchResults = useMemo(() => {
    if (!searchData || !searchData.staff) {
      return [];
    }
    // Ensure staff is an array
    return Array.isArray(searchData.staff) ? searchData.staff : [];
  }, [searchData]);

  // Reset state when modal closes or opens
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSelectedProfileIds(new Set());
      setSelectedProfiles(new Map());
      setSearchData(initialSearchData || null);
      setIsLoading(false);
    } else {
      // When modal opens, initialize with initial data
      setSearchData(initialSearchData || null);
      setSearchQuery("");
    }
  }, [open, initialSearchData]);

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
        email:
          profile.primary_email || (profile.emails && profile.emails[0]) || "",
        role: profile.role,
        requestsPerDay: profile.requests_per_day,
        totalRequests: profile.total_requests,
      }));

      if (onStagedProfiles) {
        onStagedProfiles(profileData);
        toast.success(
          `${selectedProfilesArray.length} profile(s) staged. They will be added when you click Update.`,
        );
      } else {
        // If no onStagedProfiles callback, just notify user
        toast.info(
          `${selectedProfilesArray.length} profile(s) selected. No action handler provided.`,
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
              placeholder="Search by name or email"
              value={searchQuery}
              onChange={(e) => handleSearchQueryChange(e.target.value)}
              className="pl-10"
              autoFocus
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search Results */}
          <div className="border rounded-md max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profiles...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery && searchQuery.trim()
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
                      profile.profile_id,
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
                        <TableCell>
                          {profile.emails && profile.emails.length > 0
                            ? profile.emails.join(", ")
                            : profile.primary_email || "No email"}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const roleData = STAFF_ROLES.find(
                              (r) => r.id === profile.role,
                            );
                            if (!roleData) {
                              return (
                                <Badge variant="outline">{profile.role}</Badge>
                              );
                            }
                            const IconComponent = roleData.icon;
                            const hexColor = roleData.color || "#64748b";
                            // Generate gradient from hex color
                            const cleanHex = hexColor.replace("#", "");
                            const r = parseInt(cleanHex.substr(0, 2), 16);
                            const g = parseInt(cleanHex.substr(2, 2), 16);
                            const b = parseInt(cleanHex.substr(4, 2), 16);
                            const lighterR = Math.min(255, r + 60);
                            const lighterG = Math.min(255, g + 60);
                            const lighterB = Math.min(255, b + 60);
                            const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
                            const gradientStyle = `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;

                            return (
                              <div className="flex items-center gap-2">
                                <div
                                  className="p-1.5 rounded-md shadow-sm flex-shrink-0"
                                  style={{
                                    background: gradientStyle,
                                  }}
                                >
                                  <IconComponent className="h-3.5 w-3.5 text-white" />
                                </div>
                                <span className="text-sm">{roleData.name}</span>
                              </div>
                            );
                          })()}
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
