/**
 * Profile role definitions
 * Extracted from ProfileRolePicker for reuse
 */

export type ProfileRole = "superadmin" | "admin" | "instructional" | "ta" | "guest";

export const PROFILE_ROLES: ProfileRole[] = [
  "superadmin",
  "admin",
  "instructional",
  "ta",
  "guest",
];

export const ROLE_LABEL: Record<ProfileRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  instructional: "Instructional",
  ta: "Teaching Assistant",
  guest: "Guest",
};

