/**
 * Profile.tsx
 * Used to display the profile page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Mail } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Class, ProfileRole } from "@/types";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllDepartments } from "@/utils/queries/departments/get-all-departments";
import { useProfile } from "@/contexts/profile-context";

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

// Helper function to get role display info
const getRoleInfo = (role: ProfileRole) => {
  const roleInfo = {
    admin: {
      label: "Administrator",
      color: "destructive" as const,
    },
    instructional: {
      label: "Instructional Staff",
      color: "default" as const,
    },
    instructor: {
      label: "Instructor",
      color: "secondary" as const,
    },
    ta: {
      label: "Teaching Assistant",
      color: "outline" as const,
    },
    superadmin: {
      label: "Super Administrator",
      color: "destructive" as const,
    },
    guest: {
      label: "Guest",
      color: "outline" as const,
    },
  };

  return roleInfo[role] || roleInfo.ta;
};

export interface ProfileProps {
  className?: string;
}

export function Profile({ className }: ProfileProps) {
  const { activeProfile } = useProfile();

  // Fetch classes for assigned courses
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
    enabled: !!activeProfile,
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => getAllDepartments(),
  });

  if (!activeProfile) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Guest User</CardTitle>
            <CardDescription>
              You are browsing as a guest. Please log in to access your profile.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const roleInfo = getRoleInfo(activeProfile.role as ProfileRole);

  // Filter classes user is assigned to
  const assignedClasses = classes.filter((cls: Class) =>
    cls.profileIds?.includes(activeProfile.id)
  );

  const formatClassTerm = (term: string) => {
    switch (term) {
      case "fall":
        return "Fall";
      case "spring":
        return "Spring";
      case "summer":
        return "Summer";
      default:
        return term;
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials(activeProfile.firstName + " " + activeProfile.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl">
                {activeProfile.firstName + " " + activeProfile.lastName}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                {activeProfile.alias}@{process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
              </CardDescription>
            </div>
            <Badge variant={roleInfo.color}>{roleInfo.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Information */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Last Login</p>
              <p className="font-medium">
                {new Date(activeProfile.lastLogin).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Account Created</p>
              <p className="font-medium">
                {new Date(activeProfile.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Assigned Classes */}
          {assignedClasses.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Assigned Classes
                </h3>
                <div className="space-y-2">
                  {assignedClasses.map((cls: Class) => (
                    <div
                      key={cls.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{departments?.find((department) => department.id === cls.departmentId)?.departmentCode + "-" + cls.classCode}</p>
                        <p className="text-sm text-muted-foreground">
                          {cls.classCode} • {formatClassTerm(cls.term)}{" "}
                          {cls.year}
                        </p>
                      </div>
                      <Badge variant="outline">{departments?.find((department) => department.id === cls.departmentId)?.departmentCode + " " + cls.classCode}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
