/**
 * Staff.tsx
 * Used to display the staff page with faceted filters and data table.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Card, CardContent } from "@/components/ui/card";
import { StaffData, useStaffColumns } from "@/hooks/use-staff-columns";
import { Profile } from "@/types";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { useQuery } from "@tanstack/react-query";
import { Activity, Shield, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import { StaffDataTable } from "./StaffDataTable";
import { StaffFilterDialog } from "./StaffFilterDialog";

export default function Staff() {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogTitle, setDialogTitle] = React.useState("");
  const [dialogStaffMembers, setDialogStaffMembers] = React.useState<
    StaffData[]
  >([]);
  const router = useRouter();

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

  // Filter staff users (include admin, instructional, ta)
  const staffUsers = React.useMemo(() => {
    return allProfiles.filter((profile: Profile) =>
      ["admin", "instructional", "ta"].includes(profile.role)
    );
  }, [allProfiles]);

  // Transform staff data for the table
  const staffData = React.useMemo((): StaffData[] => {
    return staffUsers.map((profile: Profile) => {
      // Find cohorts this user belongs to
      const userCohorts = allCohorts.filter((cohort) =>
        cohort.profileIds.includes(profile.id)
      );

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
      };
    });
  }, [staffUsers, allCohorts]);

  // Get role and activity counts for summary
  const counts = React.useMemo(() => {
    const activeStaff = staffUsers.filter((profile: Profile) => profile.active);
    const inactiveStaff = staffUsers.filter(
      (profile: Profile) => !profile.active
    );

    return {
      total: staffUsers.length,
      active: activeStaff.length,
      inactive: inactiveStaff.length,
      admin: staffUsers.filter((profile: Profile) => profile.role === "admin")
        .length,
      instructional: staffUsers.filter(
        (profile: Profile) => profile.role === "instructional"
      ).length,
      ta: staffUsers.filter((profile: Profile) => profile.role === "ta").length,
    };
  }, [staffUsers]);

  const handleEditUser = (profileId: string) => {
    router.push(`/management/staff/p/${profileId}`);
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
        filteredStaff = staffData.filter((staff) => staff.role === "admin");
        title = `Administrators (${filteredStaff.length})`;
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
      case "admin":
        return "Administrator";
      case "instructional":
        return "Instructional Staff";
      case "ta":
        return "Teaching Assistant";
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
                <p className="text-2xl font-bold">{counts.admin}</p>
                <p className="text-sm text-muted-foreground">
                  Admins/Superadmins
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
      />

      {/* Staff Filter Dialog */}
      <StaffFilterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogTitle}
        staffMembers={dialogStaffMembers}
        onEditUser={handleEditUser}
      />
    </div>
  );
}
