"use client";
import { DataTableColumnHeader } from "@/components/common/history/DataTableColumnHeader";
import { ColumnDef } from "@tanstack/react-table";
import { Clock, Shield, User as UserIcon } from "lucide-react";
import { useMemo } from "react";

import { useDepartments } from "@/contexts/departments-context";
import { useCohortsByDepartmentIdBatch } from "@/lib/api/hooks/cohorts";

// Enhanced types for the staff data
export interface StaffData {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: string;
  active: boolean;
  lastActive: string | null;
  email: string;
  // Additional fields for filtering
  cohortIds: string[];
  cohortNames: string[];
  lastActiveFormatted: string;
  roleDisplayName: string;
  defaultProfile?: boolean;
  reqPerDay?: number | null;
  requestsInLastDay?: number;
}

export interface UseStaffColumnsProps {
  onEditUser: (profileId: string) => void;
  currentUserRole?: string | undefined;
}

export function useStaffColumns({
  onEditUser,
  currentUserRole,
}: UseStaffColumnsProps) {
  const { effectiveDepartmentIds } = useDepartments();
  const { data: cohorts } = useCohortsByDepartmentIdBatch(
    effectiveDepartmentIds,
  );

  // Create filter options
  const roleOptions = useMemo(() => {
    const baseOptions = [
      {
        value: "instructional",
        label: "Instructional Staff",
      },
      {
        value: "ta",
        label: "Teaching Assistant",
      },
      {
        value: "guest",
        label: "Guest",
      },
    ];

    // Add admin option if current user is admin or superadmin
    if (currentUserRole === "admin" || currentUserRole === "superadmin") {
      baseOptions.unshift({
        value: "admin",
        label: "Administrator",
      });
    }

    // Add superadmin option if current user is superadmin
    if (currentUserRole === "superadmin") {
      baseOptions.unshift({
        value: "superadmin",
        label: "Super Administrator",
      });
    }

    return baseOptions;
  }, [currentUserRole]);

  const cohortOptions = useMemo(() => {
    if (!cohorts) return [];
    return cohorts.map((cohort) => ({
      value: cohort.id,
      label: cohort.title,
    }));
  }, [cohorts]);

  const activityOptions = useMemo(
    () => [
      {
        value: "true",
        label: "Active",
      },
      {
        value: "false",
        label: "Inactive",
      },
    ],
    [],
  );

  const lastActiveOptions = useMemo(
    () => [
      {
        value: "never",
        label: "Never",
      },
      {
        value: "last_hour",
        label: "Last Hour",
      },
      {
        value: "last_2_hours",
        label: "Last 2 Hours",
      },
      {
        value: "last_4_hours",
        label: "Last 4 Hours",
      },
      {
        value: "last_8_hours",
        label: "Last 8 Hours",
      },
      {
        value: "last_12_hours",
        label: "Last 12 Hours",
      },
      {
        value: "today",
        label: "Today",
      },
      {
        value: "last_2_days",
        label: "Last 2 Days",
      },
      {
        value: "last_3_days",
        label: "Last 3 Days",
      },
      {
        value: "last_week",
        label: "Last Week",
      },
      {
        value: "last_2_weeks",
        label: "Last 2 Weeks",
      },
      {
        value: "last_month",
        label: "Last Month",
      },
      {
        value: "last_3_months",
        label: "Last 3 Months",
      },
    ],
    [],
  );

  // Helper function to get initials from name
  const getInitials = (name?: string): string => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "superadmin":
        return Shield;
      case "admin":
        return Shield;
      case "instructional":
        return Shield;
      case "ta":
        return UserIcon;
      default:
        return UserIcon;
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "superadmin":
        return "Super Administrator";
      case "admin":
        return "Administrator";
      case "instructional":
        return "Instructional Staff";
      case "ta":
        return "Teaching Assistant";
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  const formatLastActive = (timestamp: string | null) => {
    if (!timestamp) return "Never";

    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;

    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  // Define columns
  const columns = useMemo(() => {
    const staffColumns: ColumnDef<StaffData>[] = [
      // Staff Member column (merged: name, email, status dot)
      {
        accessorKey: "firstName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Staff Member" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          return (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-full outline outline-muted-foreground flex items-center justify-center text-xs font-medium"
                  style={{ outlineWidth: "1px", outlineStyle: "solid" }}
                >
                  {getInitials(staff.firstName + " " + staff.lastName)}
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">
                    {staff.firstName} {staff.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {staff.alias}@{process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
                  </p>
                </div>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  staff.active ? "bg-green-500" : "bg-gray-400"
                }`}
                title={staff.active ? "Active" : "Inactive"}
              />
            </div>
          );
        },
        enableSorting: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value) return true;
          return (
            staff.firstName.toLowerCase().includes(value.toLowerCase()) ||
            staff.lastName.toLowerCase().includes(value.toLowerCase()) ||
            staff.alias.toLowerCase().includes(value.toLowerCase())
          );
        },
      },

      // Role column
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Role" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const RoleIcon = getRoleIcon(staff.role);
          return (
            <div className="flex items-center gap-2">
              <RoleIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {getRoleDisplayName(staff.role)}
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value || value.length === 0) return true;
          return value.includes(staff.role);
        },
      },

      // (Email and Status merged into Staff Member)

      // Last Active column
      {
        accessorKey: "lastActive",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last Active" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          return (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span className="text-sm">
                {formatLastActive(staff.lastActive)}
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value || value.length === 0) return true;

          // Handle null lastActive
          if (!staff.lastActive) {
            return value.some((filterValue: string) => filterValue === "never");
          }

          const lastActiveDate = new Date(staff.lastActive);
          const now = new Date();

          return value.some((filterValue: string) => {
            switch (filterValue) {
              case "never":
                return false; // Already handled above
              case "last_hour":
                const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
                return lastActiveDate >= hourAgo;
              case "last_2_hours":
                const twoHoursAgo = new Date(
                  now.getTime() - 2 * 60 * 60 * 1000,
                );
                return lastActiveDate >= twoHoursAgo;
              case "last_4_hours":
                const fourHoursAgo = new Date(
                  now.getTime() - 4 * 60 * 60 * 1000,
                );
                return lastActiveDate >= fourHoursAgo;
              case "last_8_hours":
                const eightHoursAgo = new Date(
                  now.getTime() - 8 * 60 * 60 * 1000,
                );
                return lastActiveDate >= eightHoursAgo;
              case "last_12_hours":
                const twelveHoursAgo = new Date(
                  now.getTime() - 12 * 60 * 60 * 1000,
                );
                return lastActiveDate >= twelveHoursAgo;
              case "today":
                return lastActiveDate.toDateString() === now.toDateString();
              case "last_2_days":
                const twoDaysAgo = new Date(
                  now.getTime() - 2 * 24 * 60 * 60 * 1000,
                );
                return lastActiveDate >= twoDaysAgo;
              case "last_3_days":
                const threeDaysAgo = new Date(
                  now.getTime() - 3 * 24 * 60 * 60 * 1000,
                );
                return lastActiveDate >= threeDaysAgo;
              case "last_week":
                const weekAgo = new Date(
                  now.getTime() - 7 * 24 * 60 * 60 * 1000,
                );
                return lastActiveDate >= weekAgo;
              case "last_2_weeks":
                const twoWeeksAgo = new Date(
                  now.getTime() - 14 * 24 * 60 * 60 * 1000,
                );
                return lastActiveDate >= twoWeeksAgo;
              case "last_month":
                const monthAgo = new Date(
                  now.getTime() - 30 * 24 * 60 * 60 * 1000,
                );
                return lastActiveDate >= monthAgo;
              case "last_3_months":
                const threeMonthsAgo = new Date(
                  now.getTime() - 90 * 24 * 60 * 60 * 1000,
                );
                return lastActiveDate >= threeMonthsAgo;
              default:
                return true;
            }
          });
        },
      },

      // Cohorts column
      {
        accessorKey: "cohortNames",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Cohorts" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          if (staff.role === "admin" || staff.role === "superadmin") {
            return (
              <div className="flex flex-wrap gap-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                  All Cohorts
                </span>
              </div>
            );
          }
          return (
            <div className="flex flex-wrap gap-1">
              {staff.cohortNames.length > 0 ? (
                staff.cohortNames.slice(0, 2).map((cohort, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                  >
                    {cohort}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None</span>
              )}
              {staff.cohortNames.length > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{staff.cohortNames.length - 2} more
                </span>
              )}
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: (row, _, value) => {
          const staff = row.original;
          if (!value || value.length === 0) return true;
          return staff.cohortIds.some((cohortId) => value.includes(cohortId));
        },
      },

      // Requests column (x/∞ with "used" sublabel) - sortable by used only
      {
        id: "requests",
        accessorFn: (row) => row.requestsInLastDay ?? 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Requests / Day" />
        ),
        cell: ({ row }) => {
          const staff = row.original;
          const used = staff.requestsInLastDay ?? 0;
          const limit = staff.reqPerDay ?? null;
          const limitText =
            limit === null || limit === undefined ? "\u221E" : String(limit);
          return (
            <div className="flex flex-col items-center">
              <span className="text-sm font-medium">
                {used}/{limitText}
              </span>
              <span className="text-xs text-muted-foreground">used</span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: false,
      },

      // Actions column
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const staff = row.original;
          return (
            <button
              onClick={() => onEditUser(staff.id)}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm border rounded-md hover:bg-muted transition-colors"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
          );
        },
        enableSorting: false,
        enableColumnFilter: false,
      },
    ];

    return staffColumns;
  }, [onEditUser]);

  return {
    columns,
    roleOptions,
    cohortOptions,
    activityOptions,
    lastActiveOptions,
  };
}
