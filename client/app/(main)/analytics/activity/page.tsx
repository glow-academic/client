/**
 * app/(main)/analytics/activity/page.tsx
 * Activity page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

import { getSession } from "@/auth";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Activity",
    description:
      "View activity logs and user interactions across the platform. Track system events, user actions, and engagement metrics for comprehensive activity monitoring.",
  };
}

export default async function ActivityPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  return (
    <div className="space-y-6" data-page="activity-index">
      {/* Activity content will be added here */}
    </div>
  );
}
