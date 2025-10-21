/**
 * Report.tsx
 * Used to display the individual report for a specific student/TA with detailed metrics and charts.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfileSimple } from "@/lib/api/v2/hooks/profile";
import { useEffect } from "react";
import Dashboard from "../Dashboard";

// Helper function to get initials
const getInitials = (firstName: string, lastName: string): string => {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
};

// Helper function to get role badge variant
const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "admin":
      return "destructive";
    case "instructor":
      return "default";
    case "ta":
      return "secondary";
    default:
      return "outline";
  }
};

// Helper function to get role display name
const getRoleDisplayName = (role: string) => {
  switch (role) {
    case "admin":
      return "Administrator";
    case "instructor":
      return "Instructor";
    case "ta":
      return "Teaching Assistant";
    default:
      return role;
  }
};

export interface ReportProps {
  profileId: string;
}

export default function Report({ profileId }: ReportProps) {
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();

  // Fetch profile data
  const { data: profileData, isLoading: isLoadingProfile } =
    useProfileSimple(profileId);
  const profile = profileData?.profile;

  // Set breadcrumb context when profile data is loaded
  useEffect(() => {
    if (profile?.firstName && profile?.lastName && profileId) {
      const fullName = `${profile.firstName} ${profile.lastName}`;
      setEntityMetadata({
        entityId: profileId,
        entityName: fullName,
        entityType: "profile",
      });
    }
    return () => clearEntityMetadata();
  }, [profile, profileId, setEntityMetadata, clearEntityMetadata]);

  // Loading state
  if (isLoadingProfile || !profile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading report...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Avatar
              className="h-10 w-10 outline outline-muted-foreground"
              style={{ outlineWidth: "1px", outlineStyle: "solid" }}
            >
              <AvatarFallback>
                {getInitials(profile.firstName, profile.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-muted-foreground">
                {profile.alias}@{process.env["NEXT_PUBLIC_CAMPUS_EMAIL"]}
              </p>
            </div>
            <Badge variant={getRoleBadgeVariant(profile.role)}>
              {getRoleDisplayName(profile.role)}
            </Badge>
          </div>
        </div>
      </div>
      <Dashboard profileId={profileId} />
    </div>
  );
}
