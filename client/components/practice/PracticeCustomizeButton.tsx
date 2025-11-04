/**
 * PracticeCustomizeButton.tsx
 * Button for customizing practice sessions (for use in layout)
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { SlidersHorizontal } from "lucide-react";

type ProfileItem = {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  role: "superadmin" | "admin" | "instructional" | "ta" | "guest";
  active: boolean;
  viewedIntro: boolean;
  viewedChat: boolean;
  defaultProfile: boolean;
  reqPerDay: number | null;
  lastLogin: string;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
  primaryDepartmentId: string | null;
};

export function PracticeCustomizeButton() {
  const { effectiveProfile } = useProfile();

  // Determine if button should be shown based on role
  const role = effectiveProfile?.role;
  if (role === "guest") {
    return null;
  }
  if (role === "ta") {
    if (!(effectiveProfile?.viewedIntro && effectiveProfile?.viewedChat)) {
      return null;
    }
  }
  const privilegedRoles: Array<ProfileItem["role"]> = [
    "instructional",
    "admin",
    "superadmin",
    "ta",
  ];
  if (!role || !privilegedRoles.includes(role)) {
    return null;
  }

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("openPracticeCustomize"));
  };

  return (
    <Button onClick={handleClick} size="sm">
      <SlidersHorizontal className="h-4 w-4 mr-2" />
      Customize
    </Button>
  );
}
