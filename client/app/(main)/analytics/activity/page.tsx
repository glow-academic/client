/**
 * app/(main)/analytics/activity/page.tsx
 * Activity page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

import { AccessDenied } from "@/components/common/layout/AccessDenied";
import { requireAuthenticated } from "@/lib/auth-helpers";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  try {
    await requireAuthenticated();
  } catch {
    // Metadata can be generated even if auth fails
  }

  return {
    title: "Activity",
    description:
      "View activity logs and user interactions across the platform. Track system events, user actions, and engagement metrics for comprehensive activity monitoring.",
  };
}

export default async function ActivityPage() {
  const authResult = await requireAuthenticated().catch(() => null);
  if (!authResult) {
    return <AccessDenied redirectPath="/analytics/activity" />;
  }

  return (
    <div className="space-y-6" data-page="activity-index">
      {/* Activity content will be added here */}
    </div>
  );
}

