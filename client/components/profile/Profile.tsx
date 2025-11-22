/**
 * Profile.tsx
 * Used to display the profile page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { Mail } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProfile } from "@/contexts/profile-context";
type ProfileRole = "superadmin" | "admin" | "instructional" | "ta" | "guest";

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

  return (
    <div className={className} data-testid="profile-page">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar
              className="h-16 w-16 outline outline-muted-foreground"
              style={{ outlineWidth: "1px", outlineStyle: "solid" }}
            >
              <AvatarFallback className="text-lg">
                {getInitials(
                  activeProfile.firstName + " " + activeProfile.lastName,
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <CardTitle className="text-2xl" data-testid="profile-name">
                {activeProfile.firstName + " " + activeProfile.lastName}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1" data-testid="profile-email">
                <Mail className="h-4 w-4" />
                {activeProfile.emails && activeProfile.emails.length > 0
                  ? activeProfile.emails.join(", ")
                  : activeProfile.primaryEmail || "No email"}
              </CardDescription>
            </div>
            <Badge variant={roleInfo.color} data-testid="profile-role">{roleInfo.label}</Badge>
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
        </CardContent>
      </Card>
    </div>
  );
}
