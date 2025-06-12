/**
 * Profile.tsx
 * Used to display the profile page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import * as React from "react";
import { User, Shield, Mail, Building, GraduationCap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Class, ProfileRole } from "@/types";
import { useSession } from "next-auth/react";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getUserByEmail } from "@/utils/user/get-user-by-email";

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
  };

  return roleInfo[role] || roleInfo.ta;
};

interface ProfileProps {
  className?: string;
}

export function Profile({ className }: ProfileProps) {
  const session = useSession();
  const userEmail = session.data?.user?.email;

  const { data: user } = useQuery({
    queryKey: ["user", userEmail],
    queryFn: () => getUserByEmail(userEmail!),
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", userEmail],
    queryFn: () => getProfilesByUser(user!.id!),
    select: (data) => data[0],
    enabled: !!user,
  });

  // Fetch classes for assigned courses
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
    enabled: !!profile,
  });

  if (profileLoading) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Loading Profile...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!profile) {
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

  const roleInfo = getRoleInfo(profile.role as ProfileRole);

  // Filter classes user is assigned to
  const assignedClasses = classes.filter((cls: Class) =>
    profile.classIds?.includes(cls.id),
  );

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials(profile.firstName + " " + profile.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl">{profile.firstName + " " + profile.lastName}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Mail className="h-4 w-4" />
                {profile.alias}@purdue.edu
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
              <p className="font-medium">{new Date(profile.lastLogin).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Account Created</p>
              <p className="font-medium">{new Date(profile.createdAt).toLocaleDateString()}</p>
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
                    <div key={cls.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <div>
                        <p className="font-medium">{cls.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {cls.classCode} • {cls.term} {cls.year}
                        </p>
                      </div>
                      <Badge variant="outline">{cls.classCode}</Badge>
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
