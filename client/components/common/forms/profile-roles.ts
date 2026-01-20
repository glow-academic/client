/**
 * Profile role definitions
 * Extracted from ProfileRolePicker for reuse
 */

export type ProfileRole =
  | "superadmin"
  | "admin"
  | "instructional"
  | "member"
  | "guest"
  | "custom";

export const PROFILE_ROLES: ProfileRole[] = [
  "superadmin",
  "admin",
  "instructional",
  "member",
  "guest",
  "custom",
];

export const ROLE_LABEL: Record<ProfileRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  instructional: "Instructional",
  member: "Member",
  guest: "Guest",
  custom: "Custom",
};
