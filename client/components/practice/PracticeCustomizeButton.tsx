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
import { useRouter } from "next/navigation";

// ProfileItem type derived from server response (single source of truth)
import type { ProfileItem } from "@/app/(main)/layout-server";

export function PracticeCustomizeButton() {
  const router = useRouter();
  const { effectiveProfile } = useProfile();

  // Determine if button should be shown based on role
  const role = effectiveProfile?.role;
  if (role === "guest") {
    return null;
  }
  if (role === "member") {
    // Show button for all members
  }
  const privilegedRoles: Array<ProfileItem["role"]> = [
    "instructional",
    "admin",
    "superadmin",
    "member",
  ];
  if (!role || !privilegedRoles.includes(role as ProfileItem["role"])) {
    return null;
  }

  const handleClick = () => {
    router.push("/practice/custom");
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      data-testid="practice-customize-button"
    >
      <SlidersHorizontal className="h-4 w-4 mr-2" />
      Customize
    </Button>
  );
}
