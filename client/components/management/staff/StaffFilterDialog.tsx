"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StaffData } from "@/hooks/use-staff-columns";
import { Clock, Shield, User as UserIcon } from "lucide-react";

export interface StaffFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  staffMembers: StaffData[];
  onEditUser: (profileId: string) => void;
}

export function StaffFilterDialog({
  open,
  onOpenChange,
  title,
  staffMembers,
  onEditUser,
}: StaffFilterDialogProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogDescription hidden>
          This dialog shows the staff members and allows you to edit them.
        </DialogDescription>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Cohorts</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    No staff members found.
                  </TableCell>
                </TableRow>
              ) : (
                staffMembers.map((staff) => {
                  const RoleIcon = getRoleIcon(staff.role);
                  return (
                    <TableRow key={staff.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-full outline outline-muted-foreground flex items-center justify-center text-xs font-medium"
                            style={{
                              outlineWidth: "1px",
                              outlineStyle: "solid",
                            }}
                          >
                            {getInitials(
                              staff.firstName + " " + staff.lastName,
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {staff.firstName} {staff.lastName}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <RoleIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {getRoleDisplayName(staff.role)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {staff.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              staff.active ? "bg-green-500" : "bg-gray-400"
                            }`}
                          ></div>
                          <span
                            className={`text-sm font-medium ${
                              staff.active ? "text-green-700" : "text-gray-600"
                            }`}
                          >
                            {staff.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">
                            {formatLastActive(staff.lastActive)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {staff.cohortNames.length > 0 ? (
                            staff.cohortNames
                              .slice(0, 2)
                              .map((cohort, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                                >
                                  {cohort}
                                </span>
                              ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              None
                            </span>
                          )}
                          {staff.cohortNames.length > 2 && (
                            <span className="text-xs text-muted-foreground">
                              +{staff.cohortNames.length - 2} more
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
