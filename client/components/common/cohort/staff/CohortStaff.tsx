/**
 * CohortStaff.tsx
 * Used to show the cohort staff with enhanced data table toolbar integration.
 * @AshokSaravanan222 & @siladiea
 * 07/18/2025
 */

"use client";
import { useCallback, useEffect, useState } from "react";

import { DataTableFacetedFilter } from "@/components/common/history/DataTableFacetedFilter";
import { DataTablePagination } from "@/components/common/history/DataTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import StaffManager from "@/components/common/staff/StaffManager";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Profile, ProfileRole } from "@/types";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  FileText,
  Grid3X3,
  List,
  Plus,
  UploadCloud,
  UserMinus,
} from "lucide-react";

// A new type to represent a profile that is either saved or new
type EditableProfile =
  | Profile
  | {
      isNew: true;
      id: string; // A temporary client-side ID
      firstName: string;
      lastName: string;
      alias: string;
      role: ProfileRole;
    };

export interface CohortStaffProps {
  profiles: EditableProfile[];
  setProfiles: (profiles: EditableProfile[]) => void;
  profilesToDelete: string[];
  setProfilesToDelete: (profileIds: string[]) => void;
  isLoading?: boolean;
  isSubmitting?: boolean;
  effectiveProfile?: Profile | null; // Current user's effective profile
  isReadonly?: boolean;
  // V2 data from parent
  profileMapping?: Record<string, { name: string; description: string }>;
  validProfileIds?: string[];
}

export default function CohortStaff({
  profiles,
  setProfiles,
  profilesToDelete,
  setProfilesToDelete,
  isLoading = false,
  effectiveProfile,
  isReadonly = false,
  profileMapping,
  validProfileIds,
}: CohortStaffProps) {
  // View mode state
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  // Dialog state
  const [isAddStaffDialogOpen, setIsAddStaffDialogOpen] = useState(false);

  // Table state for filtering and pagination
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "role", desc: true }, // Sort by role using custom sorting function
  ]);

  // Role options for faceted filter
  const roleOptions = [
    { value: "instructional", label: "👨‍🏫 Instructor" },
    { value: "ta", label: "👨‍🎓 TA" },
  ];

  // Handle adding new profiles from the upload component
  const handleAddProfiles = useCallback(
    (newProfiles: EditableProfile[]) => {
      setProfiles([...newProfiles, ...profiles]);
    },
    [profiles, setProfiles]
  );

  // Profile management handlers
  const stageProfileForDeletion = useCallback(
    (profileId: string) => {
      const profileToRemove = profiles.find((p) => p.id === profileId);
      if (!profileToRemove) return;

      // If it's an existing profile, add its ID to the deletion queue
      if (!("isNew" in profileToRemove)) {
        setProfilesToDelete([...profilesToDelete, profileId]);
      }

      // Remove the profile from the visible UI state
      setProfiles(profiles.filter((p) => p.id !== profileId));
    },
    [profiles, profilesToDelete, setProfiles, setProfilesToDelete]
  );

  const getProfileRoleIcon = (role: ProfileRole) => {
    switch (role) {
      case "instructional":
        return "👨‍🏫";
      case "ta":
        return "👨‍🎓";
      default:
        return "👤";
    }
  };

  const viewProfile = useCallback((profile: EditableProfile) => {
    // Open the profile report page in a new tab
    window.open(`/analytics/reports/p/${profile.id}`, "_blank");
  }, []);

  // Check permissions for actions
  const canDeleteProfile = useCallback(
    (profile: EditableProfile) => {
      // If current user is instructional, they cannot delete other instructional users
      if (
        effectiveProfile?.role === "instructional" &&
        profile.role === "instructional"
      ) {
        return false;
      }
      return true;
    },
    [effectiveProfile]
  );

  const canViewProfile = useCallback((profile: EditableProfile) => {
    // Instructional users cannot be viewed
    return profile.role !== "instructional";
  }, []);

  // Define table columns for filtering and pagination
  const columns: ColumnDef<EditableProfile>[] = [
    {
      accessorKey: "firstName",
      header: "Name",
    },
    {
      accessorKey: "role",
      header: "Role",
      accessorFn: (row) => {
        // Create a sortable value that prioritizes instructional > new > TA
        const isNew = "isNew" in row && row.isNew;
        if (row.role === "instructional") return "3";
        if (isNew) return "2";
        return "1"; // TA
      },
    },
  ];

  const table = useReactTable({
    data: profiles,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: {
      pagination: {
        pageSize: 10, // Default list view page size
      },
    },
  });

  // Adjust page size based on view mode (grid uses 12 per page)
  useEffect(() => {
    if (viewMode === "grid") {
      if (table.getState().pagination.pageSize !== 12) {
        table.setPageSize(12);
        table.setPageIndex(0);
      }
    } else {
      if (table.getState().pagination.pageSize !== 10) {
        table.setPageSize(10);
        table.setPageIndex(0);
      }
    }
  }, [viewMode, table]);

  // Check if any filters are active
  const isFiltered = table.getState().columnFilters.length > 0;

  const firstNameColumn = table.getColumn("firstName");
  const roleColumn = table.getColumn("role");

  // Get filtered and paginated data
  const filteredProfiles = table.getRowModel().rows.map((row) => row.original);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Label>Staff</Label>

        {/* Enhanced Header with Data Table Toolbar Features */}
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center space-x-2 flex-wrap">
            <div className="mb-2">
              <Input
                placeholder="Search staff by name or alias..."
                value={(firstNameColumn?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  firstNameColumn?.setFilterValue(event.target.value)
                }
                className="h-8 w-[150px] lg:w-[250px]"
              />
            </div>

            <div className="flex items-center space-x-2 flex-wrap mb-2">
              {/* Role Filter */}
              {roleColumn && roleOptions.length > 0 && (
                <DataTableFacetedFilter
                  column={roleColumn}
                  title="Role"
                  options={roleOptions}
                />
              )}

              {isFiltered && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => table.resetColumnFilters()}
                  className="h-8 px-2 lg:px-3"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 mb-2">
            {/* View Toggle */}
            <div className="flex border rounded-md">
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="rounded-r-none"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="rounded-l-none border-l"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>

            {/* Add Staff Button (opens dialog) */}
            {!isReadonly && (
              <Dialog
                open={isAddStaffDialogOpen}
                onOpenChange={setIsAddStaffDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button type="button" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Staff
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Staff to Cohort</DialogTitle>
                    <DialogDescription hidden>
                      Upload via CSV, search existing profiles, or add one
                      manually.
                    </DialogDescription>
                  </DialogHeader>
                  <StaffManager
                    cohortId={"cohort"}
                    onAddProfiles={(newProfiles) =>
                      handleAddProfiles(newProfiles)
                    }
                    existingProfileIds={profiles.map((p) => p.id)}
                    onDone={() => setIsAddStaffDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Profiles Display Area */}
        {isLoading ? (
          <Skeleton className="h-[200px] rounded-lg" />
        ) : (
          <div
            className={cn(
              "min-h-[200px] rounded-lg",
              filteredProfiles.length === 0 ? "border-2 border-dashed" : ""
            )}
          >
            {filteredProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground mb-2">
                  {profiles.length === 0
                    ? "No staff yet"
                    : "No staff match your filters"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {profiles.length === 0
                    ? "Upload a CSV file or add staff manually to get started"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
            ) : (
              <div className="p-4">
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredProfiles.map((profile) => {
                      const isNewProfile = "isNew" in profile && profile.isNew;
                      return (
                        <div
                          key={profile.id}
                          className={cn(
                            "group relative border rounded-lg hover:shadow-md transition-all",
                            isNewProfile && "border-blue-300 bg-blue-50/50"
                          )}
                        >
                          {/* Role display in top left */}
                          <div className="absolute top-2 left-2 z-10">
                            {profile.role === "instructional" && (
                              <Badge variant="default">INSTRUCTIONAL</Badge>
                            )}
                          </div>

                          {/* Action buttons in top right */}
                          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canViewProfile(profile) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
                                    onClick={() => viewProfile(profile)}
                                  >
                                    <FileText className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Reports</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {canDeleteProfile(profile) && !isReadonly && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive bg-white/90 backdrop-blur-sm"
                                    data-testid={`remove-profile-${profile.id}`}
                                    onClick={() =>
                                      stageProfileForDeletion(profile.id)
                                    }
                                  >
                                    <UserMinus className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Remove from Cohort</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>

                          {/* Profile area */}
                          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative">
                            <div className="text-center">
                              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <span className="text-2xl">
                                  {getProfileRoleIcon(profile.role)}
                                </span>
                              </div>
                              <p className="text-sm font-medium truncate px-2">
                                {profile.firstName} {profile.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate px-2">
                                {profile.alias}
                              </p>
                            </div>
                            {isNewProfile && (
                              <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 py-0.5 rounded text-[10px]">
                                NEW
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredProfiles.map((profile) => {
                      const isNewProfile = "isNew" in profile && profile.isNew;
                      return (
                        <div
                          key={profile.id}
                          className={cn(
                            "flex items-center gap-4 p-3 border rounded-lg hover:shadow-sm transition-all",
                            isNewProfile && "border-blue-300 bg-blue-50/50"
                          )}
                        >
                          <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">
                              {getProfileRoleIcon(profile.role)}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">
                                {profile.firstName} {profile.lastName}
                              </p>
                              {profile.role === "instructional" && (
                                <Badge variant="default" className="text-xs">
                                  INSTRUCTIONAL
                                </Badge>
                              )}
                              {isNewProfile && (
                                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">
                                  NEW
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {profile.alias}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {canViewProfile(profile) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => viewProfile(profile)}
                                  >
                                    <FileText className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View Reports</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {canDeleteProfile(profile) && !isReadonly && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    data-testid={`remove-profile-${profile.id}`}
                                    onClick={() =>
                                      stageProfileForDeletion(profile.id)
                                    }
                                  >
                                    <UserMinus className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Remove from Cohort</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pagination Footer */}
        {filteredProfiles.length > 0 && (
          <DataTablePagination table={table} card={viewMode === "grid"} />
        )}
      </div>
    </TooltipProvider>
  );
}
