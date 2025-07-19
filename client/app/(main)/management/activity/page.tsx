/**
 * app/(main)/management/activity/page.tsx
 * Activity list page - redirects to home with activity section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import ActivityStatus from "@/components/management/activity/ActivityStatus";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity",
  description: `Manage activity in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <ActivityStatus />
    </div>
  );
}
