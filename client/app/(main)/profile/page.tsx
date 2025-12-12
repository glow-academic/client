/**
 * app/(main)/profile/page.tsx
 * Profile page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { Profile } from "@/components/profile/Profile";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Profile",
    description: "View and manage your teaching assistant profile. Access your training progress, review performance metrics, update personal information, and track your professional development in the L&D program.",
  };
}

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <Profile />
    </div>
  );
}
