/**
 * Staff role definitions with descriptions, icons, and colors
 * Extracted from StaffRolePicker for reuse
 */

import {
  BookOpen,
  Crown,
  GraduationCap,
  Shield,
  User,
} from "lucide-react";

// Utility function to generate gradient from hex color
export const generateGradientFromHex = (hexColor: string): string => {
  // Remove # if present
  const cleanHex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);

  // Create a lighter variant for the gradient (brighter like simulation cards)
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);

  // Convert back to hex
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;

  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

// Staff role definitions with descriptions, icons, and colors
export const STAFF_ROLES = [
  {
    id: "superadmin",
    name: "Super Administrator",
    description: "Full system access to all data and permissions",
    icon: Crown,
    color: "#f59e0b", // amber
  },
  {
    id: "admin",
    name: "Administrator",
    description: "Read access to all data except system information",
    icon: Shield,
    color: "#3b82f6", // blue
  },
  {
    id: "instructional",
    name: "Instructional Staff",
    description:
      "Manages GTAs, has access to analytics, create, and cohorts sections",
    icon: GraduationCap,
    color: "#8b5cf6", // purple
  },
  {
    id: "member",
    name: "Member",
    description: "Graduate Teaching Assistant (GTA) trainee role",
    icon: BookOpen,
    color: "#10b981", // green
  },
  {
    id: "guest",
    name: "Guest",
    description: "Limited access, not logged in or not registered",
    icon: User,
    color: "#6b7280", // gray
  },
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number]["id"];
