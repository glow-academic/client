/**
 * ProfileHeader.tsx
 * Displays the profile banner with name, email, and role badge.
 * Extracted from Report.tsx for use as a server component.
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "admin":
      return "destructive";
    case "instructor":
      return "default";
    case "member":
      return "secondary";
    default:
      return "outline";
  }
};

const getRoleDisplayName = (role: string) => {
  switch (role) {
    case "admin":
      return "Administrator";
    case "instructor":
      return "Instructor";
    case "member":
      return "Member";
    default:
      return role;
  }
};

interface ProfileHeaderProps {
  profileData: {
    name: string | null;
    emails: string[] | null;
    primary_email: string | null;
    role: string | null;
  };
}

export default function ProfileHeader({ profileData }: ProfileHeaderProps) {
  if (!profileData.name) {
    return null;
  }

  const email =
    profileData.emails && profileData.emails.length > 0
      ? profileData.emails.join(", ")
      : profileData.primary_email || "";

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar
            className="h-10 w-10 outline outline-muted-foreground"
            style={{ outlineWidth: "1px", outlineStyle: "solid" }}
          >
            <AvatarFallback>
              {getInitials(profileData.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">
              {profileData.name}
            </h1>
            <p className="text-muted-foreground">
              {email || "No email"}
            </p>
          </div>
          {profileData.role && (
            <Badge variant={getRoleBadgeVariant(profileData.role)}>
              {getRoleDisplayName(profileData.role)}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
