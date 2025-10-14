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
import {
  useBulkDeleteStaff,
  useBulkUpdateStaff,
  useDeleteStaff,
  useStaffDetailBulk,
  useStaffList,
} from "@/lib/api/v2/hooks/staff";
import type { StaffItem } from "@/lib/api/v2/schemas/staff";
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
    StaffItem[]
  >([]);
  const { effectiveProfile } = useProfile();
  const { effectiveDepartmentIds } = useDepartments();

  // V2 API hooks
  const filters = React.useMemo(
    () => ({
      departmentIds: effectiveDepartmentIds,
      profileId: effectiveProfile?.id || "",
    }),
    [effectiveDepartmentIds, effectiveProfile?.id]
  );

  const { data: staffData, isLoading } = useStaffList(
    filters,
    !!effectiveProfile?.id
  );

  // Mutation hooks
  const deleteStaffMutation = useDeleteStaff();
  const bulkDeleteStaffMutation = useBulkDeleteStaff();
  const bulkUpdateStaffMutation = useBulkUpdateStaff();

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
    React.useState<StaffItem | null>(null);

  // Bulk edit detail hook
  const { data: bulkStaffDetail } = useStaffDetailBulk(
    selectedStaffIds,
    effectiveProfile?.id || "",
    selectedStaffIds.length > 0 && !!effectiveProfile?.id
  );

  // Extract data from V2 API response
  const staff = React.useMemo(() => staffData?.staff || [], [staffData?.staff]);
  const cohortMapping = React.useMemo(
    () => staffData?.cohort_mapping || {},
    [staffData?.cohort_mapping]
  );

  // Listen for layout "Create Staff" button broadcast
  React.useEffect(() => {
    const openModal = () => setShowCreateModal(true);
    window.addEventListener("openCreateStaff", openModal);
    return () => window.removeEventListener("openCreateStaff", openModal);
  }, []);

  // Filter staff users based on current user's role (done server-side now)

  // Get role and activity counts for summary
  const counts = React.useMemo(() => {
    const activeStaff = staff.filter((s) => s.active);
    const inactiveStaff = staff.filter((s) => !s.active);

    return {
      total: staff.length,
      active: activeStaff.length,
      inactive: inactiveStaff.length,
      instructional: staff.filter((s) => s.role === "instructional").length,
      ta: staff.filter((s) => s.role === "ta").length,
      admin: staff.filter((s) => s.role === "admin").length,
      superadmin: staff.filter((s) => s.role === "superadmin").length,
      guest: staff.filter((s) => s.role === "guest").length,
    };
  }, [staff]);

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
    let filteredStaff: StaffItem[] = [];
    let title = "";

    switch (filterType) {
      case "active":
        filteredStaff = staff.filter((s) => s.active);
        title = `Active Staff Members (${filteredStaff.length})`;
        break;
      case "admin":
        if (effectiveProfile?.role === "superadmin") {
          // For superadmins, show both superadmins and admins
          filteredStaff = staff.filter(
            (s) => s.role === "superadmin" || s.role === "admin"
          );
          title = `Superadmins/Admins (${filteredStaff.length})`;
        } else {
          // For admins, show only admins
          filteredStaff = staff.filter((s) => s.role === "admin");
          title = `Administrators (${filteredStaff.length})`;
        }
        break;
      case "instructional":
        filteredStaff = staff.filter((s) => s.role === "instructional");
        title = `Instructional Staff (${filteredStaff.length})`;
        break;
      case "ta":
        filteredStaff = staff.filter((s) => s.role === "ta");
        title = `Teaching Assistants (${filteredStaff.length})`;
        break;
      default:
        return;
    }

    setDialogTitle(title);
    setDialogStaffMembers(filteredStaff);
    setDialogOpen(true);
  };

  // Filter options (inline)
  const roleOptions = React.useMemo(() => {
    const baseOptions = [
      { value: "instructional", label: "Instructional Staff" },
      { value: "ta", label: "Teaching Assistant" },
      { value: "guest", label: "Guest" },
    ];

    if (
      effectiveProfile?.role === "admin" ||
      effectiveProfile?.role === "superadmin"
    ) {
      baseOptions.unshift({ value: "admin", label: "Administrator" });
    }

    if (effectiveProfile?.role === "superadmin") {
      baseOptions.unshift({
        value: "superadmin",
        label: "Super Administrator",
      });
    }

    return baseOptions;
  }, [effectiveProfile?.role]);

  const cohortOptions = React.useMemo(() => {
    return Object.entries(cohortMapping).map(([id, item]) => ({
      value: id,
      label: item.name,
    }));
  }, [cohortMapping]);

  const activityOptions = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ];

  const lastActiveOptions = [
    { value: "recent", label: "Recently Active (< 7 days)" },
    { value: "moderate", label: "Moderately Active (7-30 days)" },
    { value: "old", label: "Inactive (> 30 days)" },
    { value: "never", label: "Never Active" },
  ];

  if (isLoading) {
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
        data={staff}
        cohortMapping={cohortMapping}
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
        onPreview={(staffMember) => {
          window.open(
            `/analytics/reports/p/${staffMember.profile_id}`,
            "_blank",
            "noopener,noreferrer"
          );
        }}
        onEdit={(staffMember) => setEditProfileId(staffMember.profile_id)}
        onDelete={(staffMember) => {
          setDeleteStaffMember(staffMember);
          setShowSingleDeleteDialog(true);
        }}
        onBulkEdit={() => setShowBulkEditModal(true)}
        onBulkDelete={() => setShowBulkDeleteDialog(true)}
        canDelete={(profileId) => {
          const row = staff.find((s) => s.profile_id === profileId);
          return row?.can_delete ?? false;
        }}
        deletableCount={
          selectedStaffIds.filter((id) => {
            const row = staff.find((s) => s.profile_id === id);
            return row?.can_delete ?? false;
          }).length
        }
        editableCount={
          selectedStaffIds.filter((id) => {
            const row = staff.find((s) => s.profile_id === id);
            return row?.can_edit ?? false;
          }).length
        }
        canEdit={(profileId) => {
          const row = staff.find((s) => s.profile_id === profileId);
          return row?.can_edit ?? false;
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
            {effectiveProfile?.role === "superadmin" && bulkStaffDetail && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <DepartmentSelector
                  departmentMapping={bulkStaffDetail.department_mapping}
                  selectedDepartmentId={
                    bulkDepartmentId || bulkStaffDetail.department_ids[0] || ""
                  }
                  validDepartmentIds={bulkStaffDetail.valid_department_ids}
                  onSelect={(deptId) => setBulkDepartmentId(deptId)}
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

                try {
                  const updates: {
                    profileIds: string[];
                    role?: string;
                    requests_per_day?: number | null;
                    department_id?: string;
                  } = {
                    profileIds: selectedStaffIds,
                  };

                  if (bulkRole !== "__keep__") {
                    updates.role = bulkRole;
                  }

                  if (bulkUnlimited) {
                    updates.requests_per_day = null;
                  } else if (bulkReqPerDay !== "") {
                    const num = Number(bulkReqPerDay);
                    updates.requests_per_day = Number.isNaN(num) ? null : num;
                  }

                  if (bulkDepartmentId) {
                    updates.department_id = bulkDepartmentId;
                  }

                  await bulkUpdateStaffMutation.mutateAsync(updates);
                  toast.success("Staff updated successfully");
                  setShowBulkEditModal(false);
                  setSelectedStaffIds([]);
                  setBulkRole("__keep__");
                  setBulkReqPerDay("");
                  setBulkUnlimited(false);
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
            const selected = staff.filter((s) =>
              selectedStaffIds.includes(s.profile_id)
            );
            const nonDeletable = selected.filter((s) => !s.can_delete);
            const deletable = selected.filter((s) => s.can_delete);
            const impactedCohorts = deletable.map((s) => ({
              staff: s,
              cohortCount: s.cohort_ids.length,
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
                        {impactedCohorts.map(({ staff, cohortCount }) => (
                          <li
                            key={staff.profile_id}
                            className="text-red-600 dark:text-red-300"
                          >
                            • {staff.first_name} {staff.last_name} (
                            {staff.alias}){" "}
                            {cohortCount > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                – affects {cohortCount} cohort
                                {cohortCount > 1 ? "s" : ""}
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
                            key={s.profile_id}
                            className="text-yellow-700 dark:text-yellow-300"
                          >
                            • {s.first_name} {s.last_name} ({s.alias})
                            {s.profile_id === effectiveProfile?.id
                              ? " – your account"
                              : s.default_profile
                                ? " – default profile"
                                : " – cannot delete"}
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
                  const deletableIds = staff
                    .filter(
                      (s) =>
                        selectedStaffIds.includes(s.profile_id) && s.can_delete
                    )
                    .map((s) => s.profile_id);
                  if (deletableIds.length === 0) {
                    setShowBulkDeleteDialog(false);
                    return;
                  }
                  await bulkDeleteStaffMutation.mutateAsync({
                    profileIds: deletableIds,
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
              Delete {deleteStaffMember?.first_name}{" "}
              {deleteStaffMember?.last_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the account. Default profiles and
              your own account cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteStaffMember &&
            (() => {
              const staffMember = deleteStaffMember;
              const canDelete = staffMember.can_delete;
              const cohortCount = staffMember.cohort_ids.length;

              if (!canDelete) {
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-yellow-700 dark:text-yellow-400">
                        This account cannot be deleted:
                      </p>
                      <div className="mt-1 ml-4 border rounded-md p-2 bg-gray-50 dark:bg-gray-900">
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          • {staffMember.first_name} {staffMember.last_name} (
                          {staffMember.alias})
                          {staffMember.profile_id === effectiveProfile?.id
                            ? " – your account"
                            : staffMember.default_profile
                              ? " – default profile"
                              : " – cannot delete"}
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
                          • {staffMember.first_name} {staffMember.last_name} (
                          {staffMember.alias}){" "}
                          {cohortCount > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              – affects {cohortCount} cohort
                              {cohortCount > 1 ? "s" : ""}
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

                if (!deleteStaffMember.can_delete) {
                  toast.error("This user cannot be deleted");
                  setShowSingleDeleteDialog(false);
                  setDeleteStaffMember(null);
                  return;
                }

                try {
                  await deleteStaffMutation.mutateAsync({
                    profileId: deleteStaffMember.profile_id,
                  });
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
