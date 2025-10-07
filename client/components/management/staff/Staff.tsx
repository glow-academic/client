/**
 * Staff.tsx
 * Used to display the staff page with faceted filters and data table.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { DepartmentSelector } from "@/components/common/forms/DepartmentSelector";
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
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { StaffData, useStaffColumns } from "@/hooks/use-staff-columns";
import { useCohortsByDepartmentIdBatch } from "@/lib/api/hooks/cohorts";
import { useDepartments as useDepartmentsHook } from "@/lib/api/hooks/departments";
import { useModelRunsByProfileIdBatch } from "@/lib/api/hooks/model_runs";
import {
  useDeleteProfile,
  useDeleteProfiles,
  useProfiles,
  useUpdateProfiles,
} from "@/lib/api/hooks/profiles";
import { Profile } from "@/types";
import { Activity, Shield, User as UserIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import NewStaff from "./NewStaff";
import { StaffDataTable } from "./StaffDataTable";
import StaffEdit from "./StaffEdit";
import { StaffFilterDialog } from "./StaffFilterDialog";

export default function Staff() {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogTitle, setDialogTitle] = React.useState("");
  const [dialogStaffMembers, setDialogStaffMembers] = React.useState<
    StaffData[]
  >([]);
  const { effectiveProfile } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();

  // Mutation hooks
  const deleteProfileMutation = useDeleteProfile();
  const deleteProfilesMutation = useDeleteProfiles();
  const updateProfilesMutation = useUpdateProfiles();

  // Selection
  const [selectedStaffIds, setSelectedStaffIds] = React.useState<string[]>([]);

  // Create modal
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Edit modal
  const [editProfileId, setEditProfileId] = React.useState<string | null>(null);

  // Bulk edit modal state
  const [showBulkEditModal, setShowBulkEditModal] = React.useState(false);
  const [bulkRole, setBulkRole] = React.useState<string>("__keep__");
  const [bulkReqPerDay, setBulkReqPerDay] = React.useState<string>("");
  const [bulkUnlimited, setBulkUnlimited] = React.useState<boolean>(false);
  const [bulkDepartmentId, setBulkDepartmentId] = React.useState<string | null>(
    null
  );

  // Bulk delete dialog
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = React.useState(false);

  // Single delete dialog
  const [showSingleDeleteDialog, setShowSingleDeleteDialog] =
    React.useState(false);
  const [deleteStaffMember, setDeleteStaffMember] =
    React.useState<StaffData | null>(null);

  const { data: allProfiles = [], isLoading: isLoadingProfiles } =
    useProfiles();
  const { data: allCohorts = [], isLoading: isLoadingCohorts } =
    useCohortsByDepartmentIdBatch(effectiveDepartmentIds);
  const { data: departments = [] } = useDepartmentsHook();

  const { data: recentRuns = [] } = useModelRunsByProfileIdBatch(
    allProfiles.map((p: Profile) => p.id)
  );

  // Listen for layout "Create Staff" button broadcast
  React.useEffect(() => {
    const openModal = () => setShowCreateModal(true);
    window.addEventListener("openCreateStaff", openModal);
    return () => window.removeEventListener("openCreateStaff", openModal);
  }, []);

  // Filter staff users based on current user's role
  const staffUsers = React.useMemo(() => {
    const isCurrentUserSuperadmin = effectiveProfile?.role === "superadmin";
    const isCurrentUserAdmin = effectiveProfile?.role === "admin";

    // Define which roles to include based on current user's role
    let allowedRoles = ["instructional", "ta"];

    if (isCurrentUserSuperadmin) {
      // Superadmins can see superadmins, admins, instructional, ta, and guest
      allowedRoles = ["superadmin", "admin", "instructional", "ta", "guest"];
    } else if (isCurrentUserAdmin) {
      // Admins can see admins, instructional, ta, and guest
      allowedRoles = ["admin", "instructional", "ta", "guest"];
    }

    return allProfiles.filter((profile: Profile) =>
      allowedRoles.includes(profile.role)
    );
  }, [allProfiles, effectiveProfile?.role]);

  // Transform staff data for the table
  const staffData = React.useMemo((): StaffData[] => {
    return staffUsers.map((profile: Profile) => {
      // Find cohorts this user belongs to
      const userCohorts = allCohorts.filter((cohort) =>
        cohort.profileIds.includes(profile.id)
      );

      // Compute requests in last 24h for this profile
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;
      const used = (
        recentRuns as Array<{ profileId?: string; createdAt?: string }>
      ).filter(
        (r) =>
          r.profileId === profile.id &&
          r.createdAt &&
          new Date(r.createdAt).getTime() >= dayAgo
      ).length;

      return {
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        alias: profile.alias,
        role: profile.role,
        active: profile.active,
        lastActive: profile.lastActive,
        email: `${profile.alias}@${process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}`,
        cohortIds: userCohorts.map((cohort) => cohort.id),
        cohortNames: userCohorts.map((cohort) => cohort.title),
        lastActiveFormatted: formatLastActive(profile.lastActive),
        roleDisplayName: getRoleDisplayName(profile.role),
        defaultProfile: Boolean(
          (profile as unknown as { defaultProfile?: boolean }).defaultProfile
        ),
        reqPerDay:
          (profile as unknown as { reqPerDay?: number | null }).reqPerDay ??
          null,
        requestsInLastDay: used,
      };
    });
  }, [staffUsers, allCohorts, recentRuns]);

  // Get role and activity counts for summary
  const counts = React.useMemo(() => {
    const activeStaff = staffUsers.filter((profile: Profile) => profile.active);
    const inactiveStaff = staffUsers.filter(
      (profile: Profile) => !profile.active
    );

    const baseCounts = {
      total: staffUsers.length,
      active: activeStaff.length,
      inactive: inactiveStaff.length,
      instructional: staffUsers.filter(
        (profile: Profile) => profile.role === "instructional"
      ).length,
      ta: staffUsers.filter((profile: Profile) => profile.role === "ta").length,
      admin: staffUsers.filter((profile: Profile) => profile.role === "admin")
        .length,
      superadmin: staffUsers.filter(
        (profile: Profile) => profile.role === "superadmin"
      ).length,
      guest: staffUsers.filter((profile: Profile) => profile.role === "guest")
        .length,
    };

    // Always return base counts (all properties are included)
    return baseCounts;
  }, [staffUsers]);

  const handleEditUser = (profileId: string) => {
    // Open modal for in-place edit
    setEditProfileId(profileId);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Force refetch of profiles data
      await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay for UX
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle card clicks to show filtered staff
  const handleCardClick = (filterType: string) => {
    let filteredStaff: StaffData[] = [];
    let title = "";

    switch (filterType) {
      case "active":
        filteredStaff = staffData.filter((staff) => staff.active);
        title = `Active Staff Members (${filteredStaff.length})`;
        break;
      case "admin":
        if (effectiveProfile?.role === "superadmin") {
          // For superadmins, show both superadmins and admins
          filteredStaff = staffData.filter(
            (staff) => staff.role === "superadmin" || staff.role === "admin"
          );
          title = `Superadmins/Admins (${filteredStaff.length})`;
        } else {
          // For admins, show only admins
          filteredStaff = staffData.filter((staff) => staff.role === "admin");
          title = `Administrators (${filteredStaff.length})`;
        }
        break;
      case "instructional":
        filteredStaff = staffData.filter(
          (staff) => staff.role === "instructional"
        );
        title = `Instructional Staff (${filteredStaff.length})`;
        break;
      case "ta":
        filteredStaff = staffData.filter((staff) => staff.role === "ta");
        title = `Teaching Assistants (${filteredStaff.length})`;
        break;
      default:
        return;
    }

    setDialogTitle(title);
    setDialogStaffMembers(filteredStaff);
    setDialogOpen(true);
  };

  const {
    columns,
    roleOptions,
    cohortOptions,
    activityOptions,
    lastActiveOptions,
  } = useStaffColumns({
    onEditUser: handleEditUser,
    currentUserRole: effectiveProfile?.role,
  });

  // Helper functions
  function formatLastActive(timestamp: string | null) {
    if (!timestamp) return "Never";

    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  }

  function getRoleDisplayName(role: string) {
    switch (role) {
      case "superadmin":
        return "Super Administrator";
      case "admin":
        return "Administrator";
      case "instructional":
        return "Instructional Staff";
      case "ta":
        return "Teaching Assistant";
      case "guest":
        return "Guest";
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  }

  if (isLoadingProfiles || isLoadingCohorts) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading staff members...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with summary stats - reduced to 4 cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick("active")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{counts.active}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick("admin")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-600" />
              <div>
                <p className="text-2xl font-bold">
                  {effectiveProfile?.role === "superadmin"
                    ? (counts.superadmin || 0) + (counts.admin || 0)
                    : counts.admin}
                </p>
                <p className="text-sm text-muted-foreground">
                  {effectiveProfile?.role === "superadmin"
                    ? "Superadmins/Admins"
                    : "Admins"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick("instructional")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{counts.instructional}</p>
                <p className="text-sm text-muted-foreground">Instructional</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleCardClick("ta")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{counts.ta}</p>
                <p className="text-sm text-muted-foreground">TAs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Data Table */}
      <StaffDataTable
        columns={columns}
        data={staffData}
        roleOptions={roleOptions}
        cohortOptions={cohortOptions}
        activityOptions={activityOptions}
        lastActiveOptions={lastActiveOptions}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        selectedStaffIds={selectedStaffIds}
        onStaffSelect={(id, checked) =>
          setSelectedStaffIds((prev) =>
            checked ? [...prev, id] : prev.filter((x) => x !== id)
          )
        }
        onSelectAll={(checked, visibleRowIds) => {
          if (checked && visibleRowIds) {
            // Select all visible rows
            setSelectedStaffIds((prev) => {
              const newSelection = [...prev];
              visibleRowIds.forEach((id) => {
                if (!newSelection.includes(id)) {
                  newSelection.push(id);
                }
              });
              return newSelection;
            });
          } else {
            // Deselect all visible rows
            setSelectedStaffIds((prev) =>
              prev.filter((id) => !visibleRowIds?.includes(id))
            );
          }
        }}
        onCreate={() => setShowCreateModal(true)}
        onPreview={(staff) => {
          window.open(
            `/analytics/reports/p/${staff.id}`,
            "_blank",
            "noopener,noreferrer"
          );
        }}
        onEdit={(staff) => setEditProfileId(staff.id)}
        onDelete={(staff) => {
          setDeleteStaffMember(staff);
          setShowSingleDeleteDialog(true);
        }}
        onBulkEdit={() => setShowBulkEditModal(true)}
        onBulkDelete={() => setShowBulkDeleteDialog(true)}
        canDelete={(profileId) => {
          const row = staffData.find((s) => s.id === profileId);
          if (!row) return false;
          // Admin cannot delete self, other admins, or superadmins
          if (effectiveProfile?.role === "admin") {
            if (row.id === effectiveProfile.id) return false;
            if (row.role === "admin" || row.role === "superadmin") return false;
          }
          // Superadmin cannot delete self
          if (
            effectiveProfile?.role === "superadmin" &&
            row.id === effectiveProfile.id
          ) {
            return false;
          }
          return !row.defaultProfile;
        }}
        deletableCount={
          selectedStaffIds.filter((id) => {
            const row = staffData.find((s) => s.id === id);
            if (!row) return false;
            if (effectiveProfile?.role === "admin") {
              if (row.id === effectiveProfile.id) return false;
              if (row.role === "admin" || row.role === "superadmin")
                return false;
            }
            if (
              effectiveProfile?.role === "superadmin" &&
              row.id === effectiveProfile.id
            ) {
              return false;
            }
            return !row.defaultProfile;
          }).length
        }
        editableCount={
          selectedStaffIds.filter((id) => {
            const row = staffData.find((s) => s.id === id);
            if (!row) return false;
            if (effectiveProfile?.role === "superadmin") return true;
            if (row.defaultProfile) return false;
            if (effectiveProfile?.role === "admin") {
              if (
                (row.role === "admin" || row.role === "superadmin") &&
                row.id !== effectiveProfile.id
              ) {
                return false;
              }
            }
            return true;
          }).length
        }
        canEdit={(profileId) => {
          const row = staffData.find((s) => s.id === profileId);
          if (!row) return false;
          if (effectiveProfile?.role === "superadmin") return true;
          if (row.defaultProfile) return false;
          if (effectiveProfile?.role === "admin") {
            if (
              (row.role === "admin" || row.role === "superadmin") &&
              row.id !== effectiveProfile.id
            ) {
              return false;
            }
          }
          return true;
        }}
      />

      {/* Staff Filter Dialog */}
      <StaffFilterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        staffMembers={dialogStaffMembers}
        onEditUser={handleEditUser}
      />

      {/* Listen for layout create button */}
      {/* Hook declared normally to satisfy Rules of Hooks */}

      {/* Create Staff Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create Staff</DialogTitle>
          </DialogHeader>
          <NewStaff
            onDone={() => {
              setShowCreateModal(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Staff Modal */}
      <Dialog
        open={!!editProfileId}
        onOpenChange={(open) => !open && setEditProfileId(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          {editProfileId && (
            <StaffEdit
              profileId={editProfileId}
              hideDelete={true}
              hideBack={true}
              redirectOnSuccess={false}
              canToggleDefault={effectiveProfile?.role === "superadmin"}
              onDone={() => {
                setEditProfileId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Modal */}
      <Dialog open={showBulkEditModal} onOpenChange={setShowBulkEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {selectedStaffIds.length} staff
              {selectedStaffIds.length > 1 ? "" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={bulkRole} onValueChange={(v) => setBulkRole(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep existing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__keep__">Keep existing</SelectItem>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Requests per day</Label>

              <Input
                type="number"
                placeholder="Leave blank to keep existing"
                value={bulkReqPerDay}
                onChange={(e) => setBulkReqPerDay(e.target.value)}
                min={1}
                disabled={bulkUnlimited}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulk-unlimited"
                  checked={bulkUnlimited}
                  onCheckedChange={(checked) => {
                    const isChecked = Boolean(checked);
                    setBulkUnlimited(isChecked);
                    if (isChecked) setBulkReqPerDay("");
                  }}
                />
                <Label htmlFor="bulk-unlimited" className="mb-0">
                  Unlimited
                </Label>
              </div>
            </div>

            {/* Department Selection - Only for superadmin */}
            {effectiveProfile?.role === "superadmin" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <DepartmentSelector
                  departments={departments.map((dept) => ({
                    id: dept.id,
                    title: dept.title as string,
                    ...(dept.description && { description: dept.description }),
                  }))}
                  selectedDepartment={
                    bulkDepartmentId
                      ? (() => {
                          const dept = departments.find(
                            (d) => d.id === bulkDepartmentId
                          );
                          return dept
                            ? {
                                id: dept.id,
                                title: dept.title as string,
                                ...(dept.description && {
                                  description: dept.description,
                                }),
                              }
                            : null;
                        })()
                      : null
                  }
                  onSelect={(department) =>
                    setBulkDepartmentId(department?.id || null)
                  }
                  placeholder="Select department"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBulkEditModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (selectedStaffIds.length === 0) return;

                // Department validation for superadmin
                if (
                  effectiveProfile?.role === "superadmin" &&
                  !bulkDepartmentId
                ) {
                  toast.error(
                    "Department selection is required for superadmin users"
                  );
                  return;
                }

                const updates: Record<string, unknown> = {
                  updatedAt: new Date().toISOString(),
                };
                if (bulkRole !== "__keep__") updates["role"] = bulkRole;
                if (bulkUnlimited) {
                  updates["reqPerDay"] = null;
                } else if (bulkReqPerDay !== "") {
                  const num = Number(bulkReqPerDay);
                  updates["reqPerDay"] = Number.isNaN(num) ? null : num;
                }
                if (bulkDepartmentId)
                  updates["departmentId"] = bulkDepartmentId;
                try {
                  if (Object.keys(updates).length > 0) {
                    // Use bulk update for efficiency
                    await updateProfilesMutation.mutateAsync({
                      updates: selectedStaffIds.map((profileId) => ({
                        id: profileId,
                        ...(updates as { [key: string]: unknown }),
                      })),
                    });
                  }
                  toast.success("Staff updated successfully");
                  setShowBulkEditModal(false);
                  setSelectedStaffIds([]);
                  setBulkRole("__keep__");
                  setBulkReqPerDay("");
                  setBulkDepartmentId(null);
                } catch {
                  toast.error("Failed to update staff");
                }
              }}
            >
              Apply Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedStaffIds.length} staff member
              {selectedStaffIds.length !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected accounts. Default
              profiles and your own account will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            const selected = staffData.filter((s) =>
              selectedStaffIds.includes(s.id)
            );
            const nonDeletable = selected.filter(
              (s) => s.defaultProfile || s.id === effectiveProfile?.id
            );
            const deletable = selected.filter(
              (s) => !s.defaultProfile && s.id !== effectiveProfile?.id
            );
            const impactedCohorts = deletable.map((s) => ({
              staff: s,
              cohorts: allCohorts.filter((c) => c.profileIds.includes(s.id)),
            }));
            return (
              <div className="space-y-3">
                {deletable.length > 0 && (
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      The following accounts and their cohort memberships will
                      be removed:
                    </p>
                    <div className="mt-1 ml-4 max-h-32 overflow-y-auto border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                      <ul className="text-sm space-y-2">
                        {impactedCohorts.map(({ staff, cohorts }) => (
                          <li
                            key={staff.id}
                            className="text-red-600 dark:text-red-300"
                          >
                            • {staff.firstName} {staff.lastName} ({staff.alias}){" "}
                            {cohorts.length > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                – affects {cohorts.length} cohort
                                {cohorts.length > 1 ? "s" : ""}:{" "}
                                {cohorts
                                  .slice(0, 3)
                                  .map((c) => c.title)
                                  .join(", ")}
                                {cohorts.length > 3
                                  ? `, +${cohorts.length - 3} more`
                                  : ""}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                – no cohort memberships
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {nonDeletable.length > 0 && (
                  <div>
                    <p className="font-medium text-yellow-700 dark:text-yellow-400">
                      The following accounts cannot be deleted and will be
                      skipped:
                    </p>
                    <div className="mt-1 ml-4 max-h-24 overflow-y-auto border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                      <ul className="text-sm space-y-1">
                        {nonDeletable.map((s) => (
                          <li
                            key={s.id}
                            className="text-yellow-700 dark:text-yellow-300"
                          >
                            • {s.firstName} {s.lastName} ({s.alias})
                            {s.id === effectiveProfile?.id
                              ? " – your account"
                              : " – default profile"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                try {
                  const deletableIds = staffData
                    .filter(
                      (s) =>
                        selectedStaffIds.includes(s.id) &&
                        !s.defaultProfile &&
                        s.id !== effectiveProfile?.id
                    )
                    .map((s) => s.id);
                  if (deletableIds.length === 0) {
                    setShowBulkDeleteDialog(false);
                    return;
                  }
                  // Use bulk delete for efficiency
                  await deleteProfilesMutation.mutateAsync({
                    ids: deletableIds,
                  });
                  toast.success("Selected staff deleted");
                  setSelectedStaffIds([]);
                  setShowBulkDeleteDialog(false);
                } catch {
                  toast.error("Failed to delete selected staff");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Confirmation */}
      <AlertDialog
        open={showSingleDeleteDialog}
        onOpenChange={setShowSingleDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteStaffMember?.firstName}{" "}
              {deleteStaffMember?.lastName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the account. Default profiles and
              your own account cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteStaffMember &&
            (() => {
              const staff = deleteStaffMember;
              const canDelete =
                !staff.defaultProfile && staff.id !== effectiveProfile?.id;
              const cohorts = allCohorts.filter((c) =>
                c.profileIds.includes(staff.id)
              );

              if (!canDelete) {
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-yellow-700 dark:text-yellow-400">
                        This account cannot be deleted:
                      </p>
                      <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          • {staff.firstName} {staff.lastName} ({staff.alias})
                          {staff.id === effectiveProfile?.id
                            ? " – your account"
                            : " – default profile"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-red-700 dark:text-red-400">
                      The following account and its cohort memberships will be
                      removed:
                    </p>
                    <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                      <ul className="text-sm space-y-2">
                        <li className="text-red-600 dark:text-red-300">
                          • {staff.firstName} {staff.lastName} ({staff.alias}){" "}
                          {cohorts.length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              – affects {cohorts.length} cohort
                              {cohorts.length > 1 ? "s" : ""}:{" "}
                              {cohorts
                                .slice(0, 3)
                                .map((c) => c.title)
                                .join(", ")}
                              {cohorts.length > 3
                                ? `, +${cohorts.length - 3} more`
                                : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              – no cohort memberships
                            </span>
                          )}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (!deleteStaffMember) return;

                if (
                  deleteStaffMember.defaultProfile ||
                  deleteStaffMember.id === effectiveProfile?.id
                ) {
                  toast.error(
                    deleteStaffMember.id === effectiveProfile?.id
                      ? "You cannot delete your own account."
                      : "Default profiles cannot be deleted."
                  );
                  setShowSingleDeleteDialog(false);
                  setDeleteStaffMember(null);
                  return;
                }

                try {
                  await deleteProfileMutation.mutateAsync(deleteStaffMember.id);
                  toast.success("User deleted successfully");
                  setShowSingleDeleteDialog(false);
                  setDeleteStaffMember(null);
                } catch {
                  toast.error("Failed to delete user");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
