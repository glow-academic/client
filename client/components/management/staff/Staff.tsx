/**
 * Staff.tsx
 * Used to display the staff page with faceted filters and data table.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
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
import { useProfile } from "@/contexts/profile-context";
import { StaffData, useStaffColumns } from "@/hooks/use-staff-columns";
import { Profile } from "@/types";
import { deleteProfiles } from "@/utils/mutations/profiles/delete-profiles";
import { updateProfiles } from "@/utils/mutations/profiles/update-profiles";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getModelRunsByProfiles } from "@/utils/queries/model_runs/get-model-runs-by-profiles";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Shield, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const _router = useRouter();
  const { effectiveProfile } = useProfile();
  const queryClient = useQueryClient();

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

  // Bulk delete dialog
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = React.useState(false);

  // Fetch all users and cohorts
  const { data: allProfiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: allCohorts = [], isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Fetch model runs for visible profiles to compute last-24h usage
  const { data: recentRuns = [] } = useQuery({
    queryKey: ["modelRuns", allProfiles.map((p: Profile) => p.id)],
    queryFn: () =>
      getModelRunsByProfiles(allProfiles.map((p: Profile) => p.id)),
    enabled: allProfiles.length > 0,
  });

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
  function formatLastActive(timestamp: string) {
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
        onSelectAll={(checked) =>
          setSelectedStaffIds(checked ? staffData.map((s) => s.id) : [])
        }
        onCreate={() => setShowCreateModal(true)}
        onPreview={(staff) => {
          window.open(
            `/analytics/reports/p/${staff.id}`,
            "_blank",
            "noopener,noreferrer"
          );
        }}
        onEdit={(staff) => setEditProfileId(staff.id)}
        onDelete={async (staff) => {
          if (staff.defaultProfile || staff.id === effectiveProfile?.id) {
            toast.error(
              staff.id === effectiveProfile?.id
                ? "You cannot delete your own account."
                : "Default profiles cannot be deleted."
            );
            return;
          }
          const confirmed = window.confirm(
            `Delete "${staff.firstName} ${staff.lastName}" (${staff.alias}@${process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]})? This action cannot be undone.`
          );
          if (!confirmed) return;
          try {
            await deleteProfiles([staff.id]);
            toast.success("User deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["profiles"] });
          } catch {
            toast.error("Failed to delete user");
          }
        }}
        onBulkEdit={() => setShowBulkEditModal(true)}
        onBulkDelete={() => setShowBulkDeleteDialog(true)}
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
              queryClient.invalidateQueries({ queryKey: ["profiles"] });
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
              onDone={() => {
                setEditProfileId(null);
                queryClient.invalidateQueries({ queryKey: ["profiles"] });
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
              <Input
                type="number"
                placeholder="Leave blank to keep existing"
                value={bulkReqPerDay}
                onChange={(e) => setBulkReqPerDay(e.target.value)}
                min={1}
                disabled={bulkUnlimited}
              />
            </div>
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
                try {
                  if (Object.keys(updates).length > 0) {
                    await updateProfiles(
                      selectedStaffIds,
                      updates as { [key: string]: unknown }
                    );
                  }
                  toast.success("Staff updated successfully");
                  setShowBulkEditModal(false);
                  setSelectedStaffIds([]);
                  setBulkRole("__keep__");
                  setBulkReqPerDay("");
                  queryClient.invalidateQueries({ queryKey: ["profiles"] });
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
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
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
                  await deleteProfiles(deletableIds);
                  toast.success("Selected staff deleted");
                  setSelectedStaffIds([]);
                  setShowBulkDeleteDialog(false);
                  queryClient.invalidateQueries({ queryKey: ["profiles"] });
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
    </div>
  );
}
