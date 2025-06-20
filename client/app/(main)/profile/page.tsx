/**
 * app/(main)/profile/page.tsx
 * Profile page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { Profile } from "@/components/profile/Profile";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
  description: "View your profile in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <Profile />
    </div>
  );
}
